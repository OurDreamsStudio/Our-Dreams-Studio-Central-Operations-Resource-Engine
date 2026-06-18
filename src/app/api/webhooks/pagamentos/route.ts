import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('[WEBHOOK PAYMENT] SUPABASE_SERVICE_ROLE_KEY não definida.');
    return NextResponse.json({ success: false, error: 'Configuração ausente.' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const data = await request.json();
    
    // Log the payload to help debugging later
    console.log('[WEBHOOK PAYMENT] Payload recebido:', JSON.stringify(data));

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
      status_producao: project.status_producao || 'Definição de Escopo'
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
