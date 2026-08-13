'use server';

import { supabaseServer } from '@/lib/supabaseServer';

export async function getPublicProject(token: string) {
  // 1. Tentar buscar pelo public_token
  let { data, error } = await supabaseServer
    .from('projetos')
    .select(`
      id,
      tipo_servico,
      status_producao,
      prazo_entrega,
      servicos_fechados,
      valor_fechado,
      sinal_pago,
      entrega_paga,
      link_tipo_pagamento,
      public_token,
      referencias,
      link_arquivos,
      data_aprovacao,
      motivo_revisao,
      contador_revisoes,
      revisoes_disponiveis,
      historico_revisoes,
      cliente_aprovado,
      clientes (
        nome_artistico,
        nome_pessoal,
        anotacoes
      ),
      projeto_entregaveis (
        id,
        nome_servico,
        valor,
        status_producao,
        link_arquivos,
        prazo_entrega,
        checklist_preparacao,
        contador_revisoes,
        revisoes_disponiveis
      )
    `)
    .eq('public_token', token)
    .maybeSingle();

  // 2. Se não encontrar, ou se o token passado for o ID direto do projeto (fallback de contingência)
  if (!data) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
    if (isUuid) {
      const { data: fallbackData } = await supabaseServer
        .from('projetos')
        .select(`
          id,
          tipo_servico,
          status_producao,
          prazo_entrega,
          servicos_fechados,
          valor_fechado,
          sinal_pago,
          entrega_paga,
          link_tipo_pagamento,
          public_token,
          referencias,
          link_arquivos,
          data_aprovacao,
          motivo_revisao,
          contador_revisoes,
          revisoes_disponiveis,
          historico_revisoes,
          cliente_aprovado,
          clientes (
            nome_artistico,
            nome_pessoal,
            anotacoes
          ),
          projeto_entregaveis (
            id,
            nome_servico,
            valor,
            status_producao,
            link_arquivos,
            prazo_entrega,
            checklist_preparacao,
            contador_revisoes,
            revisoes_disponiveis
          )
        `)
        .eq('id', token)
        .maybeSingle();
      
      if (fallbackData) return fallbackData;
    }
  }

  if (error && !data) throw new Error(error.message);
  return data;
}

export async function getPublicTask(token: string) {
  const { data, error } = await supabaseServer
    .from('tarefas_terceirizados')
    .select(`
      id,
      descricao_tarefa,
      prazo_entrega,
      status_entrega,
      roadmap_etapas,
      etapa_atual_index,
      status_etapa_atual,
      motivo_revisao_etapa,
      link_entrega,
      projetos (
        tipo_servico,
        clientes (
          nome_artistico
        )
      )
    `)
    .eq('public_token', token)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getPublicProposal(token: string) {
  const { data, error } = await supabaseServer
    .from('projetos')
    .select(`
      id,
      tipo_servico,
      servicos_fechados,
      valores_servicos,
      valor_fechado,
      sinal_pago,
      entrega_paga,
      link_tipo_pagamento,
      status_funil,
      clientes (
        nome_artistico,
        nome_pessoal
      )
    `)
    .eq('public_token', token)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function gerarCheckout(token: string) {
  const projeto = await getPublicProposal(token);
  if (!projeto) throw new Error('Projeto não encontrado');

  const valorTotal = projeto.valor_fechado || 0;
  const valorParcela = valorTotal / 2;

  // Determina o tipo de cobrança: sinal (50% inicial) ou entrega (50% final)
  const tipoLink = projeto.link_tipo_pagamento || 'sinal';
  const isSinal = tipoLink === 'sinal';

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('Chave do Mercado Pago não configurada. Adicione MERCADOPAGO_ACCESS_TOKEN no .env.local');
  }

  const client = new MercadoPagoConfig({ accessToken });
  const preference = new Preference(client);

  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  if (baseUrl.includes('localhost')) {
    baseUrl = 'https://www.mercadopago.com.br'; // Fallback for MP validation
  }

  const itemTitle = isSinal
    ? `Sinal (50%) - ${projeto.tipo_servico || projeto.servicos_fechados || 'Projeto'}`
    : `Pagamento Final (50%) - ${projeto.tipo_servico || projeto.servicos_fechados || 'Projeto'}`;

  const response = await preference.create({
    body: {
      items: [
        {
          id: projeto.id,
          title: itemTitle,
          quantity: 1,
          unit_price: valorParcela,
          currency_id: 'BRL',
        }
      ],
      external_reference: projeto.id,
      back_urls: {
        success: `${baseUrl}/p/${token}`,
        failure: `${baseUrl}/proposta/${token}`,
        pending: `${baseUrl}/p/${token}`
      },
      auto_return: 'approved',
    }
  });

  return response.init_point!;
}

export async function adicionarReferenciaProjeto(token: string, novaReferencia: any) {
  // Pega as referências atuais
  const { data: projeto, error: fetchError } = await supabaseServer
    .from('projetos')
    .select('id, referencias')
    .eq('public_token', token)
    .single();

  if (fetchError || !projeto) throw new Error('Projeto não encontrado');

  const referenciasAtuais = Array.isArray(projeto.referencias) ? projeto.referencias : [];
  const referenciasAtualizadas = [...referenciasAtuais, novaReferencia];

  const { error: updateError } = await supabaseServer
    .from('projetos')
    .update({ referencias: referenciasAtualizadas })
    .eq('id', projeto.id);

  if (updateError) throw new Error(updateError.message);
  return referenciasAtualizadas;
}

export async function removerReferenciaProjeto(token: string, idReferencia: string) {
  const { data: projeto, error: fetchError } = await supabaseServer
    .from('projetos')
    .select('id, referencias')
    .eq('public_token', token)
    .single();

  if (fetchError || !projeto) throw new Error('Projeto não encontrado');

  const referenciasAtuais = Array.isArray(projeto.referencias) ? projeto.referencias : [];
  const referenciasAtualizadas = referenciasAtuais.filter((ref: any) => ref.id !== idReferencia);

  const { error: updateError } = await supabaseServer
    .from('projetos')
    .update({ referencias: referenciasAtualizadas })
    .eq('id', projeto.id);

  if (updateError) throw new Error(updateError.message);
  return referenciasAtualizadas;
}
