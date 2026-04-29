import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapeamento EXATO das strings que chegam do n8n → Pontuação
const SCORING: Record<string, Record<string, number>> = {
  diag_status_arquivos: {
    'Sim, tenho todos os arquivos em WAV.': 20,
    'Não, ainda não gravei as vozes.': 30,
    'Não, mas tenho uma Sessão em Studio agendada para breve.': 5,
    'Não tenho instrução/conhecimento adequado para realizar a Captação.': 10,
    'Meus arquivos estão no BandLab.': 40,
  },
  diag_nivel_experiencia: {
    'Sim, é meu primeiro projeto profissional.': 40,
    'Não, já realizei projetos com Produtores Conceituados.': 10,
    'Em partes; já produzi com produtores com menos experiência.': 30,
    'Eu mesmo produzo meus sons.': 5,
  },
  diag_servico_interesse: {
    'Captação em Studio.': 30,
    'Mixagem/Masterização.': 40,
    'Beat.': 20,
    'Edição de Vídeo ou Visualizer.': 30,
    'Edição de Imagem, Flyer.': 20,
    'Pacote com 2 ou mais Serviços.': 40,
    'Ainda não decidi, busco orientação.': 15,
  },
  diag_capacidade_investimento: {
    'R$0 - R$50': 5,
    'R$51 - R$200': 20,
    'R$201 - R$500': 40,
    'R$501 - R$1000+': 60,
  },
};

function calcularScore(cliente: Record<string, string>): { score: number; temperature: string } {
  let score = 0;

  for (const [coluna, mapa] of Object.entries(SCORING)) {
    const valorCliente = cliente[coluna];
    if (valorCliente && mapa[valorCliente] !== undefined) {
      score += mapa[valorCliente];
    }
  }

  // Máximo possível: 180 pts. Hot >= 100, Warm 60-99, Cold < 60
  let temperature = 'Cold';
  if (score >= 100) temperature = 'Hot';
  else if (score >= 60) temperature = 'Warm';

  return { score, temperature };
}

export async function POST(req: Request) {
  try {
    // 1. Validar Secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { whatsapp_id } = body;

    if (!whatsapp_id) {
      return NextResponse.json({ error: 'whatsapp_id é obrigatório' }, { status: 400 });
    }

    // 2. Buscar cliente no Supabase pelo whatsapp_id
    const { data: cliente, error: fetchError } = await supabaseAdmin
      .from('clientes')
      .select('id, diag_status_arquivos, diag_nivel_experiencia, diag_servico_interesse, diag_capacidade_investimento')
      .eq('whatsapp_id', whatsapp_id)
      .single();

    if (fetchError || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado para este whatsapp_id' }, { status: 404 });
    }

    // 3. Calcular Score e Temperatura
    const { score, temperature } = calcularScore(cliente as Record<string, string>);

    // 4. Salvar score e temperature de volta no registro do cliente
    const { error: updateError } = await supabaseAdmin
      .from('clientes')
      .update({ score, temperature } as any)
      .eq('id', cliente.id);

    if (updateError) {
      console.error('Erro ao atualizar score do cliente:', updateError);
      // Não retornamos erro fatal aqui pois o scoring foi calculado
    }

    // 5. Retornar síncrono para o n8n rotear a mensagem
    return NextResponse.json({
      success: true,
      whatsapp_id,
      score,
      temperature,
      message: `Lead processado. Temperatura: ${temperature} (${score} pts)`
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('Webhook Lead Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
