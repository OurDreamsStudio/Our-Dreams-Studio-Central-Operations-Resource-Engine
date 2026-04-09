'use server';

import { createUserClient } from '@/lib/supabaseUserClient';
import { requireAuth } from '@/lib/requireAuth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// --- ZOD SCHEMAS ---

const CustoFixoSchema = z.object({
  nome: z.string().min(1).max(255),
  valor: z.coerce.number().min(0).max(9999999),
  vencimento_dia: z.coerce.number().min(1).max(31),
  categoria: z.string().max(100).optional().nullable(),
  ativo: z.boolean().optional().default(true),
});

const AtivoHardwareSchema = z.object({
  nome: z.string().min(1).max(255),
  valor_compra: z.coerce.number().min(0).max(9999999),
  data_compra: z.string().min(1, 'Data de compra obrigatória'),
  vida_util_meses: z.coerce.number().min(1).max(600),
  categoria: z.string().max(100).optional().nullable(),
  descricao: z.string().optional().nullable(),
});

// --- CUSTOS FIXOS CRUD ---

export async function getCustosFixos() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('custos_fixos')
    .select('*')
    .order('vencimento_dia', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveCustoFixo(id: string | null, data: Record<string, unknown>) {
  await requireAuth();
  const db = await createUserClient();

  // Zod strips campos extras e valida
  const parsed = CustoFixoSchema.parse(data);

  if (id) {
    const { error } = await db.from('custos_fixos').update(parsed).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('custos_fixos').insert([parsed]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/financeiro');
  return true;
}

export async function deleteCustoFixo(id: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('custos_fixos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/financeiro');
  return true;
}

// --- ATIVOS HARDWARE CRUD ---

export async function getAtivosHardware() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('ativos_hardware')
    .select('*')
    .order('data_compra', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveAtivoHardware(id: string | null, data: Record<string, unknown>) {
  await requireAuth();
  const db = await createUserClient();

  const parsed = AtivoHardwareSchema.parse(data);

  if (id) {
    const { error } = await db.from('ativos_hardware').update(parsed).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('ativos_hardware').insert([parsed]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/financeiro');
  return true;
}

// --- INTELIGÊNCIA FINANCEIRA (EFI ENGINE) ---

export async function getFinancialIntelligence() {
  await requireAuth();
  const db = await createUserClient();

  const [
    { data: projetos },
    { data: tarefas },
    { data: custosFixos },
    { data: hardware }
  ] = await Promise.all([
    db.from('projetos').select('id, valor_fechado, sinal_pago, entrega_paga, cliente_id, created_at, clientes(nome_artistico, nome_pessoal)'),
    db.from('tarefas_terceirizados').select('projeto_id, valor_combinado, status_pagamento'),
    db.from('custos_fixos').select('valor'),
    db.from('ativos_hardware').select('*'),
  ]);

  // 2. Receita Bruta & Recebíveis
  let receitaBrutaTotal = 0;
  let recebiveisProjetos = 0;

  const inicioMesAtual = new Date();
  inicioMesAtual.setDate(1);
  inicioMesAtual.setHours(0, 0, 0, 0);
  let receitaMesAtual = 0;

  projetos?.forEach(p => {
    const valor = Number(p.valor_fechado || 0);
    receitaBrutaTotal += valor;
    if (!p.sinal_pago) recebiveisProjetos += valor * 0.5;
    if (!p.entrega_paga) recebiveisProjetos += valor * 0.5;
    if (new Date(p.created_at) >= inicioMesAtual) receitaMesAtual += valor;
  });

  // 3. Splits
  let totalSplits = 0;
  let splitsPendentes = 0;
  tarefas?.forEach(t => {
    totalSplits += Number(t.valor_combinado || 0);
    if (t.status_pagamento !== 'Pago') splitsPendentes += Number(t.valor_combinado);
  });

  // 4. OpEx
  const OpExMensal = custosFixos?.reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;

  // 5. Depreciação
  let valorInventarioAtual = 0;
  const hoje = new Date();
  hardware?.forEach(item => {
    const dataCompra = new Date(item.data_compra);
    const mesesPassados = (hoje.getFullYear() - dataCompra.getFullYear()) * 12 + (hoje.getMonth() - dataCompra.getMonth());
    const depreciacaoPorMes = Number(item.valor_compra) / Number(item.vida_util_meses);
    valorInventarioAtual += Math.max(0, Number(item.valor_compra) - mesesPassados * depreciacaoPorMes);
  });

  // 6. LTV Ranking
  const TAXA_ENCARGOS = 0.09;
  const ltvMap: Record<string, { nome: string; receitaBruta: number; custos: number; margem: number }> = {};

  projetos?.forEach(p => {
    const cid = p.cliente_id;
    if (!ltvMap[cid]) {
      const clienteNome = (p.clientes as { nome_artistico?: string; nome_pessoal?: string } | null)?.nome_artistico
        || (p.clientes as { nome_artistico?: string; nome_pessoal?: string } | null)?.nome_pessoal
        || 'Desconhecido';
      ltvMap[cid] = { nome: clienteNome, receitaBruta: 0, custos: 0, margem: 0 };
    }
    const valorFechado = Number(p.valor_fechado);
    ltvMap[cid].receitaBruta += valorFechado;
    let custosProjeto = valorFechado * TAXA_ENCARGOS;
    tarefas?.filter(t => t.projeto_id === p.id).forEach(t => {
      custosProjeto += Number(t.valor_combinado || 0);
    });
    ltvMap[cid].custos += custosProjeto;
    ltvMap[cid].margem = ltvMap[cid].receitaBruta - ltvMap[cid].custos;
  });

  const impostosEstimados = receitaBrutaTotal * TAXA_ENCARGOS;
  const ltvRanking = Object.values(ltvMap)
    .sort((a, b) => b.margem - a.margem)
    .slice(0, 5)
    .map(c => ({ nome: c.nome, receita: c.margem }));

  return {
    receitaBrutaTotal,
    receitaMesAtual,
    recebiveisProjetos,
    totalSplits,
    splitsPendentes,
    OpExMensal,
    impostosEstimados,
    valorInventarioAtual,
    ltvRanking,
    margemContribuicao: receitaBrutaTotal - totalSplits - impostosEstimados,
    lucroOperacional: receitaBrutaTotal - totalSplits - impostosEstimados - OpExMensal,
  };
}
