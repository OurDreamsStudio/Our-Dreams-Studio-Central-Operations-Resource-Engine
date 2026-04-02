'use server';

import { supabaseServer } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';
import { revalidatePath } from 'next/cache';

// --- CUSTOS FIXOS CRUD ---
export async function getCustosFixos() {
  await requireAuth();
  const { data, error } = await supabaseServer.from('custos_fixos').select('*').order('vencimento_dia', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveCustoFixo(id: string | null, data: any) {
  await requireAuth();

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
  await requireAuth();

  const { error } = await supabaseServer.from('custos_fixos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/financeiro');
  return true;
}

// --- ATIVOS HARDWARE CRUD ---
export async function getAtivosHardware() {
  await requireAuth();
  const { data, error } = await supabaseServer.from('ativos_hardware').select('*').order('data_compra', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveAtivoHardware(id: string | null, data: any) {
  await requireAuth();

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
  await requireAuth();
  // 1. Fetch all necessary data
  const [
    { data: projetos },
    { data: tarefas },
    { data: custosFixos },
    { data: hardware }
  ] = await Promise.all([
    supabaseServer.from('projetos').select('id, valor_fechado, sinal_pago, entrega_paga, cliente_id, created_at, clientes(nome_artistico, nome_pessoal)'),
    supabaseServer.from('tarefas_terceirizados').select('projeto_id, valor_combinado, status_pagamento'),
    supabaseServer.from('custos_fixos').select('valor'),
    supabaseServer.from('ativos_hardware').select('*')
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
    if (!p.sinal_pago) recebiveisProjetos += (valor * 0.5);
    if (!p.entrega_paga) recebiveisProjetos += (valor * 0.5);

    const criadoEm = new Date(p.created_at);
    if (criadoEm >= inicioMesAtual) {
      receitaMesAtual += valor;
    }
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

  // 6. LTV Ranking (agora baseado em Margem Contribuição Média, não apenas faturamento)
  const TAXA_ENCARGOS = 0.09; // 9% estimativa (Simples Nacional + Taxas de Cartão/Gateway)
  const ltvMap: Record<string, { nome: string, receitaBruta: number, custos: number, margem: number }> = {};
  
  projetos?.forEach(p => {
    const cid = p.cliente_id;
    if (!ltvMap[cid]) {
      const clienteNome = (p.clientes as any)?.nome_artistico || (p.clientes as any)?.nome_pessoal || 'Desconhecido';
      ltvMap[cid] = { 
        nome: clienteNome, 
        receitaBruta: 0,
        custos: 0,
        margem: 0
      };
    }
    const valorFechado = Number(p.valor_fechado);
    ltvMap[cid].receitaBruta += valorFechado;
    
    let custosProjeto = valorFechado * TAXA_ENCARGOS;
    const splits = tarefas?.filter(t => t.projeto_id === p.id);
    splits?.forEach(t => {
      custosProjeto += Number(t.valor_combinado || 0);
    });

    ltvMap[cid].custos += custosProjeto;
    ltvMap[cid].margem = ltvMap[cid].receitaBruta - ltvMap[cid].custos;
  });
  
  // Mapeia para interface antiga mas com os dados reias de margem
  const ltvRanking = Object.values(ltvMap)
    .sort((a, b) => b.margem - a.margem)
    .slice(0, 5)
    .map(c => ({ nome: c.nome, receita: c.margem })); // Hack: injeta a margem no lugar da receita bruta para ranqueamento justo

  const impostosEstimados = receitaBrutaTotal * TAXA_ENCARGOS;

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
    lucroOperacional: receitaBrutaTotal - totalSplits - impostosEstimados - OpExMensal
  };
}
