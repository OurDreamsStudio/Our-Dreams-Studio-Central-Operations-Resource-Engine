'use server';

import { createUserClient } from '@/lib/supabaseUserClient';
import { requireAuth } from '@/lib/requireAuth';
import { revalidatePath } from 'next/cache';

export async function getPropostasDinamicas() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('projetos')
    .select(`
      id,
      nome,
      tipo_servico,
      servicos_fechados,
      valores_servicos,
      valor_fechado,
      public_token,
      status_funil,
      sinal_pago,
      created_at,
      clientes (id, nome_artistico, nome_pessoal)
    `)
    // Filtramos para focar em propostas que possuam valores_servicos estruturados 
    // ou que não tenham orcamento_pdf_url (para diferenciar do formato antigo).
    .is('orcamento_pdf_url', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function savePropostaDinamica(id: string | null, data: {
  cliente_id: string;
  nome: string;
  tipo_servico: string;
  valores_servicos: Record<string, number>;
  valor_fechado: number;
}) {
  await requireAuth();
  const db = await createUserClient();

  if (id) {
    const { error } = await db.from('projetos').update({
      cliente_id: data.cliente_id,
      nome: data.nome,
      tipo_servico: data.tipo_servico,
      valores_servicos: data.valores_servicos,
      valor_fechado: data.valor_fechado
    }).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const insertData = { 
      ...data, 
      status_funil: 'Orçamento Enviado',
      sinal_pago: false,
      entrega_paga: false,
      status_producao: null, // Ainda não iniciou produção
      orcamento_pdf_url: null, // É dinâmico
      public_token: crypto.randomUUID() 
    };
    const { error } = await db.from('projetos').insert([insertData]);
    if (error) throw new Error(error.message);
    
    // Atualizar status do cliente
    await db.from('clientes').update({ status_funil: 'Orçamento Enviado' }).eq('id', data.cliente_id);
  }

  revalidatePath('/admin/propostas');
  return true;
}

export async function deletePropostaDinamica(id: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projetos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/propostas');
  return true;
}
