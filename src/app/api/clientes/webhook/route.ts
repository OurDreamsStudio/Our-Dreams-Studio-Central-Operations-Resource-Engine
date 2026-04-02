import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('[WEBHOOK] SUPABASE_SERVICE_ROLE_KEY não definida. Execução abortada.');
    return NextResponse.json(
      { success: false, error: 'Variável de ambiente crítica SUPABASE_SERVICE_ROLE_KEY não encontrada.' },
      { status: 500 }
    );
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[WEBHOOK] WEBHOOK_SECRET não definida. Execução abortada.');
    return NextResponse.json(
      { success: false, error: 'Variável de ambiente crítica WEBHOOK_SECRET não encontrada.' },
      { status: 500 }
    );
  }

  const incomingSecret = request.headers.get('x-webhook-secret');

  if (!incomingSecret || incomingSecret !== webhookSecret) {
    console.warn('[WEBHOOK] Tentativa de acesso com assinatura inválida ou ausente.');
    return NextResponse.json(
      { success: false, error: 'Acesso negado: assinatura de webhook inválida.' },
      { status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const data = await request.json();
    
    // Payload esperado do n8n
    const {
      instagram,
      whatsapp_id,
      diag_status_arquivos,
      diag_nivel_experiencia,
      diag_servico_interesse,
      diag_capacidade_investimento,
      nome_artistico,
      nome_pessoal
    } = data;

    if (!instagram) {
      return NextResponse.json({ error: 'Instagram is required for upsert' }, { status: 400 });
    }

    // 1. Upsert do cliente baseado no instagram
    const { data: upsertData, error: upsertError } = await supabase
      .from('clientes')
      .upsert({
        instagram,
        whatsapp_id: whatsapp_id || null,
        diag_status_arquivos: diag_status_arquivos || null,
        diag_nivel_experiencia: diag_nivel_experiencia || null,
        diag_servico_interesse: diag_servico_interesse || null,
        diag_capacidade_investimento: diag_capacidade_investimento || null,
        nome_artistico: nome_artistico || null,
        nome_pessoal: nome_pessoal || null,
        status_funil: 'Diagnóstico Preenchido' // Define o status de Lead sem criar projeto
      }, { onConflict: 'instagram' })
      .select('id')
      .single();

    if (upsertError) {
      console.error('Error in upsert:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const clientId = upsertData.id;

    return NextResponse.json({ success: true, clientId, message: 'Lead capturado com sucesso (sem projeto fantasma)' });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
