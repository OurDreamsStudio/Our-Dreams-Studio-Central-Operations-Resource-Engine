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
    db.from('projetos').select('id, valor_fechado, sinal_pago, entrega_paga, status_funil, status_producao, cliente_id, created_at, clientes(nome_artistico, nome_pessoal)'),
    db.from('tarefas_terceirizados').select('projeto_id, valor_combinado, status_pagamento'),
    db.from('custos_fixos').select('valor'),
    db.from('ativos_hardware').select('*'),
  ]);

  // ─── LÓGICA FINANCEIRA CORRIGIDA ───────────────────────────────────────────
  //
  // receitaBrutaTotal = apenas o que efetivamente entrou em caixa
  //   sinal_pago  → 50% do valor_fechado recebido
  //   entrega_paga → mais 50% recebido
  //
  // recebiveisProjetos = o que ainda falta receber de projetos ATIVOS
  //   (exclui Perdidos e Cancelados, pois não haverá pagamento)
  //
  // projecaoTotal = caixa atual + a receber (visão completa do pipeline)

  let receitaBrutaTotal = 0;
  let recebiveisProjetos = 0;

  const inicioMesAtual = new Date();
  inicioMesAtual.setDate(1);
  inicioMesAtual.setHours(0, 0, 0, 0);
  let receitaMesAtual = 0;

  projetos?.forEach(p => {
    const valor = Number(p.valor_fechado || 0);
    const meioPago = valor * 0.5;
    const statusFunil = p.status_funil || '';
    const statusProducao = p.status_producao || '';
    const isAtivo = statusFunil !== 'Perdido' && statusProducao !== 'Cancelado';

    // O que efetivamente entrou em caixa
    let recebidoNesteProjeto = 0;
    if (p.sinal_pago) recebidoNesteProjeto += meioPago;
    if (p.entrega_paga) recebidoNesteProjeto += meioPago;

    receitaBrutaTotal += recebidoNesteProjeto;

    // Receita recebida no mês atual (usa created_at como proxy — melhor que nada)
    if (new Date(p.created_at) >= inicioMesAtual) {
      receitaMesAtual += recebidoNesteProjeto;
    }

    // A receber: apenas projetos ativos (não perdidos, não cancelados)
    if (isAtivo) {
      if (!p.sinal_pago) recebiveisProjetos += meioPago;
      if (!p.entrega_paga) recebiveisProjetos += meioPago;
    }
  });

  // Projeção total = caixa atual + pipeline de recebíveis
  const projecaoTotal = receitaBrutaTotal + recebiveisProjetos;

  // ─── SPLITS ────────────────────────────────────────────────────────────────
  let totalSplits = 0;
  let splitsPendentes = 0;
  tarefas?.forEach(t => {
    totalSplits += Number(t.valor_combinado || 0);
    if (t.status_pagamento !== 'Pago') splitsPendentes += Number(t.valor_combinado);
  });

  // ─── OPEX ──────────────────────────────────────────────────────────────────
  const OpExMensal = custosFixos?.reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;

  // ─── DEPRECIAÇÃO ──────────────────────────────────────────────────────────
  let valorInventarioAtual = 0;
  const hoje = new Date();
  hardware?.forEach(item => {
    const dataCompra = new Date(item.data_compra);
    const mesesPassados = (hoje.getFullYear() - dataCompra.getFullYear()) * 12 + (hoje.getMonth() - dataCompra.getMonth());
    const depreciacaoPorMes = Number(item.valor_compra) / Number(item.vida_util_meses);
    valorInventarioAtual += Math.max(0, Number(item.valor_compra) - mesesPassados * depreciacaoPorMes);
  });

  // ─── LTV RANKING (agrupado por cliente) ────────────────────────────────────
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

    // LTV baseado no que efetivamente foi pago pelo cliente
    const valor = Number(p.valor_fechado || 0);
    let recebido = 0;
    if (p.sinal_pago) recebido += valor * 0.5;
    if (p.entrega_paga) recebido += valor * 0.5;

    ltvMap[cid].receitaBruta += recebido;
    let custosProjeto = recebido * TAXA_ENCARGOS;
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
    projecaoTotal,
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

