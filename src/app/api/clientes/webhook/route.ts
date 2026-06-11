import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Helper para sanitizar o whatsapp_id (deixa apenas números)
function sanitizeWhatsApp(id: string | null | undefined): string | null {
  if (!id) return null;
  const sanitized = id.replace(/\D/g, '');
  return sanitized.length > 0 ? sanitized : null;
}

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
      nome_pessoal,
      status_funil // Permite definir a etapa dinamicamente (ex: 'Inbound WhatsApp', 'Áudios Primordiais Enviados', 'Diagnóstico Preenchido')
    } = data;

    const sanitizedWhatsappId = sanitizeWhatsApp(whatsapp_id);

    if (!sanitizedWhatsappId && !instagram) {
      return NextResponse.json({ error: 'É necessário fornecer pelo menos whatsapp_id ou instagram para identificar o cliente.' }, { status: 400 });
    }

    // 1. Tentar encontrar cliente existente
    let existingClient = null;

    if (sanitizedWhatsappId) {
      const { data: clientByWa } = await supabase
        .from('clientes')
        .select('id')
        .eq('whatsapp_id', sanitizedWhatsappId)
        .maybeSingle();
      existingClient = clientByWa;
    }

    if (!existingClient && instagram) {
      const { data: clientByIg } = await supabase
        .from('clientes')
        .select('id')
        .eq('instagram', instagram)
        .maybeSingle();
      existingClient = clientByIg;
    }

    const targetStatusFunil = status_funil || 'Inbound WhatsApp';

    const clientFields: Record<string, any> = {};
    if (instagram !== undefined) clientFields.instagram = instagram || null;
    if (sanitizedWhatsappId !== undefined) clientFields.whatsapp_id = sanitizedWhatsappId || null;
    if (diag_status_arquivos !== undefined) clientFields.diag_status_arquivos = diag_status_arquivos || null;
    if (diag_nivel_experiencia !== undefined) clientFields.diag_nivel_experiencia = diag_nivel_experiencia || null;
    if (diag_servico_interesse !== undefined) clientFields.diag_servico_interesse = diag_servico_interesse || null;
    if (diag_capacidade_investimento !== undefined) clientFields.diag_capacidade_investimento = diag_capacidade_investimento || null;
    if (nome_artistico !== undefined) clientFields.nome_artistico = nome_artistico || null;
    if (nome_pessoal !== undefined) clientFields.nome_pessoal = nome_pessoal || null;
    if (targetStatusFunil !== undefined) clientFields.status_funil = targetStatusFunil;

    let clientId = null;
    let operation = '';

    if (existingClient?.id) {
      // Atualizar cliente existente
      const { data: updateData, error: updateError } = await supabase
        .from('clientes')
        .update(clientFields)
        .eq('id', existingClient.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('Error updating client:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      clientId = updateData.id;
      operation = 'updated';
    } else {
      // Inserir novo cliente
      const { data: insertData, error: insertError } = await supabase
        .from('clientes')
        .insert([clientFields])
        .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting client:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      clientId = insertData.id;
      operation = 'inserted';
    }

    return NextResponse.json({ 
      success: true, 
      clientId, 
      operation,
      message: `Lead processado com sucesso. Status atual: ${targetStatusFunil}` 
    });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
