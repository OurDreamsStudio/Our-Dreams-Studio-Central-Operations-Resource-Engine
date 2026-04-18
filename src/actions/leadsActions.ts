'use server';

import { createClient } from '@supabase/supabase-js';
import { createUserClient } from '@/lib/supabaseUserClient';
import { requireAuth } from '@/lib/requireAuth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Cliente anônimo para inserção pública (landing page não tem sessão)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const LeadSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(255),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  whatsapp: z.string().max(30).optional().or(z.literal('')),
  mensagem: z.string().max(2000).optional().or(z.literal('')),
});

// --- PUBLIC ACTION (sem autenticação) ---
export async function submitLead(formData: {
  nome: string;
  email: string;
  whatsapp: string;
  mensagem: string;
}) {
  const parsed = LeadSchema.safeParse(formData);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0].message);
  }

  const { nome, email, whatsapp, mensagem } = parsed.data;

  const { error } = await supabaseAnon.from('leads').insert([{
    nome,
    email: email || null,
    whatsapp: whatsapp || null,
    mensagem: mensagem || null,
  }]);

  if (error) throw new Error('Erro ao enviar formulário: ' + error.message);
  return { success: true };
}

// --- ADMIN ACTIONS (autenticados) ---
export async function getLeads() {
  await requireAuth();
  const db = await createUserClient();
  const { data, error } = await db
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function marcarLeadComoLido(id: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('leads').update({ lido: true }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/leads');
}

export async function deleteLead(id: string) {
  await requireAuth();
  const db = await createUserClient();
  const { error } = await db.from('leads').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/leads');
}
