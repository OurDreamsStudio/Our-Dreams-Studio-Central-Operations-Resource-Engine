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
    .select('*, clientes(nome_artistico, nome_pessoal)')
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

  if (finalStatusFunil !== 'Fechado') {
    // Se o status do funil de vendas é menor que "Fechado",
    // o projeto não pode ter um status de produção ativo.
    finalStatusProducao = null;
  } else {
    // Se o status do funil é "Fechado", ele deve ter status de produção. Se for nulo/vazio, inicia em "Definição de Escopo".
    if (!finalStatusProducao || finalStatusProducao.trim() === '') {
      finalStatusProducao = 'Definição de Escopo';
    }
  }

  const dataToSave = {
    ...parsed,
    status_funil: finalStatusFunil,
    status_producao: finalStatusProducao,
    public_token: !id ? crypto.randomUUID() : undefined,
  };

  if (id) {
    const { error } = await db.from('projetos').update(dataToSave).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { data: newProject, error: projectError } = await db
      .from('projetos')
      .insert([dataToSave])
      .select()
      .single();

    if (projectError) throw new Error(projectError.message);

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

export async function aprovarProjeto(token: string) {
  const statusFinal = ETAPAS_PRODUCAO[ETAPAS_PRODUCAO.length - 1];
  const { error } = await supabaseServer
    .from('projetos')
    .update({ data_aprovacao: new Date().toISOString(), status_producao: statusFinal, motivo_revisao: null })
    .eq('public_token', token);
  if (error) throw new Error(error.message);
  revalidatePath('/p/[token]', 'page');
  return true;
}

export async function registrarSolicitacaoRevisao(
  projectId: string,
  feedback: import('@/types').FeedbackRevisao | string,
  currentHistory: Array<{ data: string; motivo: any; etapa: string }>
) {
  const agora = new Date().toISOString();

  // Gera um resumo de texto legível para exibição rápida
  let resumoTexto: string;
  let motivoParaSalvar: any;

  if (typeof feedback === 'string') {
    // Compatibilidade com o formato legado (string pura)
    resumoTexto = feedback;
    motivoParaSalvar = feedback;
  } else {
    // Novo formato estruturado
    const cats = [...new Set(feedback.pontos.map((p) => p.categoria))];
    const criticos = feedback.pontos.filter((p) => p.prioridade === 'Crítico').length;
    resumoTexto = `${feedback.pontos.length} ponto(s) · ${cats.join(', ')}${criticos > 0 ? ` · ${criticos} crítico(s)` : ''}`;
    motivoParaSalvar = { ...feedback, resumo: resumoTexto };
  }

  const novoItem = { data: agora, motivo: motivoParaSalvar, etapa: 'Solicitação de Alteração' };

  const { data: project, error: fetchError } = await supabaseServer
    .from('projetos')
    .select('contador_revisoes, revisoes_disponiveis, public_token')
    .eq('id', projectId)
    .single();

  if (fetchError) throw new Error('Erro ao buscar projeto: ' + fetchError.message);

  const disponiveis = Number(project?.revisoes_disponiveis ?? 3);
  if (disponiveis <= 0) {
    throw new Error('Limite de revisões atingido. Entre em contato com o produtor.');
  }

  const nextCount = (Number(project?.contador_revisoes) || 0) + 1;
  const nextDisponiveis = disponiveis - 1;
  const novoHistorico = [...(currentHistory || []), novoItem];

  const { data, error } = await supabaseServer
    .from('projetos')
    .update({
      status_producao: 'Pós-Produção',
      motivo_revisao: typeof motivoParaSalvar === 'string' ? motivoParaSalvar : JSON.stringify(motivoParaSalvar),
      historico_revisoes: novoHistorico,
      contador_revisoes: nextCount,
      revisoes_disponiveis: nextDisponiveis,
      data_aprovacao: null,
    })
    .eq('id', projectId)
    .select();

  if (error) throw new Error(error.message);
  revalidatePath(`/admin/projetos/${projectId}`);
  if (data?.[0]?.public_token) revalidatePath(`/p/${data[0].public_token}`);
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
    status_producao: projectData.status_producao,
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
    .from('projetos')
    .select('*, clientes(*)')
    .not('status_producao', 'is', null)
    .neq('status_producao', 'Cancelado')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProjetoChecklist(projectId: string, newChecklist: unknown) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projetos').update({ checklist_preparacao: newChecklist }).eq('id', projectId);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  return true;
}

export async function updateProjetoStatusProducao(id: string, novoStatus: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projetos').update({ status_producao: novoStatus }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  return true;
}

export async function updateProjetoLinkArquivos(id: string, link: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projetos').update({ link_arquivos: link }).eq('id', id);
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
  const { error } = await db.from('projetos').update({
    status_producao: novoStatusProducao,
    entrega_paga: false,
    data_aprovacao: null,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/producao');
  revalidatePath('/clientes');
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

export async function createUpsellProject(projectData: Record<string, unknown>) {
  await requireAuth();
  const db = await createUserClient();
  const dataWithToken = { ...projectData, public_token: crypto.randomUUID() };
  const { data, error } = await db.from('projetos').insert([dataWithToken]).select().single();
  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${projectData.cliente_id}`);
  return data;
}
