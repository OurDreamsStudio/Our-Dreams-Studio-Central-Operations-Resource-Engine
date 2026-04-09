import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * [SEGURANÇA] Cria um cliente Supabase autenticado com a sessão do usuário.
 * 
 * Usa a ANON_KEY (não a service_role), portanto TODAS as políticas de RLS
 * do banco de dados são RESPEITADAS e o Supabase valida o JWT do usuário.
 * 
 * Use este client em Server Actions em vez do `supabaseServer` (God Mode).
 */
export async function createUserClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Actions can sometimes not set cookies in read-only contexts
          }
        },
      },
    }
  );
}

/**
 * [SEGURANÇA] Cria o cliente God Mode (service_role) para webhooks e tarefas de sistema.
 * NÃO USE em Server Actions chamadas pelo usuário.
 * USE apenas em: API routes de sistema (ex: /api/clientes/webhook)
 */
export { supabaseServer as supabaseSystem } from '@/lib/supabaseServer';
