'use server';

import { supabaseServer } from '@/lib/supabaseServer';

export async function getPublicProject(token: string) {
  const { data, error } = await supabaseServer
    .from('projetos')
    .select(`
      id,
      tipo_servico,
      status_producao,
      prazo_entrega,
      servicos_fechados,
      link_arquivos,
      data_aprovacao,
      motivo_revisao,
      contador_revisoes,
      revisoes_disponiveis,
      historico_revisoes,
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
  if (projeto.sinal_pago) throw new Error('Sinal já foi pago');

  const valorTotal = projeto.valor_fechado || 0;
  const valorSinal = valorTotal / 2;

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

  const response = await preference.create({
    body: {
      items: [
        {
          id: projeto.id,
          title: `Sinal (50%) - ${projeto.tipo_servico || projeto.servicos_fechados || 'Projeto'}`,
          quantity: 1,
          unit_price: valorSinal,
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
