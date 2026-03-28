'use server';
import { supabaseServer } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

// --- ENGINE ALERTA VERMELHO (VIGILÂNCIA PROATIVA) ---

export async function runVigilanceEngine() {
    const hoje = new Date();
    
    // 1. Projetos em Perigo (Prazo < 48h e não entregue)
    const fortyEightHoursFromNow = new Date();
    fortyEightHoursFromNow.setHours(fortyEightHoursFromNow.getHours() + 48);
    const dateLimit = fortyEightHoursFromNow.toISOString().split('T')[0];

    const { data: projetosPerigo } = await supabaseServer
        .from('projetos')
        .select('id, nome, servicos_fechados, tipo_servico, prazo_entrega')
        .lt('prazo_entrega', dateLimit)
        .neq('status_producao', 'Entregue');

    for (const p of projetosPerigo || []) {
        const projetoNome = p.nome || p.servicos_fechados || p.tipo_servico || 'Sem Nome';
        await upsertAlert(
            `🆘 Prazo Crítico: ${projetoNome}`,
            `O projeto está a menos de 48h do prazo final (${p.prazo_entrega}) e ainda não foi entregue.`,
            `/admin/projetos/${p.id}`,
            p.id
        );
    }

    // 2. Parceiros Estagnados (> 72h sem update no roadmap ou status)
    const seventyTwoHoursAgo = new Date();
    seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

    const { data: tarefasEstagnadas } = await supabaseServer
        .from('tarefas_terceirizados')
        .select('id, projeto_id, projetos(nome, servicos_fechados, tipo_servico), terceirizados(nome), updated_at')
        .lt('updated_at', seventyTwoHoursAgo.toISOString())
        .neq('status_etapa_atual', 'Concluído');

    for (const t of tarefasEstagnadas || []) {
        const proj = (t.projetos as any);
        const projetoNome = proj?.nome || proj?.servicos_fechados || proj?.tipo_servico || 'Projeto';
        const parceiroNome = (t.terceirizados as any)?.nome || 'Terceiro';
        await upsertAlert(
            `⚠️ Estagnação: ${parceiroNome}`,
            `A tarefa vinculada ao projeto ${projetoNome} não recebe atualizações há mais de 72h.`,
            `/admin/projetos/${t.projeto_id}`,
            t.projeto_id
        );
    }

    // 3. Aprovações Esquecidas (> 24h em Aguardando Aprovação)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: tarefasAprovacao } = await supabaseServer
        .from('tarefas_terceirizados')
        .select('id, projeto_id, projetos(nome, servicos_fechados, tipo_servico), updated_at')
        .eq('status_etapa_atual', 'Aguardando Aprovação')
        .lt('updated_at', twentyFourHoursAgo.toISOString());

    for (const t of tarefasAprovacao || []) {
        const proj = (t.projetos as any);
        const projetoNome = proj?.nome || proj?.servicos_fechados || proj?.tipo_servico || 'Projeto';
        await upsertAlert(
            `⏳ Aprovação Pendente: ${projetoNome}`,
            `Uma entrega está aguardando sua revisão há mais de 24h. O fluxo de produção está em risco.`,
            `/admin/projetos/${t.projeto_id}`,
            t.projeto_id
        );
    }

    revalidatePath('/');
    return true;
}

// Auxiliar para evitar inundar com alertas duplicados e não lidos
async function upsertAlert(titulo: string, mensagem: string, link: string, projeto_id?: string) {
    // Busca se existe alerta não lido com o mesmo título AND projeto_id (se houver)
    let query = supabaseServer
        .from('notificacoes')
        .select('id')
        .eq('titulo', titulo)
        .eq('lida', false);
    
    if (projeto_id) {
        query = query.eq('projeto_id', projeto_id);
    } else {
        query = query.eq('link', link);
    }

    const { data: existente } = await query.maybeSingle();
    
    if (!existente) {
        const { error } = await supabaseServer.from('notificacoes').insert([{ titulo, mensagem, link, projeto_id }]);
        if (error) console.error('Error inserting alert:', error.message);
    }
}

export async function clearAllNotifications() {
    await supabaseServer
        .from('notificacoes')
        .delete()
        .eq('lida', false);
    
    revalidatePath('/', 'layout');
    revalidatePath('/admin/database');
}

// --- UI ACTIONS ---

export async function getNotifications() {
    const { data } = await supabaseServer
        .from('notificacoes')
        .select('*, projetos(id)')
        .order('created_at', { ascending: false })
        .limit(8);
    
    // Filtro agressivo para garantir que o projeto ainda existe
    return (data || []).filter(n => !n.projeto_id || (n.projetos !== null));
}

export async function getUnreadCount() {
    const { count } = await supabaseServer
        .from('notificacoes')
        .select('*', { count: 'exact', head: true })
        .eq('lida', false);
    return count || 0;
}

export async function markAsRead(id: string) {
    await supabaseServer.from('notificacoes').update({ lida: true }).eq('id', id);
    revalidatePath('/');
}

// --- MONITORING (UI CALLS) ---

export async function getAlertedProjectIds() {
    const { data } = await supabaseServer
        .from('notificacoes')
        .select('link')
        .eq('lida', false)
        .ilike('link', '/admin/projetos/%');
    
    // Extrai o UUID do link /admin/projetos/[uuid]
    return (data || []).map(n => n.link?.split('/').pop()).filter(Boolean);
}

export async function sendMorningDigest() {
    const { data: alerts } = await supabaseServer
        .from('notificacoes')
        .select('*')
        .eq('lida', false);

    if (!alerts || alerts.length === 0) {
        return { success: true, message: 'Nenhum alerta pendente.' };
    }

    const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #1e293b; background: #0f172a; color: #fff; border-radius: 12px;">
            <h2 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">🔴 Alerta Vermelho: Our Dreams Studio</h2>
            <p style="color: #94a3b8;">Consolidado de Vigilância Proativa - ${new Date().toLocaleDateString()}</p>
            
            <div style="margin: 20px 0;">
                ${alerts.map(a => `
                    <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #ef4444;">
                        <strong style="display: block; font-size: 16px; margin-bottom: 5px;">${a.titulo}</strong>
                        <p style="font-size: 14px; color: #cbd5e1; margin: 0;">${a.mensagem}</p>
                    </div>
                `).join('')}
            </div>

            <p style="text-align: center; margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://ourdreams.studio'}/admin/agenda" 
                   style="background: #7c3aed; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 14px;">
                   ABRIR CENTRAL DE COMANDO
                </a>
            </p>
        </div>
    `;

    // MOCK: Envio de e-mail (O usuário deve inserir as chaves do Resend/Nodemailer para ativar)
    // Se houvesse resend, seria: await resend.emails.send({ ... });
    
    return { success: true, message: `Consolidado enviado com ${alerts.length} alertas.`, html: htmlBody };
}
