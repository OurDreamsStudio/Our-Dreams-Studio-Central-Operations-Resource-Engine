import { loginAction } from '@/actions/authActions';
import { Lock, Mail, ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface Props {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const redirectTo = params.redirectTo || '/dashboard';
  const errorMsg = params.error || null;

  return (
    <div className="min-h-screen bg-[#F9F9FB] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#460362]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-[400px] relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-[#460362] text-sm mb-6 transition-colors"
        >
          <ChevronLeft size={16} />
          Voltar para o site
        </Link>

        <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[32px] p-10 shadow-xl shadow-[#460362]/5">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 border border-neutral-100">
              <Image src="/logo.png" alt="Logo" width={36} height={36} className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Acesso ao CORE</h1>
            <p className="text-neutral-500 text-sm mt-1">Painel Central de Operações</p>
          </div>

          <form action={loginAction} className="space-y-5">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                  <Mail size={18} />
                </span>
                <input
                  name="email"
                  type="email"
                  placeholder="Seu e-mail"
                  autoComplete="email"
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-white/50 border border-neutral-200 rounded-2xl outline-none focus:border-[#460362] focus:ring-1 focus:ring-[#460362] transition-all text-neutral-900"
                />
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                  <Lock size={18} />
                </span>
                <input
                  name="password"
                  type="password"
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-white/50 border border-neutral-200 rounded-2xl outline-none focus:border-[#460362] focus:ring-1 focus:ring-[#460362] transition-all text-neutral-900"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-sm">
                <span className="shrink-0">⚠️</span>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-[#460362] text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#460362]/20 hover:bg-[#5a057d] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Entrar no Sistema
            </button>
          </form>

          <p className="text-center mt-8 text-[10px] text-neutral-400 uppercase tracking-widest font-medium">
            Acesso Restrito · Auditoria Ativa
          </p>
        </div>
      </div>
    </div>
  );
}