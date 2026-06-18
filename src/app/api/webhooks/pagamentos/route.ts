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
    
    // Suporte genérico para mock/asaas/stripe
    // Vamos assumir que a referência externa traz o ID do projeto ou token
    // Exemplo: externalReference: 'mock-uuid-do-projeto' ou checkout.session.completed (stripe)
    const externalReference = data.externalReference || data.data?.externalReference || data.data?.object?.client_reference_id;
    const isPaymentConfirmed = data.event === 'PAYMENT_RECEIVED' || data.event === 'PAYMENT_CONFIRMED' || data.type === 'checkout.session.completed';

    if (!externalReference) {
      return NextResponse.json({ error: 'Nenhuma referência de projeto encontrada no payload.' }, { status: 400 });
    }

    if (!isPaymentConfirmed) {
      return NextResponse.json({ message: 'Evento ignorado (não é confirmação de pagamento).' }, { status: 200 });
    }

    // Limpar o prefixo 'mock-' se existir
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
