'use server';

export async function triggerRescueFlow(whatsappNumber: string) {
  try {
    // Limpa o número para deixar apenas os dígitos
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    
    if (!cleanNumber || cleanNumber.length < 10) {
      throw new Error("Número de WhatsApp inválido. Digite no formato DDD + Número.");
    }

    // Tenta pegar a URL do .env, caso não exista usa a URL de teste (útil para desenvolvimento)
    const webhookUrl = process.env.N8N_RESCUE_WEBHOOK_URL || 'https://violet-thalamencephalic-whizzingly.ngrok-free.dev/webhook-test/8f10e5c3-f48f-41ce-9f30-e2821f328a52';

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Envia o número em vários formatos para garantir compatibilidade
        whatsapp_id: `55${cleanNumber}@s.whatsapp.net`, 
        remoteJid: `55${cleanNumber}@s.whatsapp.net`,
        // Simula exatamente o texto que o fluxo do n8n espera para iniciar a cadência!
        conversation: 'Olá, quero dar continuidade',
        message: {
          conversation: 'Olá, quero dar continuidade'
        },
        data: {
          message: {
            conversation: 'Olá, quero dar continuidade',
            key: {
              remoteJid: `55${cleanNumber}@s.whatsapp.net`
            }
          }
        },
        source: 'ThePulse_RescueMode'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro no n8n: ${response.status} - ${errorText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao disparar Rescue Flow:", error);
    return { success: false, error: error.message || "Erro desconhecido ao comunicar com o n8n." };
  }
}
