'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition, use } from 'react';
import { Lock, FileText, CheckCircle2, ChevronRight, ExternalLink } from 'lucide-react';
import { handleSupabaseError, formatCurrency } from '@/lib/utils';
import { getPublicProposal, gerarCheckout } from '@/actions/publicActions';

export default function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;
  
  const [projeto, setProjeto] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    async function fetchProject() {
      if (!token) return;

      try {
        const data = await getPublicProposal(token);
        setProjeto(data);
      } catch (err: any) {
        console.error('Error fetching public proposal:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [token]);

  const handlePayment = () => {
    if (!token || !acceptedTerms) return;
    
    startTransition(async () => {
      try {
        const checkoutUrl = await gerarCheckout(token);
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        }
      } catch (err: any) {
        alert('Erro ao gerar checkout: ' + handleSupabaseError(err));
      }
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div className="animate-pulse flex items-center gap-3">
          <FileText size={24} className="text-accent" />
          <span>Carregando proposta...</span>
        </div>
      </div>
    );
  }

  if (error || !projeto) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 20 }}>
        <div className="glass" style={{ padding: '40px', textAlign: 'center', maxWidth: 400 }}>
          <Lock size={48} style={{ color: 'var(--red)', marginBottom: 20, margin: '0 auto' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Proposta Inválida</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
            Este link de proposta não foi encontrado ou já expirou. 
            Entre em contato com o Our Dreams Studio se precisar de ajuda.
          </p>
        </div>
      </div>
    );
  }

  const clienteNome = projeto.clientes?.nome_artistico || projeto.clientes?.nome_pessoal || 'Artista';
  const valorTotal = Number(projeto.valor_fechado || 0);
  const valorSinal = valorTotal / 2;
  const servicos: Record<string, number> = projeto.valores_servicos || {};
  const isFechado = projeto.sinal_pago || projeto.status_funil === 'Fechado';

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 20px)', maxWidth: 800, margin: '0 auto' }} className="fade-up">
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: 50 }}>
        <div style={{ 
          display: 'inline-flex', alignItems: 'center', gap: 10, 
          padding: '8px 16px', borderRadius: 99, background: 'rgba(124,58,237,0.1)',
          border: '1px solid rgba(124,58,237,0.2)', marginBottom: 20
        }}>
          <FileText size={18} className="text-accent" />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-light)' }}>
            Proposta de Serviços
          </span>
        </div>
        <h1 style={{ fontSize: 'clamp(24px, 6vw, 36px)', fontWeight: 800, marginBottom: 8 }}>
          Olá, <span className="gradient-text">{clienteNome}</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>
          Confira os detalhes do seu projeto de <strong style={{ color: 'var(--text-primary)' }}>{projeto.tipo_servico || projeto.servicos_fechados}</strong>.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Detalhamento dos Serviços */}
        <div className="glass" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
            Escopo e Investimento
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(servicos).length > 0 ? (
              Object.entries(servicos).map(([nome, valor], index) => (
                <div key={index} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  paddingBottom: 16, borderBottom: '1px solid var(--border)' 
                }}>
                  <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{nome}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(valor)}</span>
                </div>
              ))
            ) : (
              <div style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                paddingBottom: 16, borderBottom: '1px solid var(--border)' 
              }}>
                <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Projeto Personalizado</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(valorTotal)}</span>
              </div>
            )}
            
            {/* Total */}
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              paddingTop: 8, marginTop: 8 
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Total do Projeto</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-light)' }}>{formatCurrency(valorTotal)}</span>
            </div>
          </div>
        </div>

        {/* Status de Fechamento / Aceite e Pagamento */}
        {isFechado ? (
           <div className="glass" style={{ 
            padding: '32px', textAlign: 'center',
            background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.3)'
          }}>
            <CheckCircle2 size={48} style={{ color: 'var(--green)', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Projeto Confirmado!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 24 }}>
              O sinal já foi pago e o projeto consta como fechado. Acompanhe o progresso pelo seu link de tracking.
            </p>
            <a 
              href={`/p/${token}`}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 8, background: 'var(--bg-surface)',
                color: 'var(--text-primary)', border: '1px solid var(--border)',
                textDecoration: 'none', fontWeight: 600, transition: '0.2s'
              }}
            >
              Acessar Tracking <ChevronRight size={18} />
            </a>
          </div>
        ) : (
          <div className="glass" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
              Próximos Passos
            </h2>

            {/* Termos de Serviço */}
            <div style={{ 
              background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', 
              border: '1px solid var(--border)', marginBottom: 24 
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>
                Termos de Serviço
              </h3>
              <ul style={{ 
                margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', 
                fontSize: 14, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 8 
              }}>
                <li><strong>Revisões:</strong> O projeto inclui até 3 revisões gratuitas. Revisões extras poderão ser cobradas à parte.</li>
                <li><strong>Prazos:</strong> O prazo de entrega começa a contar a partir do preenchimento completo do briefing e envio dos arquivos.</li>
                <li><strong>Backup:</strong> Os arquivos do projeto serão mantidos em nossos servidores por 30 dias após a entrega final.</li>
                <li><strong>Pagamento:</strong> O projeto será iniciado mediante o pagamento do sinal de 50%. Os 50% restantes deverão ser pagos antes da entrega dos arquivos finais em alta resolução.</li>
              </ul>

              <label style={{ 
                display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 24,
                cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.03)', 
                borderRadius: 8, border: '1px solid var(--border)'
              }}>
                <input 
                  type="checkbox" 
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--accent)' }} 
                />
                <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>
                  Li e concordo com os Termos de Serviço apresentados acima. Entendo que o projeto só será iniciado após o pagamento do sinal.
                </span>
              </label>
            </div>

            {/* CTA Pagamento */}
            <div style={{ 
              display: 'flex', flexDirection: 'column', gap: 12, 
              padding: '24px', background: 'rgba(124,58,237,0.05)', 
              borderRadius: '12px', border: '1px solid rgba(124,58,237,0.2)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Sinal para iniciar (50%)</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(valorSinal)}</span>
              </div>
              
              <button
                onClick={handlePayment}
                disabled={!acceptedTerms || isPending}
                style={{
                  width: '100%', padding: '16px', borderRadius: '8px',
                  background: acceptedTerms ? 'var(--accent)' : 'var(--bg-surface)',
                  color: acceptedTerms ? '#fff' : 'var(--text-muted)',
                  border: acceptedTerms ? 'none' : '1px solid var(--border)',
                  fontSize: 16, fontWeight: 700, cursor: acceptedTerms && !isPending ? 'pointer' : 'not-allowed',
                  transition: '0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: acceptedTerms && !isPending ? '0 0 20px var(--accent-glow)' : 'none'
                }}
              >
                {isPending ? 'Gerando checkout...' : 'Pagar Sinal e Iniciar'}
                {acceptedTerms && !isPending && <ExternalLink size={18} />}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease-out; }
      `}</style>
    </div>
  );
}
