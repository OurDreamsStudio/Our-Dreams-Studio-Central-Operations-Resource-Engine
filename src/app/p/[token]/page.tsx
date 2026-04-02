'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition, use } from 'react';
import { CheckCircle, Clock, Disc, FileText, Lock, Music, CheckCircle2, AlertCircle } from 'lucide-react';
import { handleSupabaseError, formatCurrency, formatDate } from '@/lib/utils';
import { ETAPAS_PRODUCAO, getStatusTheme } from '@/constants/workflow';
import { aprovarProjeto, registrarSolicitacaoRevisao } from '@/actions/databaseActions';
import { getPublicProject } from '@/actions/publicActions'; // [SEC REFACTOR]
import { ProjetoComCliente } from '@/types';

export default function PublicPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;
  const [projeto, setProjeto] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');

  useEffect(() => {
    async function fetchProject() {
      if (!token) return;

      try {
        const data = await getPublicProject(token);
        setProjeto(data);
      } catch (err: any) {
        console.error('Error fetching public project:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [token]);

  const handleAprovar = () => {
    if (!token) return;
    startTransition(async () => {
      try {
        await aprovarProjeto(token as string);
        const data = await getPublicProject(token);
        setProjeto((prev: any) => prev ? ({ ...prev, ...data } as ProjetoComCliente) : null);
      } catch (err: any) {
        alert('Erro ao aprovar projeto: ' + handleSupabaseError(err));
      }
    });
  };

  const handleSolicitarRevisao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !projeto || !revisionFeedback.trim()) return;
    
    startTransition(async () => {
      try {
        const updated = await registrarSolicitacaoRevisao(projeto.id, revisionFeedback, projeto.historico_revisoes || []);
        setProjeto((prev: any) => prev ? ({ ...prev, ...updated } as ProjetoComCliente) : null);
        setShowRevisionModal(false);
        setRevisionFeedback('');
      } catch (err: any) {
        alert('Erro ao solicitar revisão: ' + handleSupabaseError(err));
      }
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <Music size={24} className="animate-pulse" />
        <span style={{ marginLeft: 12 }}>Sincronizando experiência...</span>
      </div>
    );
  }

  if (error || !projeto) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 20 }}>
        <div className="glass" style={{ padding: '40px', textAlign: 'center', maxWidth: 400 }}>
          <Lock size={48} style={{ color: 'var(--red)', marginBottom: 20, margin: '0 auto' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Link Inválido ou Expirado</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
            Este link de acompanhamento não foi encontrado ou não está mais ativo. 
            Entre em contato com o Our Dreams Studio se precisar de ajuda.
          </p>
        </div>
      </div>
    );
  }

  const currentStatus = projeto.status_producao || '';
  const currentIndex = ETAPAS_PRODUCAO.indexOf(currentStatus as typeof ETAPAS_PRODUCAO[number]);
  const isVaultUnlocked = currentStatus === 'Revisão' || currentStatus === 'Entregue';
  const isLastStage = currentIndex === ETAPAS_PRODUCAO.length - 1;
  const clienteNome = projeto.clientes?.nome_artistico || projeto.clientes?.nome_pessoal || 'Artista';

  return (
    <div style={{ padding: '40px 20px', maxWidth: 1000, margin: '0 auto' }} className="fade-up">
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: 50 }}>
        <div style={{ 
          display: 'inline-flex', alignItems: 'center', gap: 10, 
          padding: '8px 16px', borderRadius: 99, background: 'rgba(124,58,237,0.1)',
          border: '1px solid rgba(124,58,237,0.2)', marginBottom: 20
        }}>
          <Disc size={18} className="text-accent" />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-light)' }}>
            Our Dreams Studio • Tracking
          </span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>
          Olá, <span className="gradient-text">{clienteNome}</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>
          Siga cada etapa da evolução do seu projeto em tempo real.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32 }}>
        {/* Main Content: Stepper */}
        <div className="glass" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={20} className="text-accent" /> Status da Produção
          </h2>

          <div style={{ position: 'relative', paddingLeft: 30 }}>
            {/* Logic line */}
            <div style={{ 
              position: 'absolute', left: 4, top: 0, bottom: 0, width: 2, 
              background: 'var(--border)', zIndex: 0 
            }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
              {ETAPAS_PRODUCAO.map((etapa, idx) => {
                const isCompleted = idx < currentIndex;
                const isCurrent = idx === currentIndex;
                const isPending = idx > currentIndex;
                const theme = getStatusTheme(etapa);

                return (
                  <div key={etapa} style={{ position: 'relative', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    {/* Circle Indicator */}
                    <div style={{ 
                      position: 'absolute', left: -34, top: 4, 
                      width: 18, height: 18, borderRadius: '50%',
                      background: isCompleted ? 'var(--green)' : isCurrent ? 'var(--accent)' : 'var(--bg-surface)',
                      border: `3px solid ${isCurrent ? 'var(--bg-base)' : 'var(--border)'}`,
                      boxShadow: isCurrent ? '0 0 15px var(--accent-glow)' : 'none',
                      zIndex: 1, transition: 'all 0.3s'
                    }}>
                      {isCompleted && <CheckCircle size={12} style={{ color: '#fff', position: 'absolute', top: 0, left: 0 }} />}
                      {isCurrent && <div className="pulse-dot" style={{ background: '#fff', width: 6, height: 6, margin: '3px' }} />}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: 15, fontWeight: 700, 
                        color: isPending ? 'var(--text-muted)' : 'var(--text-primary)',
                        marginBottom: 4
                      }}>
                        {etapa}
                      </div>
                      <div style={{ 
                        fontSize: 12, 
                        color: isCurrent ? 'var(--accent-light)' : 'var(--text-muted)',
                        fontWeight: isCurrent ? 600 : 400
                      }}>
                        {isCompleted ? 'Etapa concluída com sucesso' : 
                         isCurrent ? 'Estamos trabalhando aqui agora' : 
                         'Aguardando etapas anteriores'}
                      </div>
                    </div>

                    {isCurrent && (
                      <div style={{ 
                        background: `${theme.bg}`, color: theme.text, border: `1px solid ${theme.border}`,
                        fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6, textTransform: 'uppercase'
                      }}>
                        Em Andamento
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Info & Asset Vault */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Project Details */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
              Detalhes do Projeto
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>SERVIÇO</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{projeto.servicos_fechados || projeto.tipo_servico}</div>
              </div>
              {projeto.prazo_entrega && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PREVISÃO DE ENTREGA</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-light)' }}>
                    {new Date(projeto.prazo_entrega).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Asset Vault Placeholder */}
          <div className="glass" style={{ 
            padding: '24px', 
            opacity: isVaultUnlocked ? 1 : 0.8,
            boxShadow: isVaultUnlocked ? '0 0 20px rgba(124, 58, 237, 0.3)' : 'none',
            borderColor: isVaultUnlocked ? 'rgba(124, 58, 237, 0.4)' : 'var(--border)',
            transition: 'all 0.5s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Lock size={16} style={{ color: isVaultUnlocked ? 'var(--green)' : 'var(--text-muted)' }} />
              <h3 style={{ 
                fontSize: 14, fontWeight: 700, 
                color: isVaultUnlocked ? 'var(--text-primary)' : 'var(--text-muted)', 
                textTransform: 'uppercase', letterSpacing: '0.05em' 
              }}>
                Asset Vault
              </h3>
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <FileText size={40} style={{ color: isVaultUnlocked ? 'var(--accent-light)' : 'var(--border)', marginBottom: 16 }} />
              <p style={{ fontSize: 13, color: isVaultUnlocked ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: 1.5, fontWeight: isVaultUnlocked ? 500 : 400 }}>
                {isVaultUnlocked 
                  ? (projeto.link_arquivos 
                      ? "Cofre Desbloqueado! Seus arquivos de revisão/entrega estão prontos para acesso."
                      : "Cofre Desbloqueado! O produtor está preparando o link dos seus arquivos.")
                  : "Os arquivos finalizados e guias aparecerão aqui automaticamente na etapa de Revisão."
                }
              </p>
            </div>
            {isVaultUnlocked && projeto.link_arquivos ? (
              <a 
                href={projeto.link_arquivos} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <button 
                  style={{ 
                    width: '100%', padding: '12px', borderRadius: 8, 
                    background: 'var(--accent)', color: '#fff', 
                    fontSize: 13, fontWeight: 700, 
                    cursor: 'pointer', 
                    marginTop: 12, transition: '0.3s',
                    boxShadow: '0 0 15px var(--accent-glow)',
                    border: 'none'
                  }}
                >
                  Acessar Arquivos
                </button>
              </a>
            ) : (
              <button 
                disabled 
                style={{ 
                  width: '100%', padding: '12px', borderRadius: 8, 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border)', 
                  color: 'var(--text-muted)', 
                  fontSize: 13, fontWeight: 700, 
                  cursor: 'not-allowed', 
                  marginTop: 12, transition: '0.3s',
                }}
              >
                {isVaultUnlocked ? 'Aguardando upload dos links...' : 'Cofre Bloqueado'}
              </button>
            )}
          </div>

          {/* APPROVAL & REVISION SECTION */}
          {(projeto.status_producao === 'Revisão' || projeto.data_aprovacao) && (
            <div className="glass" style={{ 
              padding: '24px', 
              border: projeto.data_aprovacao ? '1px solid var(--green)' : '1px solid var(--border)',
              background: projeto.data_aprovacao ? 'rgba(34,197,94,0.05)' : 'var(--bg-card)'
            }}>
              {projeto.data_aprovacao ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: 8, 
                    color: 'var(--green)', fontWeight: 700, fontSize: 16, marginBottom: 8 
                  }}>
                    <CheckCircle2 size={24} /> Projeto Aprovado!
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    ✅ Aprovado Oficialmente em {new Date(projeto.data_aprovacao).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    }).replace(',', ' às')}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Sua Aprovação é Necessária
                  </h3>
                  <button
                    onClick={handleAprovar}
                    disabled={isPending}
                    style={{ 
                      width: '100%', padding: '14px', borderRadius: 8, 
                      background: 'var(--green)', color: '#fff', 
                      fontSize: 14, fontWeight: 700, cursor: isPending ? 'not-allowed' : 'pointer',
                      border: 'none', transition: '0.3s', opacity: isPending ? 0.7 : 1,
                      boxShadow: '0 0 15px rgba(34,197,94,0.3)'
                    }}
                  >
                    {isPending ? 'Processando...' : 'Aprovar Revisão'}
                  </button>
                  <button
                    onClick={() => setShowRevisionModal(true)}
                    disabled={isPending}
                    style={{ 
                      width: '100%', padding: '12px', borderRadius: 8, 
                      background: 'transparent', color: 'var(--text-secondary)', 
                      fontSize: 13, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer',
                      border: '1px solid var(--border)', transition: '0.3s'
                    }}
                  >
                    Solicitar Alteração
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Revision Info (Internal Alert Equivalent for Client) */}
          {projeto.motivo_revisao && !projeto.data_aprovacao && (
            <div style={{ 
              padding: '16px', borderRadius: 12, background: 'rgba(245,158,11,0.05)', 
              border: '1px solid rgba(245,158,11,0.2)', color: 'var(--text-primary)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>
                <AlertCircle size={16} /> REVISÃO SOLICITADA
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                "{projeto.motivo_revisao}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* REVISION MODAL */}
      {showRevisionModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: 20
        }}>
          <div className="glass" style={{ 
            maxWidth: 500, width: '100%', padding: 32, borderRadius: 20,
            animation: 'fadeUp 0.3s ease-out', margin: 'auto'
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Solicitar Alterações</h3>
            
            {projeto.contador_revisoes >= 3 && (
              <div style={{ 
                padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', 
                border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', 
                fontSize: 12, fontWeight: 700, marginBottom: 16, display: 'flex', gap: 10
              }}>
                <AlertCircle size={16} />
                <span>Esta é sua última revisão gratuita. Próximas alterações terão custo de 15% do valor do serviço.</span>
              </div>
            )}

            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Descreva detalhadamente o que você gostaria de ajustar (ex: volume da voz, timbre do baixo, etc).
            </p>
            <form onSubmit={handleSolicitarRevisao}>
              <textarea
                required
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                placeholder="Ex: Gostaria de aumentar um pouco o volume da voz no refrão..."
                style={{
                  width: '100%', height: 150, padding: 16, borderRadius: 12,
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  color: '#fff', outline: 'none', fontSize: 14, resize: 'none',
                  marginBottom: 20
                }}
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  type="button" 
                  onClick={() => setShowRevisionModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: 12, borderRadius: 10 }}
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isPending}
                  style={{ 
                    flex: 2, padding: 12, borderRadius: 10, background: 'var(--accent)', 
                    color: '#fff', border: 'none', fontWeight: 700, cursor: isPending ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isPending ? 'Processando...' : 'Enviar Solicitação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Support */}
      <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-muted)', fontSize: 13 }}>
        Alguma dúvida sobre o progresso? <br/>
        <a 
          href="https://wa.me/5531993552932?text=Tenho%20uma%20d%C3%BAvida%20sobre%20o%20progresso%20do%20meu%20projeto." 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}
        >
          Falar com o Produtor via WhatsApp
        </a>
      </div>
    </div>
  );
}
