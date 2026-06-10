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
