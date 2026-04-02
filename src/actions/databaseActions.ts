'use server';

import { supabaseServer } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { ETAPAS_PRODUCAO } from '@/constants/workflow';
import { revalidatePath } from 'next/cache';
import { Projeto, Cliente, Terceirizado, TarefaTerceirizado, Notificacao } from '@/types';

function sanitizeWhatsApp(id: string | null | undefined): string | null {
  if (!id) return null;
  const sanitized = id.replace(/\D/g, ''); // Remove all non-numeric characters
  return sanitized.length > 0 ? sanitized : null;
}

// --- CLIENT ACTIONS ---

export async function getClientes() {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from('clientes')
    .select('*')
    .order('data_entrada', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function saveCliente(id: string | null, clientData: Partial<Cliente>) {
  await requireAuth();

  // 1. Sanitização
  const sanitizedWhatsappId = sanitizeWhatsApp(clientData.whatsapp_id);
  const dataToSave = { ...clientData, whatsapp_id: sanitizedWhatsappId };

  // 2. Pre-check de duplicidade (se o whatsapp_id não for nulo)
  if (sanitizedWhatsappId) {
    const query = supabaseServer
      .from('clientes')
      .select('id')
      .eq('whatsapp_id', sanitizedWhatsappId);
    
    if (id) {
      query.neq('id', id); // Se for edição, ignora o próprio ID
    }

    const { data: existing, error: checkError } = await query.maybeSingle();

    if (checkError) throw new Error('Erro ao verificar duplicidade: ' + checkError.message);
    if (existing) {
      throw new Error('Este número de WhatsApp já está cadastrado em outro cliente.');
    }
  }

  // 3. Persistência
  if (id) {
    const { error } = await supabaseServer
      .from('clientes')
      .update(dataToSave)
      .eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseServer
      .from('clientes')
      .insert([dataToSave]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/database');
}

export async function deleteCliente(id: string) {
  await requireAuth();

  const { error } = await supabaseServer
    .from('clientes')
    .delete()
    .eq('id', id);
    
  if (error) throw new Error(error.message);
  revalidatePath('/admin/database');
}

// --- PROJECT ACTIONS ---

export async function getProjetos() {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from('projetos')
    .select('*, clientes(nome_artistico, nome_pessoal)')
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function saveProjeto(id: string | null, projectData: Partial<Projeto>, splitsTerceiros?: any[]) {
  await requireAuth();

  // Robustness: ensure numeric fields and clean status
  const dataToSave: any = { 
    nome: projectData.nome || null,
    cliente_id: projectData.cliente_id,
    tipo_servico: projectData.tipo_servico,
    status_funil: projectData.status_funil,
    valor_fechado: Number(projectData.valor_fechado) || 0,
    status_producao: projectData.status_producao || null,
    prazo_entrega: projectData.prazo_entrega || null,
    link_arquivos: projectData.link_arquivos || null,
    servicos_fechados: projectData.servicos_fechados || null,
    valores_servicos: projectData.valores_servicos || null,
    cupom_usado: projectData.cupom_usado || null,
    public_token: !id ? crypto.randomUUID() : undefined // Generate only on insert
  };

  if (id) {
    const { error } = await supabaseServer
      .from('projetos')
      .update(dataToSave)
      .eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    // Transacionalidade Manual (Create Project then Tasks)
    const { data: newProject, error: projectError } = await supabaseServer
      .from('projetos')
      .insert([dataToSave])
      .select()
      .single();

    if (projectError) throw new Error(projectError.message);

    // Se houver splits de terceiros, inserimos
    if (splitsTerceiros && splitsTerceiros.length > 0) {
      try {
        const tasksToInsert = splitsTerceiros.map(split => ({
          projeto_id: newProject.id,
          terceirizado_id: split.terceirizado_id,
          descricao_tarefa: split.descricao,
          valor_combinado: Number(split.valor) || 0,
          status_entrega: 'Pendente',
          status_pagamento: 'A Pagar',
          status_etapa_atual: 'Em Execução'
        }));

        const { error: taskError } = await supabaseServer
          .from('tarefas_terceirizados')
          .insert(tasksToInsert);

        if (taskError) {
          throw new Error(taskError.message);
        }
      } catch (err: any) {
        // REVERSÃO: Remove o projeto se as tarefas falharem
        await supabaseServer.from('projetos').delete().eq('id', newProject.id);
        throw new Error('Erro ao alocar terceiros: ' + err.message + '. A criação do projeto foi revertida.');
      }
    }
  }
  revalidatePath('/admin/database');
  revalidatePath('/admin/terceirizados');
  revalidatePath('/admin/agenda'); // Added for The Pulse
}

export async function getProjetosAgenda() {
  await requireAuth();
  const [projetosResponse, tarefasResponse] = await Promise.all([
    supabaseServer
      .from('projetos')
      .select('id, nome, servicos_fechados, tipo_servico, prazo_entrega, status_producao')
      .not('prazo_entrega', 'is', null)
      .order('prazo_entrega', { ascending: true }),
    supabaseServer
      .from('tarefas_terceirizados')
      .select(`
        id, 
        descricao_tarefa, 
        prazo_entrega, 
        status_entrega, 
        projeto_id,
        terceirizados ( nome )
      `)
      .not('prazo_entrega', 'is', null)
      .order('prazo_entrega', { ascending: true })
  ]);

  if (projetosResponse.error) throw new Error(projetosResponse.error.message);
  if (tarefasResponse.error) throw new Error(tarefasResponse.error.message);

  const unified = [
    ...(projetosResponse.data || []).map(p => ({
      ...p,
      type: 'projeto',
      title: p.nome || p.servicos_fechados || p.tipo_servico || 'Projeto Sem Nome'
    })),
    ...(tarefasResponse.data || []).map(t => ({
      ...t,
      id: t.id,
      projeto_id: t.projeto_id,
      type: 'terceiro',
      title: `${t.descricao_tarefa} (${(t.terceirizados as any)?.nome})`,
      status_producao: t.status_entrega // Map for generic status check
    }))
  ];

  return unified.sort((a, b) => new Date(a.prazo_entrega).getTime() - new Date(b.prazo_entrega).getTime());
}

export async function getProjetoCompleto(id: string) {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from('projetos')
    .select(`
      *,
      clientes(*),
      tarefas_terceirizados(*, terceirizados(*))
    `)
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProjectDeadline(id: string, deadline: string) {
  await requireAuth();

  const { error } = await supabaseServer
    .from('projetos')
    .update({ prazo_entrega: deadline })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/agenda');
  return true;
}

/**
 * [FAXINA] Operação de Limpeza v0.6.2
 * Deleta projetos que foram criados automaticamente (fantasmas)
 * Critério: status_producao IS NULL E não estão marcados como 'Fechado'
 */
export async function faxinaProjetosFantasmas() {
  await requireAuth();

  const { data: deleted, error } = await supabaseServer
    .from('projetos')
    .delete()
    .is('status_producao', null)
    .neq('status_funil', 'Fechado')
    .select();

  if (error) {
    console.error('Faxina Error:', error);
    throw new Error(error.message);
  }

  revalidatePath('/admin/database');
  revalidatePath('/kanban');
  
  return { 
    count: deleted?.length || 0, 
    message: `Faxina concluída. ${deleted?.length || 0} projetos fantasmas removidos.` 
  };
}

export async function deleteProjeto(id: string) {
  await requireAuth();

  const { error } = await supabaseServer.from('projetos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/database');
  return true;
}

export async function aprovarProjeto(token: string) {
  // Get final status dynamically
  const statusFinal = ETAPAS_PRODUCAO[ETAPAS_PRODUCAO.length - 1];

  const { error } = await supabaseServer
    .from('projetos')
    .update({ 
      data_aprovacao: new Date().toISOString(),
      status_producao: statusFinal,
      motivo_revisao: null
    })
    .eq('public_token', token);

  if (error) throw new Error(error.message);
  revalidatePath('/p/[token]', 'page');
  return true;
}

export async function registrarSolicitacaoRevisao(projectId: string, motivo: string, currentHistory: any[]) {
  try {
    const agora = new Date().toISOString();
    const novoItem = { 
      data: agora, 
      motivo: motivo, 
      etapa: 'Solicitação de Alteração' 
    };
    
    // 1. Buscar dados atuais para garantir integridade do contador
    const { data: project, error: fetchError } = await supabaseServer
      .from('projetos')
      .select('contador_revisoes, public_token')
      .eq('id', projectId)
      .single();

    if (fetchError) {
      console.error('Fetch error during revision request:', fetchError);
      throw new Error('Erro ao buscar projeto: ' + fetchError.message);
    }

    const currentCount = Number(project?.contador_revisoes) || 0;
    const nextCount = currentCount + 1;
    const novoHistorico = [...(currentHistory || []), novoItem];

    // 2. Update
    const { data, error } = await supabaseServer
      .from('projetos')
      .update({ 
        status_producao: 'Pós-Produção',  // Move back to Pós-Produção (valid constrained value) for rework
        motivo_revisao: motivo,
        historico_revisoes: novoHistorico,
        contador_revisoes: nextCount,
        data_aprovacao: null // Garante que a data de aprovação seja limpa
      })
      .eq('id', projectId)
      .select();

    if (error) {
      console.error('Update error during revision request:', error);
      throw new Error(error.message);
    }

    // Revalidar rotas afetadas
    revalidatePath(`/admin/projetos/${projectId}`);
    if (data?.[0]?.public_token) {
      revalidatePath(`/p/${data[0].public_token}`);
    }
    
    return data?.[0];
  } catch (err: any) {
    console.error('CRITICAL ERROR in registrarSolicitacaoRevisao:', err);
    throw err;
  }
}

// --- KANBAN ACTIONS (Moved from Client Side) ---
export async function getClientesKanban() {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from('clientes')
    .select('*')
    .neq('status_funil', 'Concluído/Produção')
    .order('data_entrada', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function moverClienteFunil(id: string, novoStatus: string) {
  await requireAuth();
  const { error } = await supabaseServer.from('clientes').update({ status_funil: novoStatus }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/kanban');
  return true;
}

export async function fecharProjetoNoKanban(clienteId: string, projectData: any) {
  await requireAuth();
  
  // 1. Create project
  const { data: proj, error: projError } = await supabaseServer.from('projetos').insert([{
    cliente_id: clienteId,
    nome: projectData.nome,
    status_funil: 'Fechado',
    status_producao: projectData.status_producao,
    servicos_fechados: projectData.servicos_fechados,
    checklist_preparacao: projectData.checklist_preparacao,
    valor_fechado: projectData.valor_fechado,
    valores_servicos: projectData.valores_servicos,
    sinal_pago: projectData.sinal_pago,
    prazo_entrega: projectData.prazo_entrega || null,
    terceirizados: projectData.terceirizados || null
  }]).select().single();
  
  if (projError) throw new Error(projError.message);

  // 2. Update cliente status
  const { error: cliError } = await supabaseServer.from('clientes').update({ status_funil: 'Concluído/Produção' }).eq('id', clienteId);
  if (cliError) throw new Error(cliError.message);
  
  revalidatePath('/kanban');
  return proj;
}

// --- PRODUCAO ACTIONS (Moved from Client Side) ---
export async function getProjetosProducao() {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from('projetos')
    .select('*, clientes(*)')
    .not('status_producao', 'is', null)
    .neq('status_producao', 'Cancelado')
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProjetoChecklist(projectId: string, newChecklist: any) {
  await requireAuth();
  const { error } = await supabaseServer
    .from('projetos')
    .update({ checklist_preparacao: newChecklist })
    .eq('id', projectId);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  return true;
}

export async function updateProjetoStatusProducao(id: string, novoStatus: string) {
  await requireAuth();
  const { error } = await supabaseServer
    .from('projetos')
    .update({ status_producao: novoStatus })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  return true;
}

export async function updateProjetoLinkArquivos(id: string, link: string) {
  await requireAuth();
  const { error } = await supabaseServer
    .from('projetos')
    .update({ link_arquivos: link })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  return true;
}

export async function confirmarEntregaProjeto(id: string, entregaPaga: boolean) {
  await requireAuth();
  const { error } = await supabaseServer
    .from('projetos')
    .update({
      status_producao: 'Entregue',
      entrega_paga: entregaPaga
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  return true;
}

// --- CLIENT PROFILE ACTIONS (Moved from Client Side) ---
export async function getClientProfileData(id: string) {
  await requireAuth();
  const [ { data: cData }, { data: pData }, { data: nData } ] = await Promise.all([
    supabaseServer.from('clientes').select('*').eq('id', id).single(),
    supabaseServer.from('projetos').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabaseServer.from('n8n_estado').select('*').eq('cliente_id', id).maybeSingle()
  ]);
  return { cliente: cData, projetos: pData || [], n8n: nData };
}

export async function updateClienteAnotacoes(id: string, anotacoes: string) {
  await requireAuth();
  const { error } = await supabaseServer
    .from('clientes')
    .update({ anotacoes })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${id}`);
  return true;
}

export async function createUpsellProject(projectData: any) {
  await requireAuth();
  const dataWithToken = {
    ...projectData,
    public_token: crypto.randomUUID()
  };
  const { data, error } = await supabaseServer.from('projetos').insert([dataWithToken]).select().single();
  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${projectData.cliente_id}`);
  return data;
}
