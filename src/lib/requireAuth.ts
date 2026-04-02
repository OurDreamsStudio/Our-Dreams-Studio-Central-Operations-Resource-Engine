import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Valida a sessão do usuário dentro de uma Server Action.
 * Lança um erro se não houver usuário autenticado.
 *
 * Uso:
 *   await requireAuth();
 *
 * Isso garante que nenhuma mutação prossiga sem uma sessão válida,
 * sem depender do supabaseServer (service role), que bypassa a autenticação.
 */
export async function requireAuth(): Promise<void> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server Actions não precisam setar cookies na resposta neste contexto
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Acesso negado: Usuário não autenticado.');
  }
}
