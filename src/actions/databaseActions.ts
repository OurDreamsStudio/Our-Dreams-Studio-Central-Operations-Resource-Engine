'use server';

import { createUserClient } from '@/lib/supabaseUserClient';
import { supabaseServer } from '@/lib/supabaseServer'; // Usado apenas em aprovarProjeto e registrarSolicitacaoRevisao (rotas públicas sem sessão)
import { requireAuth } from '@/lib/requireAuth';
import { ETAPAS_PRODUCAO } from '@/constants/workflow';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// --- ZETA SCHEMAS (Zod) ---

const ClienteSchema = z.object({
  nome_pessoal: z.string().max(255).optional().nullable(),
  nome_artistico: z.string().max(255).optional().nullable(),
  whatsapp_id: z.string().max(30).optional().nullable(),
  instagram: z.string().max(100).optional().nullable(),
  status_funil: z.string().max(100).optional().nullable(),
  anotacoes: z.string().optional().nullable(),
  diag_status_arquivos: z.string().optional().nullable(),
  diag_nivel_experiencia: z.string().optional().nullable(),
  diag_servico_interesse: z.string().optional().nullable(),
  diag_capacidade_investimento: z.string().optional().nullable(),
}).passthrough(); // passthrough para campos extras da interface (sem injeção)

// Helper: converte string vazia em null (campos opcionais de formulário HTML sempre enviam "")
const emptyStringToNull = z.string().transform(v => v.trim() === '' ? null : v).nullable().optional();
const optionalUrl = z.string().transform(v => v.trim() === '' ? null : v).nullable().optional()
  .refine(v => v === null || v === undefined || /^https?:\/\/.+/.test(v), { message: 'URL inválida para link_arquivos' });

const ProjetoSaveSchema = z.object({
  nome: emptyStringToNull,
  cliente_id: z.string().uuid('cliente_id inválido'),
  tipo_servico: emptyStringToNull,
  status_funil: emptyStringToNull,
  valor_fechado: z.coerce.number().min(0).max(9999999).default(0),
  status_producao: emptyStringToNull,
  prazo_entrega: emptyStringToNull,
  link_arquivos: optionalUrl,
  // Aceita string (join de array) OU array — a UI envia string via .join(', ')
  servicos_fechados: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  valores_servicos: z.record(z.string(), z.coerce.number()).optional().nullable(),
  cupom_usado: emptyStringToNull,
  sinal_pago: z.boolean().optional().default(false),
  entrega_paga: z.boolean().optional().default(false),
  // Preservado em edições para não quebrar o webhook de pagamento
  link_tipo_pagamento: emptyStringToNull,
}).strip();

const CustoFixoSchema = z.object({
  nome: z.string().min(1).max(255),
  valor: z.coerce.number().min(0),
  vencimento_dia: z.coerce.number().min(1).max(31),
  categoria: z.string().max(100).optional().nullable(),
  ativo: z.boolean().optional().default(true),
});

// --- SANITIZERS ---

function sanitizeWhatsApp(id: string | null | undefined): string | null {
  if (!id) return null;
  const sanitized = id.replace(/\D/g, '');
  return sanitized.length > 0 ? sanitized : null;
}

// --- CLIENT ACTIONS ---

