import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function verifyMercadoPagoSignature(request: Request, rawBody: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  // If no secret is configured, skip verification (but log it)
  if (!secret) {
    console.warn('[WEBHOOK PAYMENT] MERCADOPAGO_WEBHOOK_SECRET não definida. Verificação de assinatura ignorada.');
    return true;
  }

  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');

  if (!xSignature) {
    console.warn('[WEBHOOK PAYMENT] Header x-signature ausente.');
    return false;
  }

  // Parse ts and v1 from x-signature
  const parts = Object.fromEntries(
    xSignature.split(',').map(p => {
      const eqIdx = p.indexOf('=');
      if (eqIdx === -1) return [p.trim(), ''];
      return [p.substring(0, eqIdx).trim(), p.substring(eqIdx + 1).trim()];
    })
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];

  if (!ts || !v1) {
    console.warn('[WEBHOOK PAYMENT] Timestamp (ts) ou hash (v1) ausentes no x-signature.');
    return false;
  }

  // Extract data.id (which represents the resource ID, e.g. payment ID)
  // 1. Try from URL search params
  const url = new URL(request.url);
  let dataId = url.searchParams.get('data.id');

  // 2. Try from JSON body
  if (!dataId) {
    try {
      const parsed = JSON.parse(rawBody);
      // It can be under data.id or data.data.id or id
      dataId = parsed.data?.id || parsed.id;
    } catch (e) {
      // Ignore parse errors, body might not be JSON
    }
  }

  const formattedDataId = dataId ? String(dataId).toLowerCase() : '';

  const manifest = `id:${formattedDataId};request-id:${xRequestId || ''};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'utf-8'), Buffer.from(v1, 'utf-8'));
  } catch (err) {
    // If lengths are different, timingSafeEqual throws an error
    return false;
  }
}

export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('[WEBHOOK PAYMENT] SUPABASE_SERVICE_ROLE_KEY não definida.');
    return NextResponse.json({ success: false, error: 'Configuração ausente.' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const rawBody = await request.text();

    // Validate Mercado Pago signature
    if (!verifyMercadoPagoSignature(request, rawBody)) {
      console.warn('[WEBHOOK PAYMENT] Assinatura inválida — requisição rejeitada.');
      return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 });
    }

    const data = JSON.parse(rawBody);
    
    // Log the payload (sem dados sensíveis)
    console.log('[WEBHOOK PAYMENT] Payload tipo:', data.type, '| id:', data.data?.id);

    let externalReference = null;
    let isPaymentConfirmed = false;

    // 1. MERCADO PAGO WEBHOOK (IPN or Webhook)
    if (data.type === 'payment' || (data.topic === 'payment')) {
      const paymentId = data.data?.id || data.resource?.split('/').pop();
      if (paymentId) {
        // Fetch the actual payment from Mercado Pago to check status and get external_reference
        const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (mpToken) {
          const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${mpToken}` }
          });
          if (mpResponse.ok) {
            const paymentData = await mpResponse.json();
            if (paymentData.status === 'approved') {
              isPaymentConfirmed = true;
              externalReference = paymentData.external_reference;
            }
          }
        }
      }
    } 
    // 2. ASAAS / STRIPE (Fallback Genérico mantido)
    else {
      externalReference = data.externalReference || data.data?.externalReference || data.data?.object?.client_reference_id;
      isPaymentConfirmed = data.event === 'PAYMENT_RECEIVED' || data.event === 'PAYMENT_CONFIRMED' || data.type === 'checkout.session.completed';
    }

    if (!isPaymentConfirmed) {
      return NextResponse.json({ message: 'Evento ignorado (não é confirmação de pagamento aprovado).' }, { status: 200 });
    }

    if (!externalReference) {
      return NextResponse.json({ error: 'Nenhuma referência de projeto encontrada no payload.' }, { status: 400 });
    }

    // Limpar o prefixo 'mock-' se existir (para testes antigos)
    const projetoId = externalReference.replace('mock-', '');

    const { data: project, error: fetchError } = await supabase
      .from('projetos')
      .select('id, status_producao, cliente_id')
      .eq('id', projetoId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 });
    }

    const updates = {
      sinal_pago: true,
      status_funil: 'Fechado',
      status_producao: project.status_producao || 'Definição de Escopo',
      // Automatismo: após sinal pago, o link já aponta para pagamento final
      link_tipo_pagamento: 'entrega'
    };

    const { error: updateError } = await supabase
      .from('projetos')
      .update(updates)
      .eq('id', projetoId);

    if (updateError) {
      console.error('[WEBHOOK PAYMENT] Erro ao atualizar projeto:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Sincronizar o status do cliente
    if (project.cliente_id) {
      await supabase
        .from('clientes')
        .update({ status_funil: 'Concluído/Produção' })
        .eq('id', project.cliente_id);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Pagamento confirmado e projeto atualizado para Fechado.' 
    });

  } catch (error: any) {
    console.error('[WEBHOOK PAYMENT] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}
