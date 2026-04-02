'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type LoginState = {
  error: string | null;
} | null;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/';

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Grava os cookies de sessão na resposta HTTP do servidor.
          // Isso é o que permite ao proxy.ts ler a sessão na próxima requisição.
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Retorna o erro ao cliente — NÃO redireciona
    return { error: 'E-mail ou senha incorretos. Verifique suas credenciais.' };
  }

  // Redireciona no servidor — o navegador recebe o Set-Cookie + Location juntos
  redirect(redirectTo);
}