export async function getClientes() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('clientes')
    .select('*')
    .order('data_entrada', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveCliente(id: string | null, clientData: Record<string, unknown>) {
  await requireAuth();
  const db = await createUserClient();

  // 1. Validação Zod (strip de campos injetados)
  const parsed = ClienteSchema.parse(clientData);

  // 2. Sanitização do WhatsApp
  const sanitizedWhatsappId = sanitizeWhatsApp(parsed.whatsapp_id as string | null);
  const dataToSave = { ...parsed, whatsapp_id: sanitizedWhatsappId };

  // 3. Pre-check de duplicidade
  if (sanitizedWhatsappId) {
    let query = db
      .from('clientes')
      .select('id')
      .eq('whatsapp_id', sanitizedWhatsappId);

    if (id) {
      query = query.neq('id', id);
    }

    const { data: existing, error: checkError } = await query.maybeSingle();
    if (checkError) throw new Error('Erro ao verificar duplicidade: ' + checkError.message);
    if (existing) throw new Error('Este número de WhatsApp já está cadastrado em outro cliente.');
  }

  // 4. Persistência
  if (id) {
    const { error } = await db.from('clientes').update(dataToSave).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('clientes').insert([dataToSave]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/database');
}

export async function deleteCliente(id: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('clientes').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/database');
}

// --- PROJECT ACTIONS ---

export async function getProjetos() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('projetos')
    .select('*, clientes(nome_artistico, nome_pessoal), projeto_entregaveis(*)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveProjeto(id: string | null, projectData: Record<string, unknown>, splitsTerceiros?: Array<{ terceirizado_id: string; descricao: string; valor: number }>) {
  await requireAuth();
  const db = await createUserClient();

  // Validação Zod
  const parsed = ProjetoSaveSchema.parse(projectData);

  // Regra de negócio dos status no backend
  let finalStatusFunil = parsed.status_funil || 'Inbound WhatsApp';
  let finalStatusProducao = parsed.status_producao || null;

  // CRÍTICO: esta lógica de status_producao só pode ser aplicada em INSERTs.
  // Em UPDATEs, nunca zeramos o status_producao — isso tiraria o projeto
  // do Kanban de Produção mesmo que esteja em plena execução.
  if (!id) {
    // INSERT: aplica a regra do funil
    if (finalStatusFunil !== 'Fechado') {
      finalStatusProducao = null;
    } else {
      if (!finalStatusProducao || finalStatusProducao.trim() === '') {
        finalStatusProducao = 'Definição de Escopo';
      }
    }
  } else {
    // UPDATE: apenas garante que se o funil agora é Fechado e não há status, define o padrão.
    // Nunca força null em projetos que já têm status de produção.
    if (finalStatusFunil === 'Fechado' && (!finalStatusProducao || finalStatusProducao.trim() === '')) {
      finalStatusProducao = 'Definição de Escopo';
    }
  }

  const dataToSave = {
    ...parsed,
    status_funil: finalStatusFunil,
    status_producao: finalStatusProducao,
    public_token: !id ? crypto.randomUUID() : undefined,
  };

  const entregaveisList = Array.isArray(projectData.entregaveis) && projectData.entregaveis.length > 0
    ? projectData.entregaveis
    : null;

  if (id) {
    const { error } = await db.from('projetos').update(dataToSave).eq('id', id);
    if (error) throw new Error(error.message);

    // Sync entregaveis on update if provided
    if (entregaveisList) {
      // Delete old entregaveis and re-insert new list
      await db.from('projeto_entregaveis').delete().eq('projeto_id', id);
      const toInsert = entregaveisList.map((item: any) => ({
        projeto_id: id,
        nome_servico: item.nome || item.nome_servico || 'Serviço',
        valor: Number(item.valor) || 0,
        status_producao: finalStatusProducao || 'Definição de Escopo',
      }));
      const { error: syncError } = await db.from('projeto_entregaveis').insert(toInsert);
      if (syncError) console.error('Erro ao sincronizar entregaveis no update:', syncError.message);
    }
  } else {
    const { data: newProject, error: projectError } = await db
      .from('projetos')
      .insert([dataToSave])
      .select()
      .single();

    if (projectError) throw new Error(projectError.message);

    // Sync projeto_entregaveis
    if (entregaveisList) {
      const toInsert = entregaveisList.map((item: any) => ({
        projeto_id: newProject.id,
        nome_servico: item.nome || item.nome_servico || 'Serviço',
        valor: Number(item.valor) || 0,
        status_producao: finalStatusProducao || 'Definição de Escopo',
      }));
      const { error: entregaveisError } = await db.from('projeto_entregaveis').insert(toInsert);
      if (entregaveisError) console.error('Erro ao criar entregaveis:', entregaveisError.message);
    } else if (parsed.valores_servicos && Object.keys(parsed.valores_servicos).length > 0) {
      const entregaveis = Object.entries(parsed.valores_servicos).map(([nome, valor]) => ({
        projeto_id: newProject.id,
        nome_servico: nome,
        valor: Number(valor),
        status_producao: finalStatusProducao || 'Definição de Escopo',
      }));
      const { error: entregaveisError } = await db.from('projeto_entregaveis').insert(entregaveis);
      if (entregaveisError) {
         console.error('Erro ao criar entregaveis:', entregaveisError.message);
      }
    } else if (parsed.tipo_servico || parsed.servicos_fechados) {
      // Fallback Se não houver valores_servicos, mas houver nome do serviço
      const { error: entregaveisError } = await db.from('projeto_entregaveis').insert([{
        projeto_id: newProject.id,
        nome_servico: parsed.servicos_fechados || parsed.tipo_servico || 'Serviço Principal',
        valor: parsed.valor_fechado || 0,
        status_producao: finalStatusProducao || 'Definição de Escopo',
      }]);
      if (entregaveisError) {
         console.error('Erro ao criar entregavel fallback:', entregaveisError.message);
      }
    }

    if (splitsTerceiros && splitsTerceiros.length > 0) {
      try {
        const tasksToInsert = splitsTerceiros.map(split => ({
          projeto_id: newProject.id,
          terceirizado_id: split.terceirizado_id,
          descricao_tarefa: split.descricao,
          valor_combinado: Number(split.valor) || 0,
          status_entrega: 'Pendente',
          status_pagamento: 'A Pagar',
          status_etapa_atual: 'Em Execução',
        }));

        const { error: taskError } = await db.from('tarefas_terceirizados').insert(tasksToInsert);
        if (taskError) {
          await db.from('projetos').delete().eq('id', newProject.id);
          throw new Error('Erro ao alocar terceiros: ' + taskError.message + '. Criação do projeto revertida.');
        }
      } catch (err: unknown) {
        await db.from('projetos').delete().eq('id', newProject.id);
        throw err;
      }
    }
  }

  // Sincronização do status_funil do cliente correspondente
  if (parsed.cliente_id) {
    const clienteStatusFunil = finalStatusFunil === 'Fechado' ? 'Concluído/Produção' : finalStatusFunil;
    const { error: clientUpdateError } = await db
      .from('clientes')
      .update({ status_funil: clienteStatusFunil })
      .eq('id', parsed.cliente_id);
    if (clientUpdateError) {
      console.error('Erro ao sincronizar status do cliente:', clientUpdateError.message);
    }
  }

  revalidatePath('/kanban');
  revalidatePath('/producao');
  revalidatePath('/admin/database');
  revalidatePath('/admin/terceirizados');
  revalidatePath('/admin/agenda');
}

export async function getProjetosAgenda() {
  await requireAuth();
  const db = await createUserClient();
  const [projetosResponse, tarefasResponse] = await Promise.all([
    db.from('projetos')
      .select('id, nome, servicos_fechados, tipo_servico, prazo_entrega, status_producao')
      .not('prazo_entrega', 'is', null)
      .order('prazo_entrega', { ascending: true }),
    db.from('tarefas_terceirizados')
      .select('id, descricao_tarefa, prazo_entrega, status_entrega, projeto_id, terceirizados ( nome )')
      .not('prazo_entrega', 'is', null)
      .order('prazo_entrega', { ascending: true }),
  ]);

  if (projetosResponse.error) throw new Error(projetosResponse.error.message);
  if (tarefasResponse.error) throw new Error(tarefasResponse.error.message);

  const unified = [
    ...(projetosResponse.data || []).map(p => ({
      ...p,
      type: 'projeto',
      title: p.nome || p.servicos_fechados || p.tipo_servico || 'Projeto Sem Nome',
    })),
    ...(tarefasResponse.data || []).map(t => ({
      ...t,
      id: t.id,
      projeto_id: t.projeto_id,
      type: 'terceiro',
      title: `${t.descricao_tarefa} (${(t.terceirizados as { nome?: string } | null)?.nome})`,
      status_producao: t.status_entrega,
    })),
  ];

  return unified.sort((a, b) => new Date(a.prazo_entrega).getTime() - new Date(b.prazo_entrega).getTime());
}

export async function getProjetoCompleto(id: string) {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('projetos')
    .select('*, clientes(*), tarefas_terceirizados(*, terceirizados(*))')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProjectDeadline(id: string, deadline: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projetos').update({ prazo_entrega: deadline }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/agenda');
  return true;
}

export async function faxinaProjetosFantasmas() {
  await requireAuth();
  const db = await createUserClient();
  const { data: deleted, error } = await db
    .from('projetos')
    .delete()
    .is('status_producao', null)
    .neq('status_funil', 'Fechado')
    .select();

  if (error) throw new Error(error.message);
  revalidatePath('/admin/database');
  revalidatePath('/kanban');
  return { count: deleted?.length || 0, message: `Faxina concluída. ${deleted?.length || 0} projetos fantasmas removidos.` };
}

export async function deleteProjeto(id: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projetos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/database');
  return true;
}

// --- ROTAS PÚBLICAS (usam service_role pois o artista não tem sessão) ---

export async function aprovarProjeto(entregavelId: string, token: string) {
  // O cliente aprova a revisão:
  // Não move para 'Entregue' diretamente.
  // Apenas marca cliente_aprovado = true e aguarda aprovação do admin.
  const { error } = await supabaseServer
    .from('projeto_entregaveis')
    .update({ 
      data_aprovacao: new Date().toISOString(), 
      cliente_aprovado: true,
      motivo_revisao: null 
    })
    .eq('id', entregavelId);
  if (error) throw new Error(error.message);
  revalidatePath(`/p/${token}`);
  revalidatePath('/producao');
  revalidatePath('/admin/projetos');
  return true;
}

export async function adminAprovarProjeto(id: string) {
  await requireAuth();
  const db = await createUserClient();

  const { data: proj, error: fetchError } = await db
    .from('projeto_entregaveis')
    .select('cliente_aprovado, status_producao')
    .eq('id', id)
    .single();

  if (fetchError || !proj) throw new Error('Projeto não encontrado.');
  
  const isApproved = proj.cliente_aprovado;
  
  if (!isApproved) throw new Error('O cliente ainda não aprovou o projeto.');

  const { error } = await db
    .from('projeto_entregaveis')
    .update({ status_producao: 'Aprovado' })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  revalidatePath('/admin/projetos');
  return true;
}

export async function registrarSolicitacaoRevisao(
  entregavelId: string,
  feedback: import('@/types').FeedbackRevisao | string,
  currentHistory: Array<{ data: string; motivo: any; etapa: string }>
) {
  const agora = new Date().toISOString();

  let resumoTexto: string;
  let motivoParaSalvar: any;

  if (typeof feedback === 'string') {
    resumoTexto = feedback;
    motivoParaSalvar = feedback;
  } else {
    const cats = [...new Set(feedback.pontos.map((p) => p.categoria))];
    const criticos = feedback.pontos.filter((p) => p.prioridade === 'Crítico').length;
    resumoTexto = `${feedback.pontos.length} ponto(s) · ${cats.join(', ')}${criticos > 0 ? ` · ${criticos} crítico(s)` : ''}`;
    motivoParaSalvar = { ...feedback, resumo: resumoTexto };
  }

  const novoItem = { data: agora, motivo: motivoParaSalvar, etapa: 'Solicitação de Alteração' };

  const { data: entregavel, error: fetchError } = await supabaseServer
    .from('projeto_entregaveis')
    .select('contador_revisoes, revisoes_disponiveis, projetos(public_token)')
    .eq('id', entregavelId)
    .single();

  if (fetchError) throw new Error('Erro ao buscar entregável: ' + fetchError.message);

  const disponiveis = Number(entregavel?.revisoes_disponiveis ?? 3);
  if (disponiveis <= 0) {
    throw new Error('Limite de revisões atingido. Entre em contato com o produtor.');
  }

  const nextCount = (Number(entregavel?.contador_revisoes) || 0) + 1;
  const nextDisponiveis = disponiveis - 1;
  const novoHistorico = [...(currentHistory || []), novoItem];

  const { data, error } = await supabaseServer
    .from('projeto_entregaveis')
    .update({
      status_producao: 'Pós-Produção',
      motivo_revisao: typeof motivoParaSalvar === 'string' ? motivoParaSalvar : JSON.stringify(motivoParaSalvar),
      historico_revisoes: novoHistorico,
      contador_revisoes: nextCount,
      revisoes_disponiveis: nextDisponiveis,
      data_aprovacao: null,
      cliente_aprovado: false,
    })
    .eq('id', entregavelId)
    .select();

  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  
  const token = (entregavel.projetos as any)?.public_token;
  if (token) {
    revalidatePath(`/p/${token}`);
  }
  return data?.[0];
}


export async function ajustarRevisoesDisponiveis(projectId: string, novoValor: number) {
  await requireAuth();
  const db = await createUserClient();

  const valor = Math.max(0, Math.min(10, Math.round(novoValor)));

  const { data, error } = await db
    .from('projetos')
    .update({ revisoes_disponiveis: valor })
    .eq('id', projectId)
    .select('id, public_token, revisoes_disponiveis, contador_revisoes')
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/clientes`);
  if (data?.public_token) revalidatePath(`/p/${data.public_token}`);
  return data;
}

// --- KANBAN ACTIONS ---

export async function getClientesKanban() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('clientes')
    .select('*')
    .neq('status_funil', 'Concluído/Produção')
    .order('data_entrada', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function moverClienteFunil(id: string, novoStatus: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('clientes').update({ status_funil: novoStatus }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/kanban');
  return true;
}

export async function fecharProjetoNoKanban(clienteId: string, projectData: Record<string, unknown>) {
  await requireAuth();
  const db = await createUserClient();

  const { data: proj, error: projError } = await db.from('projetos').insert([{
    cliente_id: clienteId,
    nome: projectData.nome,
    status_funil: 'Fechado',
    status_producao: projectData.status_producao || 'Definição de Escopo',
    servicos_fechados: projectData.servicos_fechados,
    checklist_preparacao: projectData.checklist_preparacao,
    valor_fechado: Number(projectData.valor_fechado) || 0,
    valores_servicos: projectData.valores_servicos,
    sinal_pago: projectData.sinal_pago,
    prazo_entrega: projectData.prazo_entrega || null,
    public_token: crypto.randomUUID(),
    // Automatismo: projeto recém-fechado sempre começa com link apontando para sinal
    link_tipo_pagamento: 'sinal',
  }]).select().single();

  if (projError) throw new Error(projError.message);

  // Sync projeto_entregaveis if entregaveis array or valores_servicos exists
  if (Array.isArray(projectData.entregaveis) && projectData.entregaveis.length > 0) {
    const entregaveis = projectData.entregaveis.map((item: any) => ({
      projeto_id: proj.id,
      nome_servico: item.nome || item.nome_servico || 'Serviço',
      valor: Number(item.valor) || 0,
      status_producao: projectData.status_producao || 'Definição de Escopo',
    }));
    const { error: entregaveisError } = await db.from('projeto_entregaveis').insert(entregaveis);
    if (entregaveisError) {
      console.error('Erro ao criar entregaveis:', entregaveisError.message);
    }
  } else if (projectData.valores_servicos && typeof projectData.valores_servicos === 'object' && Object.keys(projectData.valores_servicos).length > 0) {
    const entregaveis = Object.entries(projectData.valores_servicos).map(([nome, valor]) => ({
      projeto_id: proj.id,
      nome_servico: nome,
      valor: Number(valor) || 0,
      status_producao: projectData.status_producao || 'Definição de Escopo',
    }));
    const { error: entregaveisError } = await db.from('projeto_entregaveis').insert(entregaveis);
    if (entregaveisError) {
       console.error('Erro ao criar entregaveis:', entregaveisError.message);
    }
  } else if (projectData.servicos_fechados || projectData.nome) {
    // Fallback Se não houver valores_servicos, mas houver nome do serviço
    const { error: entregaveisError } = await db.from('projeto_entregaveis').insert([{
      projeto_id: proj.id,
      nome_servico: projectData.servicos_fechados || projectData.nome || 'Serviço Principal',
      valor: Number(projectData.valor_fechado) || 0,
      status_producao: projectData.status_producao || 'Definição de Escopo',
    }]);
    if (entregaveisError) {
       console.error('Erro ao criar entregavel fallback:', entregaveisError.message);
    }
  }

  const { error: cliError } = await db.from('clientes').update({ status_funil: 'Concluído/Produção' }).eq('id', clienteId);
  if (cliError) throw new Error(cliError.message);

  revalidatePath('/kanban');
  return proj;
}

// --- PRODUCAO ACTIONS ---

export async function getProjetosProducao() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('projeto_entregaveis')
    .select('*, projetos(*, clientes(*))')
    .not('status_producao', 'is', null)
    .neq('status_producao', 'Cancelado')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProjetoChecklist(entregavelId: string, newChecklist: unknown) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projeto_entregaveis').update({ checklist_preparacao: newChecklist }).eq('id', entregavelId);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  return true;
}

export async function updateProjetoStatusProducao(id: string, novoStatus: string) {
  await requireAuth();
  if (novoStatus === 'Entregue') {
    throw new Error('Não é possível mover para "Entregue" manualmente. O projeto é movido automaticamente após confirmação do pagamento final.');
  }
  if (novoStatus === 'Aprovado') {
    throw new Error('Use o botão "Aprovar" no card para mover para "Aprovado". O cliente precisa ter aprovado primeiro.');
  }
  const db = await createUserClient();
  const { error } = await db.from('projeto_entregaveis').update({ status_producao: novoStatus }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  revalidatePath('/admin/projetos');
  return true;
}

export async function updateProjetoLinkArquivos(id: string, link: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projeto_entregaveis').update({ link_arquivos: link }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  return true;
}

export async function confirmarEntregaProjeto(id: string, entregaPaga: boolean) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projetos').update({ status_producao: 'Entregue', entrega_paga: entregaPaga }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  return true;
}

export async function desfazerEntregaProjeto(id: string, novoStatusProducao: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projeto_entregaveis').update({
    status_producao: novoStatusProducao,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  revalidatePath('/clientes');
  revalidatePath('/admin/projetos');
  return true;
}

// --- CLIENT PROFILE ACTIONS ---

export async function getClientProfileData(id: string) {
  await requireAuth();
  const db = await createUserClient();
  const [{ data: cData }, { data: pData }, { data: nData }] = await Promise.all([
    db.from('clientes').select('*').eq('id', id).single(),
    db.from('projetos').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
    db.from('n8n_estado').select('*').eq('cliente_id', id).maybeSingle(),
  ]);
  return { cliente: cData, projetos: pData || [], n8n: nData };
}

export async function updateClienteAnotacoes(id: string, anotacoes: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('clientes').update({ anotacoes }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${id}`);
  return true;
}

export async function updateClienteAnotacoesArray(
  id: string,
  anotacoes: Array<{
    id: string;
    titulo: string;
    conteudo: string;
    categoria: string;
    cor: string;
    criado_em: string;
    atualizado_em: string;
  }>
) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db
    .from('clientes')
    .update({ anotacoes: JSON.stringify(anotacoes) })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${id}`);
  return true;
}

export async function createUpsellProject(projectData: Record<string, unknown>) {
  await requireAuth();
  const db = await createUserClient();
  const dataWithToken = { ...projectData, public_token: crypto.randomUUID() };
  const { data, error } = await db.from('projetos').insert([dataWithToken]).select().single();
  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${projectData.cliente_id}`);
  return data;
}

