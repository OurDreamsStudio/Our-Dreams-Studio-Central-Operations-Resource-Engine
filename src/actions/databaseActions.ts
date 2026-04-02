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
    cupom_usado: projectData.cupom_usado || null
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
