'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition, use } from 'react';
import { CheckCircle, Clock, Disc, FileText, Lock, Music, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, History, Link as LinkIcon, Plus, Trash2, ExternalLink } from 'lucide-react';
import { handleSupabaseError, formatCurrency, formatDate } from '@/lib/utils';
import { ETAPAS_PRODUCAO, getStatusTheme } from '@/constants/workflow';
import { aprovarProjeto, registrarSolicitacaoRevisao } from '@/actions/databaseActions';
import { getPublicProject, adicionarReferenciaProjeto, removerReferenciaProjeto } from '@/actions/publicActions'; // [SEC REFACTOR]
import { ProjetoComCliente } from '@/types';

const MAX_REVISOES = 3;

export default function PublicPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;
  const [projeto, setProjeto] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [refTitle, setRefTitle] = useState('');
  const [refUrl, setRefUrl] = useState('');
  const [isSubmittingRef, setIsSubmittingRef] = useState(false);

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

  const handleAddReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !refTitle || !refUrl) return;
    setIsSubmittingRef(true);
    try {
      const novaRef = { id: crypto.randomUUID(), titulo: refTitle, url: refUrl, data_adicionado: new Date().toISOString() };
      const atualizadas = await adicionarReferenciaProjeto(token as string, novaRef);
      setProjeto((prev: any) => prev ? { ...prev, referencias: atualizadas } : null);
      setShowRefModal(false);
      setRefTitle('');
      setRefUrl('');
    } catch (err: any) {
      alert('Erro ao adicionar referência: ' + handleSupabaseError(err));
    } finally {
      setIsSubmittingRef(false);
    }
  };

  const handleRemoveReference = async (idRef: string) => {
    if (!confirm('Tem certeza que deseja remover esta referência?')) return;
    try {
      const atualizadas = await removerReferenciaProjeto(token as string, idRef);
      setProjeto((prev: any) => prev ? { ...prev, referencias: atualizadas } : null);
    } catch (err: any) {
      alert('Erro ao remover referência: ' + handleSupabaseError(err));
    }
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

  // Revision counters
  const disponiveis = Number(projeto.revisoes_disponiveis ?? MAX_REVISOES);
  const usadas = Number(projeto.contador_revisoes ?? 0);
  const revisaoEsgotada = disponiveis <= 0;
  const ultimaRevisao = disponiveis === 1;
  const historicoRevisoes: Array<{ data: string; motivo: string; etapa: string }> = projeto.historico_revisoes || [];

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 20px)', maxWidth: 1000, margin: '0 auto' }} className="fade-up">
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
        <h1 style={{ fontSize: 'clamp(24px, 6vw, 36px)', fontWeight: 800, marginBottom: 8 }}>
          Olá, <span className="gradient-text">{clienteNome}</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>
          Siga cada etapa da evolução do seu projeto em tempo real.
        </p>
      </div>

      <div className="public-layout-grid">
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

              {/* Revision Counter — shown only when in Revisão stage or already used some */}
              {(usadas > 0 || currentStatus === 'Revisão') && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>REVISÕES INCLUÍDAS</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ 
                      fontSize: 13, color: revisaoEsgotada ? 'var(--text-muted)' : 'var(--text-secondary)', fontWeight: 500
                    }}>
                      {usadas} de {MAX_REVISOES} utilizadas
                    </span>
                    <span style={{ 
                      fontSize: 11, fontWeight: 600, 
                      color: revisaoEsgotada ? '#6b7280' : '#6b7280'
                    }}>
                      {disponiveis} restante{disponiveis !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Subtle progress bar */}
                  <div style={{ 
                    height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden'
                  }}>
                    <div style={{ 
                      height: '100%', borderRadius: 99,
                      width: `${(usadas / MAX_REVISOES) * 100}%`,
                      background: revisaoEsgotada 
                        ? 'rgba(107,114,128,0.5)' 
                        : usadas >= 2 
                          ? 'rgba(245,158,11,0.4)' 
                          : 'rgba(124,58,237,0.4)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Referências para o Projeto */}
          <div className="glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Referências para o Projeto
              </h3>
              <button
                onClick={() => setShowRefModal(true)}
                style={{
                  background: 'rgba(124,58,237,0.1)', color: 'var(--accent-light)',
                  border: '1px solid rgba(124,58,237,0.2)', padding: '6px 12px',
                  borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, transition: '0.2s'
                }}
              >
                <Plus size={14} /> Adicionar Link
              </button>
            </div>

            {(!projeto.referencias || projeto.referencias.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '20px 0', border: '1px dashed var(--border)', borderRadius: 8 }}>
                <LinkIcon size={24} style={{ color: 'var(--border)', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nenhum link adicionado ainda.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {projeto.referencias.map((ref: any) => (
                  <div key={ref.id} style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <LinkIcon size={14} className="text-accent" />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ref.titulo}
                        </div>
                        <a href={ref.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                          Acessar Link <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveReference(ref.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4, opacity: 0.6, transition: '0.2s' }}
                      title="Remover referência"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                  {/* Solicitar Alteração — disabled when exhausted */}
                  <button
                    onClick={() => !revisaoEsgotada && setShowRevisionModal(true)}
                    disabled={isPending || revisaoEsgotada}
                    title={revisaoEsgotada ? 'Limite de revisões atingido' : undefined}
                    style={{ 
                      width: '100%', padding: '12px', borderRadius: 8, 
                      background: 'transparent', 
                      color: revisaoEsgotada ? 'var(--text-muted)' : 'var(--text-secondary)', 
                      fontSize: 13, fontWeight: 600, 
                      cursor: (isPending || revisaoEsgotada) ? 'not-allowed' : 'pointer',
                      border: `1px solid ${revisaoEsgotada ? 'rgba(255,255,255,0.06)' : 'var(--border)'}`, 
                      transition: '0.3s',
                      opacity: revisaoEsgotada ? 0.45 : 1
                    }}
                  >
                    {revisaoEsgotada ? 'Limite de revisões atingido' : 'Solicitar Alteração'}
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

          {/* Revision History */}
          {historicoRevisoes.length > 0 && (
            <div style={{ 
              borderRadius: 12, border: '1px solid var(--border)', 
              background: 'rgba(255,255,255,0.015)', overflow: 'hidden'
            }}>
              <button
                onClick={() => setShowHistory(h => !h)}
                style={{
                  width: '100%', padding: '14px 18px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', color: 'var(--text-secondary)'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                  <History size={15} style={{ color: 'var(--text-muted)' }} />
                  Histórico de Revisões ({historicoRevisoes.length})
                </span>
                {showHistory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {showHistory && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {historicoRevisoes.map((rev, i) => (
                    <div key={i} style={{ 
                      padding: '12px', borderRadius: 8, 
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Revisão #{i + 1}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {new Date(rev.data).toLocaleString('pt-BR', { 
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
                        "{rev.motivo}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
            
            {/* Subtle warning when last revision */}
            {ultimaRevisao && (
              <div style={{ 
                padding: '10px 14px', borderRadius: 8, 
                background: 'rgba(245,158,11,0.07)', 
                border: '1px solid rgba(245,158,11,0.18)', 
                color: '#a37c3a', 
                fontSize: 12, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start'
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Esta é a sua última revisão incluída no projeto.</span>
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

      {/* REFERENCE MODAL */}
      {showRefModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: 20
        }}>
          <div className="glass" style={{ 
            maxWidth: 400, width: '100%', padding: 32, borderRadius: 20,
            animation: 'fadeUp 0.3s ease-out', margin: 'auto'
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Adicionar Referência</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Cole o link do YouTube, Google Drive, Spotify ou de outro lugar.
            </p>
            <form onSubmit={handleAddReference}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>TÍTULO DA REFERÊNCIA</label>
                <input
                  required
                  type="text"
                  value={refTitle}
                  onChange={(e) => setRefTitle(e.target.value)}
                  placeholder="Ex: Referência para a bateria"
                  style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', outline: 'none' }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>URL DO LINK</label>
                <input
                  required
                  type="url"
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  type="button" 
                  onClick={() => setShowRefModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: 12, borderRadius: 10 }}
                  disabled={isSubmittingRef}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingRef}
                  style={{ 
                    flex: 2, padding: 12, borderRadius: 10, background: 'var(--accent)', 
                    color: '#fff', border: 'none', fontWeight: 700, cursor: isSubmittingRef ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSubmittingRef ? 'Salvando...' : 'Salvar Link'}
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

      <style jsx>{`
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