export async function buscarClientesParaKanban(query: string) {
  await requireAuth();
  const db = await createUserClient();
  const clean = query.trim();
  if (!clean) return [];

  const { data, error } = await db
    .from('clientes')
    .select('id, nome_artistico, nome_pessoal, telefone, instagram, email, status_funil')
    .or(`nome_artistico.ilike.%${clean}%,nome_pessoal.ilike.%${clean}%,telefone.ilike.%${clean}%,instagram.ilike.%${clean}%`)
    .limit(8);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function criarLeadOuReabrirNoKanban(payload: {
  cliente_id?: string | null;
  nome_artistico?: string;
  nome_pessoal?: string;
  telefone?: string;
  instagram?: string;
  email?: string;
  status_funil: string;
  diag_servico_interesse?: string;
  entregaveis?: Array<{ nome: string; valor: number }>;
  fechamento?: {
    nome_projeto?: string;
    prazo_entrega?: string;
    sinal_pago?: boolean;
    terceirizados?: string;
  };
}) {
  await requireAuth();
  const db = await createUserClient();

  let targetClienteId = payload.cliente_id;

  if (targetClienteId) {
    // Reabrir cliente existente na coluna selecionada
    const updateData: Record<string, unknown> = {
      status_funil: payload.status_funil,
    };
    if (payload.diag_servico_interesse) {
      updateData.diag_servico_interesse = payload.diag_servico_interesse;
    }
    if (payload.telefone) updateData.telefone = payload.telefone;
    if (payload.instagram) updateData.instagram = payload.instagram;
    if (payload.email) updateData.email = payload.email;

    const { error: updateErr } = await db
      .from('clientes')
      .update(updateData)
      .eq('id', targetClienteId);

    if (updateErr) throw new Error(updateErr.message);
  } else {
    // Criar novo cliente
    if (!payload.nome_artistico?.trim()) {
      throw new Error('Nome Artístico é obrigatório.');
    }

    const { data: newClient, error: insertErr } = await db
      .from('clientes')
      .insert([{
        nome_artistico: payload.nome_artistico.trim(),
        nome_pessoal: payload.nome_pessoal?.trim() || null,
        telefone: payload.telefone?.trim() || null,
        instagram: payload.instagram?.trim() || null,
        email: payload.email?.trim() || null,
        diag_servico_interesse: payload.diag_servico_interesse || null,
        status_funil: payload.status_funil,
        data_entrada: new Date().toISOString(),
      }])
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);
    targetClienteId = newClient.id;
  }

  // Se a coluna escolhida for 'Fechado'
  if (payload.status_funil === 'Fechado' && targetClienteId) {
    const entregaveis = payload.entregaveis || [];
    const servicosStr = entregaveis.map(e => e.nome).filter(Boolean).join(', ') || payload.diag_servico_interesse || 'Projeto';
    const valorTotal = entregaveis.reduce((acc, e) => acc + (Number(e.valor) || 0), 0);
    const valoresServicos: Record<string, number> = {};
    entregaveis.forEach(e => {
      if (e.nome) valoresServicos[e.nome] = Number(e.valor) || 0;
    });

    const projectData = {
      nome: payload.fechamento?.nome_projeto || `Projeto - ${entregaveis[0]?.nome || servicosStr}`,
      status_producao: 'Definição de Escopo',
      servicos_fechados: servicosStr,
      valor_fechado: valorTotal,
      valores_servicos: valoresServicos,
      entregaveis: entregaveis,
      sinal_pago: payload.fechamento?.sinal_pago || false,
      prazo_entrega: payload.fechamento?.prazo_entrega || null,
      terceirizados: payload.fechamento?.terceirizados || null,
    };

    await fecharProjetoNoKanban(targetClienteId, projectData);
  }

  revalidatePath('/kanban');
  return { success: true, clienteId: targetClienteId };
}