// --- ORÇAMENTOS (LINKS) ---

export async function getOrcamentos() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('projetos')
    .select(`
      id, 
      nome, 
      valor_fechado, 
      orcamento_pdf_url, 
      orcamento_arquivado, 
      created_at, 
      status_funil,
      sinal_pago,
      entrega_paga,
      status_producao,
      clientes (id, nome_artistico, nome_pessoal)
    `)
    .not('orcamento_pdf_url', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function toggleArchiveOrcamento(projetoId: string, arquivado: boolean) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db
    .from('projetos')
    .update({ orcamento_arquivado: arquivado })
    .eq('id', projetoId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/financeiro');
  return true;
}

export async function saveOrcamentoLink(
  isNewProject: boolean,
  link: string,
  projetoId?: string,
  newProjectData?: { 
    clienteId: string; 
    nomeProjeto: string; 
    tipoServico: string; 
    valorFechado: number;
    statusClassification?: string;
  }
) {
  await requireAuth();
  const db = await createUserClient();

  // Link pode ser vazio — apenas salva null
  const urlToSave = link.trim() === '' ? null : link.trim();

  if (isNewProject) {
    if (!newProjectData) throw new Error('Dados do projeto são obrigatórios.');
    
    const statusClassification = newProjectData.statusClassification || 'Negociação';
    
    let finalStatusFunil = 'Orçamento Enviado';
    let finalSinalPago = false;
    let finalEntregaPaga = false;
    let finalStatusProducao = null;

    if (statusClassification === 'Fechado') {
      finalStatusFunil = 'Fechado';
      finalSinalPago = false;
      finalEntregaPaga = false;
      finalStatusProducao = 'Definição de Escopo';
    } else if (statusClassification === '50% Pago') {
      finalStatusFunil = 'Fechado';
      finalSinalPago = true;
      finalEntregaPaga = false;
      finalStatusProducao = 'Definição de Escopo';
    } else if (statusClassification === 'Concluído') {
      finalStatusFunil = 'Fechado';
      finalSinalPago = true;
      finalEntregaPaga = true;
      finalStatusProducao = 'Entregue';
    } else if (statusClassification === 'Perdido') {
      finalStatusFunil = 'Perdido';
      finalSinalPago = false;
      finalEntregaPaga = false;
      finalStatusProducao = 'Cancelado';
    }

    const { data: newProj, error: createError } = await db.from('projetos').insert([{
      cliente_id: newProjectData.clienteId,
      nome: newProjectData.nomeProjeto || 'Novo Projeto',
      tipo_servico: newProjectData.tipoServico,
      valor_fechado: newProjectData.valorFechado,
      status_funil: finalStatusFunil,
      sinal_pago: finalSinalPago,
      entrega_paga: finalEntregaPaga,
      status_producao: finalStatusProducao,
      orcamento_pdf_url: urlToSave,
      public_token: crypto.randomUUID(),
      // Automatismo: se sinal já pago, link aponta para entrega; caso contrário, para sinal
      link_tipo_pagamento: finalSinalPago ? 'entrega' : 'sinal',
    }]).select('id').single();

    if (createError) throw new Error(createError.message);

    // Sincronizar status do cliente
    let clientStatusFunil = 'Orçamento Enviado';
    if (finalStatusFunil === 'Fechado') {
      clientStatusFunil = 'Concluído/Produção';
    } else if (finalStatusFunil === 'Perdido') {
      clientStatusFunil = 'Perdido';
    }

    const { error: clientUpdateError } = await db
      .from('clientes')
      .update({ status_funil: clientStatusFunil })
      .eq('id', newProjectData.clienteId);

    if (clientUpdateError) {
      console.error('Erro ao sincronizar status do cliente:', clientUpdateError.message);
    }

    revalidatePath('/admin/financeiro');
    return { success: true, projetoId: newProj.id };
  } else {
    if (!projetoId) throw new Error('ID do projeto é obrigatório.');
    const { error: updateError } = await db.from('projetos')
      .update({ orcamento_pdf_url: urlToSave })
      .eq('id', projetoId);
    if (updateError) throw new Error(updateError.message);
    revalidatePath('/admin/financeiro');
    return { success: true, projetoId };
  }
}

export async function updateOrcamentoLink(projetoId: string, link: string, statusClassification?: string) {
  await requireAuth();
  const db = await createUserClient();
  
  const urlToSave = link.trim() === '' ? null : link.trim();
  const updateData: any = { orcamento_pdf_url: urlToSave };

  if (statusClassification) {
    const { data: project, error: fetchError } = await db
      .from('projetos')
      .select('status_producao, cliente_id')
      .eq('id', projetoId)
      .single();

    if (fetchError) throw new Error('Erro ao buscar projeto para atualização: ' + fetchError.message);

    let finalStatusFunil = 'Orçamento Enviado';
    let finalSinalPago = false;
    let finalEntregaPaga = false;
    let finalStatusProducao = project.status_producao;

    if (statusClassification === 'Fechado') {
      finalStatusFunil = 'Fechado';
      finalSinalPago = false;
      finalEntregaPaga = false;
      if (!finalStatusProducao || finalStatusProducao === 'Cancelado' || finalStatusProducao === 'Entregue') {
        finalStatusProducao = 'Definição de Escopo';
      }
    } else if (statusClassification === '50% Pago') {
      finalStatusFunil = 'Fechado';
      finalSinalPago = true;
      finalEntregaPaga = false;
      if (!finalStatusProducao || finalStatusProducao === 'Cancelado' || finalStatusProducao === 'Entregue') {
        finalStatusProducao = 'Definição de Escopo';
      }
    } else if (statusClassification === 'Concluído') {
      finalStatusFunil = 'Fechado';
      finalSinalPago = true;
      finalEntregaPaga = true;
      finalStatusProducao = 'Entregue';
    } else if (statusClassification === 'Perdido') {
      finalStatusFunil = 'Perdido';
      finalSinalPago = false;
      finalEntregaPaga = false;
      finalStatusProducao = 'Cancelado';
    } else if (statusClassification === 'Negociação') {
      finalStatusFunil = 'Orçamento Enviado';
      finalSinalPago = false;
      finalEntregaPaga = false;
      finalStatusProducao = null;
    }

    updateData.status_funil = finalStatusFunil;
    updateData.sinal_pago = finalSinalPago;
    updateData.entrega_paga = finalEntregaPaga;
    updateData.status_producao = finalStatusProducao;
    // Automatismo: define o tipo de link com base no estado de pagamento resultante
    updateData.link_tipo_pagamento = finalSinalPago ? 'entrega' : 'sinal';

    // Sincronizar status do cliente
    if (project.cliente_id) {
      let clientStatusFunil = 'Orçamento Enviado';
      if (finalStatusFunil === 'Fechado') {
        clientStatusFunil = 'Concluído/Produção';
      } else if (finalStatusFunil === 'Perdido') {
        clientStatusFunil = 'Perdido';
      } else if (finalStatusFunil === 'Negociação') {
        clientStatusFunil = 'Orçamento Enviado';
      }

      const { error: clientUpdateError } = await db
        .from('clientes')
        .update({ status_funil: clientStatusFunil })
        .eq('id', project.cliente_id);

      if (clientUpdateError) {
        console.error('Erro ao sincronizar status do cliente:', clientUpdateError.message);
      }
    }
  }

  const { error } = await db.from('projetos')
    .update(updateData)
    .eq('id', projetoId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/financeiro');
  return true;
}

export async function removeOrcamentoLink(projetoId: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('projetos')
    .update({ orcamento_pdf_url: null, orcamento_arquivado: false })
    .eq('id', projetoId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/financeiro');
  return true;
}
