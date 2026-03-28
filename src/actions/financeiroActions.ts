'use server';

import { supabaseServer } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

// --- CUSTOS FIXOS CRUD ---
export async function getCustosFixos() {
  const { data, error } = await supabaseServer.from('custos_fixos').select('*').order('vencimento_dia', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveCustoFixo(id: string | null, data: any) {
  const sanitized = {
    ...data,
    valor: Number(data.valor) || 0,
    vencimento_dia: Math.min(31, Math.max(1, Number(data.vencimento_dia) || 1))
  };
  
  if (id) {
    const { error } = await supabaseServer.from('custos_fixos').update(sanitized).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseServer.from('custos_fixos').insert([sanitized]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/financeiro');
  return true;
}

export async function deleteCustoFixo(id: string) {
  const { error } = await supabaseServer.from('custos_fixos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/financeiro');
  return true;
}

// --- ATIVOS HARDWARE CRUD ---
export async function getAtivosHardware() {
  const { data, error } = await supabaseServer.from('ativos_hardware').select('*').order('data_compra', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveAtivoHardware(id: string | null, data: any) {
  const sanitized = {
    ...data,
    valor_compra: Number(data.valor_compra) || 0,
    vida_util_meses: Math.max(1, Number(data.vida_util_meses) || 60)
  };

  if (id) {
    const { error } = await supabaseServer.from('ativos_hardware').update(sanitized).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseServer.from('ativos_hardware').insert([sanitized]);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/financeiro');
  return true;
}

// --- INTELIGÊNCIA FINANCEIRA (EFI ENGINE) ---

export async function getFinancialIntelligence() {
  // 1. Fetch all necessary data
  const [
    { data: projetos },
    { data: tarefas },
    { data: custosFixos },
    { data: hardware }
  ] = await Promise.all([
    supabaseServer.from('projetos').select('valor_fechado, sinal_pago, entrega_paga, cliente_id, clientes(nome_artistico, nome_pessoal)'),
    supabaseServer.from('tarefas_terceirizados').select('valor_combinado, status_pagamento'),
    supabaseServer.from('custos_fixos').select('valor'),
    supabaseServer.from('ativos_hardware').select('*')
  ]);

  // 2. Receita Bruta & Recebíveis
  let receitaBrutaTotal = 0;
  let recebiveisProjetos = 0;
  
  projetos?.forEach(p => {
    receitaBrutaTotal += Number(p.valor_fechado || 0);
    // Presumindo que se não está pago, é recebível
    if (!p.sinal_pago) recebiveisProjetos += (p.valor_fechado * 0.5); // Metade sinal
    if (!p.entrega_paga) recebiveisProjetos += (p.valor_fechado * 0.5); // Metade entrega
  });

  // 3. Splits (Repasses)
  let totalSplits = 0;
  let splitsPendentes = 0;
  tarefas?.forEach(t => {
    totalSplits += Number(t.valor_combinado || 0);
    if (t.status_pagamento !== 'Pago') splitsPendentes += Number(t.valor_combinado);
  });

  // 4. OpEx (Custos Fixos Mensais)
  const OpExMensal = custosFixos?.reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;

  // 5. Depreciação & Inventário
  let valorInventarioAtual = 0;
  const hoje = new Date();
  hardware?.forEach(item => {
    const dataCompra = new Date(item.data_compra);
    const mesesPassados = (hoje.getFullYear() - dataCompra.getFullYear()) * 12 + (hoje.getMonth() - dataCompra.getMonth());
    const depreciacaoPorMes = Number(item.valor_compra) / Number(item.vida_util_meses);
    const valorRestante = Math.max(0, Number(item.valor_compra) - (mesesPassados * depreciacaoPorMes));
    valorInventarioAtual += valorRestante;
  });

  // 6. LTV Ranking
  const ltvMap: Record<string, { nome: string, receita: number }> = {};
  projetos?.forEach(p => {
    const cid = p.cliente_id;
    if (!ltvMap[cid]) {
      const clienteNome = (p.clientes as any)?.nome_artistico || (p.clientes as any)?.nome_pessoal || 'Desconhecido';
      ltvMap[cid] = { 
        nome: clienteNome, 
        receita: 0 
      };
    }
    ltvMap[cid].receita += Number(p.valor_fechado);
  });
  const ltvRanking = Object.values(ltvMap).sort((a, b) => b.receita - a.receita).slice(0, 5);

  return {
    receitaBrutaTotal,
    recebiveisProjetos,
    totalSplits,
    splitsPendentes,
    OpExMensal,
    valorInventarioAtual,
    ltvRanking,
    margemContribuicao: receitaBrutaTotal - totalSplits,
    lucroOperacional: receitaBrutaTotal - totalSplits - OpExMensal // Simplificação para DRE
  };
}
