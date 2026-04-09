'use server';

import { createUserClient } from '@/lib/supabaseUserClient';
import { requireAuth } from '@/lib/requireAuth';
import { revalidatePath } from 'next/cache';

// --- ENGINE ALERTA VERMELHO (VIGILÂNCIA PROATIVA) ---

export async function runVigilanceEngine() {
  await requireAuth();
  const db = await createUserClient();

  const fortyEightHoursFromNow = new Date();
  fortyEightHoursFromNow.setHours(fortyEightHoursFromNow.getHours() + 48);
  const dateLimit = fortyEightHoursFromNow.toISOString().split('T')[0];

  const { data: projetosPerigo } = await db
    .from('projetos')
    .select('id, nome, servicos_fechados, tipo_servico, prazo_entrega')
    .lt('prazo_entrega', dateLimit)
    .neq('status_producao', 'Entregue');

  for (const p of projetosPerigo || []) {
    const projetoNome = p.nome || p.servicos_fechados || p.tipo_servico || 'Sem Nome';
    await upsertAlert(
      db,
      `🆘 Prazo Crítico: ${projetoNome}`,
      `O projeto está a menos de 48h do prazo final (${p.prazo_entrega}) e ainda não foi entregue.`,
      `/admin/projetos/${p.id}`,
      p.id
    );
  }

  const seventyTwoHoursAgo = new Date();
  seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

  const { data: tarefasEstagnadas } = await db
    .from('tarefas_terceirizados')
    .select('id, projeto_id, projetos(nome, servicos_fechados, tipo_servico), terceirizados(nome), updated_at')
    .lt('updated_at', seventyTwoHoursAgo.toISOString())
    .neq('status_etapa_atual', 'Concluído');

  for (const t of tarefasEstagnadas || []) {
    const proj = (t.projetos as { nome?: string; servicos_fechados?: string; tipo_servico?: string } | null);
    const projetoNome = proj?.nome || proj?.servicos_fechados || proj?.tipo_servico || 'Projeto';
    const parceiroNome = (t.terceirizados as { nome?: string } | null)?.nome || 'Terceiro';
    await upsertAlert(
      db,
      `⚠️ Estagnação: ${parceiroNome}`,
      `A tarefa vinculada ao projeto ${projetoNome} não recebe atualizações há mais de 72h.`,
      `/admin/projetos/${t.projeto_id}`,
      t.projeto_id
    );
  }

  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const { data: tarefasAprovacao } = await db
    .from('tarefas_terceirizados')
    .select('id, projeto_id, projetos(nome, servicos_fechados, tipo_servico), updated_at')
    .eq('status_etapa_atual', 'Aguardando Aprovação')
    .lt('updated_at', twentyFourHoursAgo.toISOString());

  for (const t of tarefasAprovacao || []) {
    const proj = (t.projetos as { nome?: string; servicos_fechados?: string; tipo_servico?: string } | null);
    const projetoNome = proj?.nome || proj?.servicos_fechados || proj?.tipo_servico || 'Projeto';
    await upsertAlert(
      db,
      `⏳ Aprovação Pendente: ${projetoNome}`,
      `Uma entrega está aguardando sua revisão há mais de 24h.`,
      `/admin/projetos/${t.projeto_id}`,
      t.projeto_id
    );
  }

  revalidatePath('/');
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertAlert(db: any, titulo: string, mensagem: string, link: string, projeto_id?: string) {
  let query = db.from('notificacoes').select('id').eq('titulo', titulo).eq('lida', false);
  if (projeto_id) {
    query = query.eq('projeto_id', projeto_id);
  } else {
    query = query.eq('link', link);
  }
  const { data: existente } = await query.maybeSingle();
  if (!existente) {
    const { error } = await db.from('notificacoes').insert([{ titulo, mensagem, link, projeto_id }]);
    if (error) console.error('Error inserting alert:', error.message);
  }
}

export async function clearAllNotifications() {
  await requireAuth();
  const db = await createUserClient();
  await db.from('notificacoes').delete().eq('lida', false);
  revalidatePath('/', 'layout');
  revalidatePath('/admin/database');
}

export async function getNotifications() {
  await requireAuth();
  const db = await createUserClient();
  const { data } = await db
    .from('notificacoes')
    .select('*, projetos(id)')
    .order('created_at', { ascending: false })
    .limit(8);
  return (data || []).filter((n: { projeto_id?: string; projetos?: unknown }) => !n.projeto_id || n.projetos !== null);
}

export async function getUnreadCount() {
  await requireAuth();
  const db = await createUserClient();
  const { count } = await db
    .from('notificacoes')
    .select('*', { count: 'exact', head: true })
    .eq('lida', false);
  return count || 0;
}

export async function markAsRead(id: string) {
  await requireAuth();
  const db = await createUserClient();
  await db.from('notificacoes').update({ lida: true }).eq('id', id);
  revalidatePath('/');
}

export async function getAlertedProjectIds() {
  await requireAuth();
  const db = await createUserClient();
  const { data } = await db
    .from('notificacoes')
    .select('link')
    .eq('lida', false)
    .ilike('link', '/admin/projetos/%');
  return (data || []).map((n: { link?: string }) => n.link?.split('/').pop()).filter(Boolean);
}

export async function sendMorningDigest() {
  await requireAuth();
  const db = await createUserClient();
  const { data: alerts } = await db.from('notificacoes').select('*').eq('lida', false);

  if (!alerts || alerts.length === 0) {
    return { success: true, message: 'Nenhum alerta pendente.' };
  }

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #1e293b; background: #0f172a; color: #fff; border-radius: 12px;">
      <h2 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">🔴 Alerta Vermelho: Our Dreams Studio</h2>
      <p style="color: #94a3b8;">Consolidado de Vigilância Proativa - ${new Date().toLocaleDateString()}</p>
      <div style="margin: 20px 0;">
        ${(alerts as Array<{ titulo: string; mensagem: string }>).map(a => `
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #ef4444;">
            <strong style="display: block; font-size: 16px; margin-bottom: 5px;">${a.titulo}</strong>
            <p style="font-size: 14px; color: #cbd5e1; margin: 0;">${a.mensagem}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  return { success: true, message: `Consolidado enviado com ${alerts.length} alertas.`, html: htmlBody };
}
