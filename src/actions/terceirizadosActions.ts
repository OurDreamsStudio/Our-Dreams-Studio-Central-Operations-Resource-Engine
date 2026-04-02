'use server';

import { supabaseServer } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { revalidatePath } from 'next/cache';

// --- TERCEIRIZADOS CRUD ---

export async function getTerceirizados() {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from('terceirizados')
    .select('*')
    .order('nome', { ascending: true });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function saveTerceirizado(id: string | null, data: any) {
  await requireAuth();
  if (id) {
    const { error } = await supabaseServer
      .from('terceirizados')
      .update(data)
      .eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseServer
      .from('terceirizados')
      .insert([data]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/terceirizados');
  return true;
}

export async function deleteTerceirizado(id: string) {
  await requireAuth();
  const { error } = await supabaseServer
    .from('terceirizados')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/terceirizados');
  return true;
}

// --- TAREFAS CRUD ---

export async function getTarefas() {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from('tarefas_terceirizados')
    .select('*, projetos(tipo_servico, clientes(nome_artistico)), terceirizados(nome, especialidade)')
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function saveTarefa(id: string | null, data: any) {
  await requireAuth();
  // Ensure numeric value
  const dataToSave = {
    ...data,
    valor_combinado: data.valor_combinado ? Number(data.valor_combinado) : 0
  };

  if (id) {
    const { error } = await supabaseServer
      .from('tarefas_terceirizados')
      .update(dataToSave)
      .eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseServer
      .from('tarefas_terceirizados')
      .insert([dataToSave]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/terceirizados');
  return true;
}

export async function deleteTarefa(id: string) {
  await requireAuth();
  const { error } = await supabaseServer
    .from('tarefas_terceirizados')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/terceirizados');
  return true;
}

// --- PING-PONG FLOW ACTIONS ---

export async function enviarEtapaParaAprovacao(token: string, link: string) {
  const { error } = await supabaseServer
    .from('tarefas_terceirizados')
    .update({ 
      status_etapa_atual: 'Aguardando Aprovação',
      link_entrega: link
    })
    .eq('public_token', token);

  if (error) throw new Error(error.message);
  revalidatePath('/t/[token]', 'page');
  return true;
}

export async function aprovarEtapa(tarefaId: string) {
  await requireAuth();
  // 1. Get current state
  const { data: tarefa, error: fetchError } = await supabaseServer
    .from('tarefas_terceirizados')
    .select('etapa_atual_index, roadmap_etapas')
    .eq('id', tarefaId)
    .single();

  if (fetchError || !tarefa) throw new Error('Tarefa não encontrada');

  const roadmap = tarefa.roadmap_etapas as string[];
  const isFinalStep = tarefa.etapa_atual_index + 1 >= roadmap.length;

  // 2. Prepare update
  const updateData: any = {
    motivo_revisao_etapa: null,
    link_entrega: null // Clear link after approval
  };

  if (isFinalStep) {
    updateData.status_entrega = 'Entregue';
    updateData.status_etapa_atual = 'Concluído';
  } else {
    updateData.etapa_atual_index = tarefa.etapa_atual_index + 1;
    updateData.status_etapa_atual = 'Em Execução';
    // Double-ensure link is cleared for next stage (already in updateData)
    updateData.link_entrega = null; 
  }

  const { error } = await supabaseServer
    .from('tarefas_terceirizados')
    .update(updateData)
    .eq('id', tarefaId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/terceirizados');
  revalidatePath('/t/[token]', 'page');
  return true;
}

export async function solicitarRevisaoEtapa(tarefaId: string, motivo: string) {
  await requireAuth();
  const { error } = await supabaseServer
    .from('tarefas_terceirizados')
    .update({ 
      status_etapa_atual: 'Revisão Solicitada',
      motivo_revisao_etapa: motivo
    })
    .eq('id', tarefaId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/terceirizados');
  revalidatePath('/t/[token]', 'page');
  return true;
}

export async function confirmarPagamento(tarefaId: string) {
  await requireAuth();
  const { error } = await supabaseServer
    .from('tarefas_terceirizados')
    .update({ status_pagamento: 'Pago' })
    .eq('id', tarefaId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/terceirizados');
  return true;
}

export async function getCountPendingApprovals() {
  await requireAuth();
  const { count, error } = await supabaseServer
    .from('tarefas_terceirizados')
    .select('*', { count: 'exact', head: true })
    .eq('status_etapa_atual', 'Aguardando Aprovação');
    
  if (error) return 0;
  return count || 0;
}
