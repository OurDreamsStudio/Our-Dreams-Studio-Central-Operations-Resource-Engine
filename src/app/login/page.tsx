'use client';

import { useActionState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginAction } from '@/actions/authActions';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import Image from 'next/image';

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';

  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; }

        .login-bg {
          min-height: 100vh;
          background: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .login-bg::before {
          content: '';
          position: absolute;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 40px;
          backdrop-filter: blur(20px);
          box-shadow: 0 30px 80px rgba(0,0,0,0.5);
          animation: fadeUp 0.4s ease-out;
          position: relative;
          z-index: 1;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .login-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin-bottom: 36px;
          text-align: center;
        }

        .logo-wrap {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: rgba(124,58,237,0.12);
          border: 1px solid rgba(124,58,237,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(124,58,237,0.2);
        }

        .login-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
        }

        .login-subtitle {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          margin-top: 4px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 24px;
        }

        .field-wrap {
          position: relative;
        }

        .field-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.3);
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        .field-input {
          width: 100%;
          padding: 13px 14px 13px 42px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .field-input::placeholder {
          color: rgba(255,255,255,0.25);
        }

        .field-input:focus {
          border-color: rgba(124,58,237,0.6);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.12);
        }

        .error-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 12px;
          padding: 12px 14px;
          color: #fca5a5;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 20px;
          animation: fadeUp 0.2s ease-out;
        }

        .btn-login {
          width: 100%;
          padding: 14px;
          background: #7c3aed;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 0 20px rgba(124,58,237,0.35);
          letter-spacing: 0.01em;
        }

        .btn-login:hover:not(:disabled) {
          background: #6d28d9;
          transform: translateY(-1px);
          box-shadow: 0 0 28px rgba(124,58,237,0.5);
        }

        .btn-login:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-login:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .login-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 11px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.03em;
        }
      `}</style>

      <div className="login-bg">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-wrap">
              <Image src="/logo.png" alt="Logo" width={32} height={32} style={{ borderRadius: 6 }} />
            </div>
            <div>
              <div className="login-title">Our Dreams Studio</div>
              <div className="login-subtitle">Acesso restrito ao painel administrativo</div>
            </div>
          </div>

          <form action={formAction}>
            {/* Passes redirectTo to the server action as a hidden field */}
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <div className="field-group">
              <div className="field-wrap">
                <span className="field-icon"><Mail size={16} /></span>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  className="field-input"
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="field-wrap">
                <span className="field-icon"><Lock size={16} /></span>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  className="field-input"
                  placeholder="Senha"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {state?.error && (
              <div className="error-box">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {state.error}
              </div>
            )}

            <button type="submit" className="btn-login" disabled={isPending}>
              {isPending
                ? <><Loader2 size={16} className="spin" /> Autenticando...</>
                : <><Lock size={15} /> Entrar no Painel</>
              }
            </button>
          </form>

          <div className="login-footer">ODS CENTRAL OPERATIONS · ACESSO AUDITADO</div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        Carregando segurança...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
