'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition, use } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Disc, 
  FileText, 
  Lock, 
  Music, 
  Send, 
  AlertCircle,
  Link as LinkIcon,
  ExternalLink,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { enviarEtapaParaAprovacao } from '@/actions/terceirizadosActions';
import { getPublicTask } from '@/actions/publicActions'; // [SEC REFACTOR]

export default function PartnerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;
  const [tarefa, setTarefa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  const [deliveryLink, setDeliveryLink] = useState('');
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  useEffect(() => {
    async function fetchTask() {
      if (!token) return;

      try {
        const data = await getPublicTask(token);
        setTarefa(data);
      } catch (err: any) {
        console.error('Error fetching public task:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchTask();
  }, [token]);

  const handleSubmitStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !deliveryLink.trim()) return;

    startTransition(async () => {
      try {
        await enviarEtapaParaAprovacao(token as string, deliveryLink);
        // Refresh local state
        setTarefa((prev: any) => ({ 
          ...prev, 
          status_etapa_atual: 'Aguardando Aprovação',
          link_entrega: deliveryLink 
        }));
        setShowSubmitForm(false);
        setDeliveryLink('');
      } catch (err) {
        alert('Erro ao enviar etapa. Tente novamente.');
      }
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="animate-spin text-accent" />
      </div>
    );
  }

  if (error || !tarefa) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 20 }}>
        <div className="glass" style={{ padding: '40px', textAlign: 'center', maxWidth: 400 }}>
          <Lock size={48} style={{ color: 'var(--red)', marginBottom: 20, margin: '0 auto' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Acesso Negado</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Este link de parceiro não é válido ou foi desativado.
          </p>
        </div>
      </div>
    );
  }

  const roadmap = (tarefa.roadmap_etapas as string[]) || [];
  const currentStep = roadmap[tarefa.etapa_atual_index];
  const isWaiting = tarefa.status_etapa_atual === 'Aguardando Aprovação';
  const isRevision = tarefa.status_etapa_atual === 'Revisão Solicitada';
  const isDone = tarefa.status_etapa_atual === 'Concluído';

  return (
    <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto' }} className="fade-up">
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ 
          display: 'inline-flex', alignItems: 'center', gap: 10, 
          padding: '6px 12px', borderRadius: 99, background: 'rgba(124,58,237,0.1)',
          border: '1px solid rgba(124,58,237,0.2)', marginBottom: 16
        }}>
          <Disc size={16} className="text-accent" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-light)' }}>
            Partner Hub • Our Dreams Studio
          </span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
          {tarefa.projetos?.clientes?.nome_artistico}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {tarefa.descricao_tarefa}
        </p>
      </div>

      {/* Main Roadmap Card */}
      <div className="glass" style={{ padding: '24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Roadmap de Produção
          </h2>
          <div style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 700 }}>
            {tarefa.etapa_atual_index + 1} / {roadmap.length} ETAPAS
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {roadmap.map((etapa, idx) => {
            const isCompleted = idx < tarefa.etapa_atual_index || isDone;
            const isCurrent = idx === tarefa.etapa_atual_index && !isDone;
            const isPending = idx > tarefa.etapa_atual_index && !isDone;

            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', gap: 16, alignItems: 'center', padding: '16px', borderRadius: 12,
                  background: isCurrent ? 'rgba(124,58,237,0.05)' : 'rgba(255,255,255,0.02)',
                  border: isCurrent ? '1px solid var(--accent)' : '1px solid var(--border)',
                  opacity: isPending ? 0.5 : 1, transition: '0.3s'
                }}
              >
                <div style={{ 
                  width: 28, height: 28, borderRadius: '50%', 
                  background: isCompleted ? 'var(--green)' : isCurrent ? 'var(--accent)' : 'var(--bg-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: '#fff'
                }}>
                  {isCompleted ? <CheckCircle2 size={16} /> : idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#fff' : 'var(--text-secondary)' }}>
                    {etapa}
                  </div>
                  {isCurrent && (
                    <div style={{ fontSize: 11, color: isRevision ? 'var(--red)' : isWaiting ? 'var(--accent-light)' : 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
                      {isRevision ? 'Revisão Solicitada' : isWaiting ? 'Aguardando Aprovação' : 'Em Execução'}
                    </div>
                  )}
                </div>
                {isCurrent && <ChevronRight size={18} className="text-accent" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Section */}
      {!isDone && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isRevision && (
            <div style={{ 
              padding: '20px', borderRadius: 16, background: 'rgba(239,68,68,0.05)', 
              border: '1px solid rgba(239,68,68,0.2)', color: 'var(--text-primary)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>
                <AlertCircle size={18} /> FEEDBACK DE AJUSTE
              </div>
              <p style={{ fontSize: 14, fontStyle: 'italic', lineHeight: 1.6 }}>
                "{tarefa.motivo_revisao_etapa}"
              </p>
            </div>
          )}

          {isWaiting ? (
            <div className="glass" style={{ padding: '24px', textAlign: 'center', borderColor: 'var(--accent)' }}>
              <Clock size={32} className="text-accent-light" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Entrega em Análise</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                O produtor foi notificado. Assim que a etapa for aprovada, o seu roadmap avançará automaticamente.
              </p>
            </div>
          ) : (
            <div className="glass" style={{ padding: '24px' }}>
              {!showSubmitForm ? (
                <button 
                  onClick={() => setShowSubmitForm(true)}
                  style={{ 
                    width: '100%', padding: '16px', borderRadius: 12, background: 'var(--accent)', 
                    color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                    boxShadow: '0 0 20px var(--accent-glow)'
                  }}
                >
                  Concluí esta etapa. Enviar link.
                </button>
              ) : (
                <form onSubmit={handleSubmitStage} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase' }}>
                      Link da Entrega (Drive/Stems)
                    </label>
                    <input 
                      type="url"
                      required
                      placeholder="https://..."
                      value={deliveryLink}
                      onChange={(e) => setDeliveryLink(e.target.value)}
                      style={{ 
                        width: '100%', padding: '16px', borderRadius: 12, background: 'var(--bg-base)', 
                        border: '1px solid var(--accent)', color: '#fff', outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" onClick={() => setShowSubmitForm(false)} style={{ flex: 1, padding: '14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={isPending} style={{ flex: 2, padding: '14px', borderRadius: 10, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      {isPending ? 'Enviando...' : 'Confirmar Envio'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info Sidebar (Mobile) */}
      <div style={{ marginTop: 24, padding: '20px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 16 }}>Dados da Tarefa</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>STATUS ATUAL</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-light)' }}>{tarefa.status_etapa_atual}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PRAZO FINAL</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-light)' }}>{new Date(tarefa.prazo_entrega).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
