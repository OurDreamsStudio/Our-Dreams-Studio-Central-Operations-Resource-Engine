'use server';

import { createUserClient } from '@/lib/supabaseUserClient';
import { supabaseServer } from '@/lib/supabaseServer'; // Usado apenas em rotas públicas (enviarEtapaParaAprovacao)
import { requireAuth } from '@/lib/requireAuth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// --- ZOD SCHEMAS ---

const TerceirizadoSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto').max(255),
  especialidade: z.string().max(100).optional().nullable(),
  contato_whatsapp: z.string().max(30).optional().nullable(),
  instagram: z.string().max(100).optional().nullable(),
  percentual_split: z.coerce.number().min(0).max(100).optional().nullable(),
  chave_pix: z.string().max(255).optional().nullable(),
});

const TarefaSchema = z.object({
  projeto_id: z.string().uuid('projeto_id inválido'),
  terceirizado_id: z.string().uuid('terceirizado_id inválido'),
  descricao_tarefa: z.string().min(1).max(500),
  valor_combinado: z.coerce.number().min(0),
  status_entrega: z.string().max(100).optional().nullable(),
  status_pagamento: z.string().max(100).optional().nullable(),
  status_etapa_atual: z.string().max(100).optional().nullable(),
  prazo_entrega: z.string().optional().nullable(),
  roadmap_etapas: z.array(z.string()).optional().nullable(),
  etapa_atual_index: z.coerce.number().min(0).optional().nullable(),
});

// --- TERCEIRIZADOS CRUD ---

export async function getTerceirizados() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('terceirizados')
    .select('*')
    .order('nome', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveTerceirizado(id: string | null, data: Record<string, unknown>) {
  await requireAuth();
  const db = await createUserClient();

  // Zod strip — qualquer campo não declarado é silenciosamente removido
  const parsed = TerceirizadoSchema.parse(data);

  if (id) {
    const { error } = await db.from('terceirizados').update(parsed).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('terceirizados').insert([parsed]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/terceirizados');
  return true;
}

export async function deleteTerceirizado(id: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('terceirizados').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/terceirizados');
  return true;
}

// --- TAREFAS CRUD ---

export async function getTarefas() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('tarefas_terceirizados')
    .select('*, projetos(tipo_servico, clientes(nome_artistico)), terceirizados(nome, especialidade)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveTarefa(id: string | null, data: Record<string, unknown>) {
  await requireAuth();
  const db = await createUserClient();

  const parsed = TarefaSchema.parse(data);

  if (id) {
    const { error } = await db.from('tarefas_terceirizados').update(parsed).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('tarefas_terceirizados').insert([parsed]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/terceirizados');
  return true;
}

export async function deleteTarefa(id: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('tarefas_terceirizados').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/terceirizados');
  return true;
}

// --- PING-PONG FLOW ACTIONS ---
// enviarEtapaParaAprovacao: Terceirizado externo, sem sessão → usa service_role

export async function enviarEtapaParaAprovacao(token: string, link: string) {
  const { error } = await supabaseServer
    .from('tarefas_terceirizados')
    .update({ status_etapa_atual: 'Aguardando Aprovação', link_entrega: link })
    .eq('public_token', token);
  if (error) throw new Error(error.message);
  revalidatePath('/t/[token]', 'page');
  return true;
}

export async function aprovarEtapa(tarefaId: string) {
  await requireAuth();
  const db = await createUserClient();

  const { data: tarefa, error: fetchError } = await db
    .from('tarefas_terceirizados')
    .select('etapa_atual_index, roadmap_etapas')
    .eq('id', tarefaId)
    .single();

  if (fetchError || !tarefa) throw new Error('Tarefa não encontrada');

  const roadmap = tarefa.roadmap_etapas as string[];
  const isFinalStep = tarefa.etapa_atual_index + 1 >= roadmap.length;

  const updateData: Record<string, unknown> = {
    motivo_revisao_etapa: null,
    link_entrega: null,
  };

  if (isFinalStep) {
    updateData.status_entrega = 'Entregue';
    updateData.status_etapa_atual = 'Concluído';
  } else {
    updateData.etapa_atual_index = tarefa.etapa_atual_index + 1;
    updateData.status_etapa_atual = 'Em Execução';
  }

  const { error } = await db.from('tarefas_terceirizados').update(updateData).eq('id', tarefaId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/terceirizados');
  revalidatePath('/t/[token]', 'page');
  return true;
}

export async function solicitarRevisaoEtapa(tarefaId: string, motivo: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db
    .from('tarefas_terceirizados')
    .update({ status_etapa_atual: 'Revisão Solicitada', motivo_revisao_etapa: motivo })
    .eq('id', tarefaId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/terceirizados');
  revalidatePath('/t/[token]', 'page');
  return true;
}

export async function confirmarPagamento(tarefaId: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('tarefas_terceirizados').update({ status_pagamento: 'Pago' }).eq('id', tarefaId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/terceirizados');
  return true;
}

export async function getCountPendingApprovals() {
  await requireAuth();
  const db = await createUserClient();
  const { count, error } = await db
    .from('tarefas_terceirizados')
    .select('*', { count: 'exact', head: true })
    .eq('status_etapa_atual', 'Aguardando Aprovação');
  if (error) return 0;
  return count || 0;
}
