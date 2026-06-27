'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition, use } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle, Clock, Disc, FileText, Lock, Music, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, History, Link as LinkIcon, Plus, Trash2, ExternalLink, CreditCard, Wallet, Mic, Drum, Guitar, Sliders, Radio, Pen, MessageSquare, X } from 'lucide-react';
import { handleSupabaseError, formatCurrency, formatDate } from '@/lib/utils';
import { ETAPAS_PRODUCAO, getStatusTheme } from '@/constants/workflow';
import { aprovarProjeto, registrarSolicitacaoRevisao } from '@/actions/databaseActions';
import { getPublicProject, adicionarReferenciaProjeto, removerReferenciaProjeto } from '@/actions/publicActions'; // [SEC REFACTOR]
import { ProjetoComCliente, PontoRevisao, FeedbackRevisao, CategoriaRevisao, PrioridadeRevisao } from '@/types';

// --- Configuração das Categorias e Prioridades ---
const CATEGORIAS: { label: CategoriaRevisao; emoji: string; cor: string }[] = [
  { label: 'Voz', emoji: '🎤', cor: '#a855f7' },
  { label: 'Bateria', emoji: '🥁', cor: '#f59e0b' },
  { label: 'Instrumentos', emoji: '🎸', cor: '#3b82f6' },
  { label: 'Mix Geral', emoji: '🌐', cor: '#10b981' },
  { label: 'Masterização', emoji: '🔊', cor: '#ef4444' },
  { label: 'Letra / Arranjo', emoji: '✍️', cor: '#ec4899' },
  { label: 'Outro', emoji: '💬', cor: '#6b7280' },
];

const PRIORIDADES: { label: PrioridadeRevisao; emoji: string; cor: string; bg: string }[] = [
  { label: 'Crítico', emoji: '🔴', cor: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  { label: 'Importante', emoji: '🟡', cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { label: 'Sugestão', emoji: '🟢', cor: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
];

const MAX_REVISOES = 3;

export default function PublicPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;
  const [projeto, setProjeto] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Estado do novo modal de revisão estruturado
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [pontosRevisao, setPontosRevisao] = useState<PontoRevisao[]>([]);
  const [observacaoGeral, setObservacaoGeral] = useState('');
  // Estado do formulário de um ponto de revisão (antes de adicionar à lista)
  const [pontoCategoria, setPontoCategoria] = useState<CategoriaRevisao>('Voz');
  const [pontoDescricao, setPontoDescricao] = useState('');
  const [pontoPrioridade, setPontoPrioridade] = useState<PrioridadeRevisao>('Importante');
  const [pontoTsMin, setPontoTsMin] = useState<string>('');
  const [pontoTsSeg, setPontoTsSeg] = useState<string>('');
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
        
        // Efeito UAU (Confetti)
        const duration = 3000;
        const end = Date.now() + duration;

        (function frame() {
          confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#7C3AED', '#A78BFA', '#34D399']
          });
          confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#7C3AED', '#A78BFA', '#34D399']
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        }());
      } catch (err: any) {
        alert('Erro ao aprovar projeto: ' + handleSupabaseError(err));
      }
    });
  };

  const adicionarPonto = () => {
    if (!pontoDescricao.trim()) return;
    const novoPonto: PontoRevisao = {
      id: crypto.randomUUID(),
      categoria: pontoCategoria,
      descricao: pontoDescricao.trim(),
      prioridade: pontoPrioridade,
      timestamp_min: pontoTsMin !== '' ? Number(pontoTsMin) : null,
      timestamp_seg: pontoTsSeg !== '' ? Number(pontoTsSeg) : null,
    };
    setPontosRevisao(prev => [...prev, novoPonto]);
    // Limpa o formulário do ponto (mantém categoria e prioridade)
    setPontoDescricao('');
    setPontoTsMin('');
    setPontoTsSeg('');
  };

  const removerPonto = (id: string) => {
    setPontosRevisao(prev => prev.filter(p => p.id !== id));
  };

  const handleSolicitarRevisao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !projeto || pontosRevisao.length === 0) return;
    
    const feedback: FeedbackRevisao = {
      versao: 'estruturado',
      pontos: pontosRevisao,
      observacao_geral: observacaoGeral.trim() || undefined,
    };

    startTransition(async () => {
      try {
        const updated = await registrarSolicitacaoRevisao(projeto.id, feedback, projeto.historico_revisoes || []);
        setProjeto((prev: any) => prev ? ({ ...prev, ...updated } as ProjetoComCliente) : null);
        setShowRevisionModal(false);
        setPontosRevisao([]);
        setObservacaoGeral('');
        setPontoDescricao('');
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

  const currentStatus = projeto.status_producao || 'Definição de Escopo';
  const currentIndex = ETAPAS_PRODUCAO.indexOf(currentStatus as typeof ETAPAS_PRODUCAO[number]);
  const isVaultUnlocked = currentStatus === 'Revisão' || currentStatus === 'Aprovado' || currentStatus === 'Entregue';
  const isLastStage = currentIndex === ETAPAS_PRODUCAO.length - 1;
  const clienteNome = projeto.clientes?.nome_artistico || projeto.clientes?.nome_pessoal || 'Artista';
  const clienteAprovou = projeto.cliente_aprovado === true;
  const ambosAprovaram = currentStatus === 'Aprovado';


  // Revision counters
  const disponiveis = Number(projeto.revisoes_disponiveis ?? MAX_REVISOES);
  const usadas = Number(projeto.contador_revisoes ?? 0);
  const revisaoEsgotada = disponiveis <= 0;
  const ultimaRevisao = disponiveis === 1;
  const historicoRevisoes: Array<{ data: string; motivo: any; etapa: string }> = projeto.historico_revisoes || [];

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

          {/* Resumo Financeiro */}
          {projeto.valor_fechado && (
            <div className="glass" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <Wallet size={16} style={{ color: 'var(--green)' }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Resumo Financeiro
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Valor Total</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatCurrency(projeto.valor_fechado)}
                  </span>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sinal (50%)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(projeto.valor_fechado / 2)}</span>
                    {projeto.sinal_pago ? (
                      <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(34,197,94,0.15)', color: 'var(--green)', padding: '2px 8px', borderRadius: 99 }}>PAGO</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 99 }}>PENDENTE</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Entrega (50%)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(projeto.valor_fechado / 2)}</span>
                    {projeto.entrega_paga ? (
                      <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(34,197,94,0.15)', color: 'var(--green)', padding: '2px 8px', borderRadius: 99 }}>PAGO</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 99 }}>PENDENTE</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar Financeira */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Progresso de Pagamento</span>
                    <span>{projeto.sinal_pago && projeto.entrega_paga ? '100%' : projeto.sinal_pago ? '50%' : '0%'}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ height: '100%', width: '50%', background: projeto.sinal_pago ? 'var(--green)' : 'transparent', transition: 'background 0.3s' }} />
                    <div style={{ height: '100%', width: '50%', background: projeto.entrega_paga ? 'var(--green)' : 'transparent', transition: 'background 0.3s' }} />
                  </div>
                </div>

                {/* Botão de pagamento pendente — só aparece quando há parcela em aberto */}
                {projeto.public_token && (!projeto.sinal_pago || !projeto.entrega_paga) && (
                  <a
                    href={`/proposta/${projeto.public_token}`}
                    style={{ textDecoration: 'none', display: 'block', marginTop: 4 }}
                  >
                    <button
                      style={{
                        width: '100%', padding: '13px 16px', borderRadius: 10,
                        background: !projeto.sinal_pago
                          ? 'linear-gradient(135deg, var(--accent), #6d28d9)'
                          : 'linear-gradient(135deg, #d97706, #b45309)',
                        color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 8, transition: '0.3s',
                        boxShadow: !projeto.sinal_pago
                          ? '0 0 18px var(--accent-glow)'
                          : '0 0 18px rgba(217,119,6,0.35)'
                      }}
                    >
                      <CreditCard size={16} />
                      {!projeto.sinal_pago
                        ? `Pagar Sinal — ${formatCurrency(projeto.valor_fechado / 2)}`
                        : `Pagar Entrega Final — ${formatCurrency(projeto.valor_fechado / 2)}`}
                    </button>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Referências para o Projeto */}
          <div className="glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>
                Referências
              </h3>
              <button
                onClick={() => setShowRefModal(true)}
                style={{
                  background: 'rgba(124,58,237,0.1)', color: 'var(--accent-light)',
                  border: '1px solid rgba(124,58,237,0.2)', padding: '8px 14px',
                  borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, transition: '0.2s',
                  whiteSpace: 'nowrap', flexShrink: 0
                }}
              >
                <Plus size={14} /> Adicionar Link
              </button>
            </div>

            {(!projeto.referencias || projeto.referencias.length === 0) ? (
              <div style={{ 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '32px 20px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12,
                background: 'rgba(0,0,0,0.15)'
              }}>
                <div style={{ 
                  width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12
                }}>
                  <LinkIcon size={20} style={{ color: 'var(--text-muted)' }} />
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'center' }}>
                  Nenhum link adicionado ainda.
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                  Adicione referências do YouTube, Spotify ou Drive.
                </p>
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
          {(projeto.status_producao === 'Revisão' || projeto.status_producao === 'Aprovado' || clienteAprovou) && (
            <div className="glass" style={{ 
              padding: '24px', 
              border: ambosAprovaram ? '1px solid rgba(6,182,212,0.4)' : clienteAprovou ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border)',
              background: ambosAprovaram ? 'rgba(6,182,212,0.05)' : clienteAprovou ? 'rgba(34,197,94,0.05)' : 'var(--bg-card)'
            }}>
              {ambosAprovaram ? (
                // Estado 3: Ambos aprovaram — aguardando pagamento final
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: 8, 
                    color: '#22d3ee', fontWeight: 700, fontSize: 16, marginBottom: 8 
                  }}>
                    <CheckCircle2 size={24} /> Projeto Aprovado por Todos!
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                    ✅ O produtor confirmou que está tudo certo.<br/>
                    Assim que o pagamento final for confirmado, os arquivos serão liberados.
                  </div>
                  {projeto.data_aprovacao && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Aprovado em {new Date(projeto.data_aprovacao).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      }).replace(',', ' às')}
                    </div>
                  )}
                </div>
              ) : clienteAprovou ? (
                // Estado 2: Cliente aprovou, aguardando admin
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: 8, 
                    color: 'var(--green)', fontWeight: 700, fontSize: 16, marginBottom: 8 
                  }}>
                    <CheckCircle2 size={24} /> Aprovação Enviada!
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Sua aprovação foi registrada. Aguardando confirmação final do produtor.
                  </div>
                  {projeto.data_aprovacao && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                      ✅ Aprovado em {new Date(projeto.data_aprovacao).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      }).replace(',', ' às')}
                    </div>
                  )}
                </div>
              ) : (
                // Estado 1: Aguardando aprovação do cliente
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
          {(() => {
            if (!projeto.motivo_revisao || projeto.data_aprovacao) return null;
            let displayMotivo = projeto.motivo_revisao;
            try {
              const parsed = JSON.parse(projeto.motivo_revisao);
              if (parsed && parsed.versao === 'estruturado' && parsed.resumo) {
                displayMotivo = parsed.resumo;
              }
            } catch (e) {
              // Not JSON, keep original string
            }
            return (
              <div style={{ 
                padding: '16px', borderRadius: 12, background: 'rgba(245,158,11,0.05)', 
                border: '1px solid rgba(245,158,11,0.2)', color: 'var(--text-primary)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>
                  <AlertCircle size={16} /> REVISÃO SOLICITADA
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
                  "{displayMotivo}"
                </p>
              </div>
            );
          })()}

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
                  {historicoRevisoes.map((rev, i) => {
                    // Detectar se o motivo é um objeto estruturado
                    const motivo = rev.motivo;
                    const isEstruturado = motivo && typeof motivo === 'object' && motivo.versao === 'estruturado';
                    
                    return (
                      <div key={i} style={{ padding: '14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Revisão #{i + 1}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {new Date(rev.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {isEstruturado ? (
                          // Renderização do feedback estruturado
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {motivo.pontos?.map((ponto: any, pi: number) => {
                              const cat = CATEGORIAS.find(c => c.label === ponto.categoria);
                              const pri = PRIORIDADES.find(p => p.label === ponto.prioridade);
                              const hasTs = ponto.timestamp_min != null || ponto.timestamp_seg != null;
                              return (
                                <div key={pi} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                                  <span style={{ fontSize: 16 }}>{cat?.emoji || '📌'}</span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 5 }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: cat?.cor || '#fff', background: `${cat?.cor || '#fff'}18`, border: `1px solid ${cat?.cor || '#fff'}33`, padding: '1px 6px', borderRadius: 99 }}>{ponto.categoria}</span>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: pri?.cor, background: pri?.bg, padding: '1px 6px', borderRadius: 99 }}>{pri?.emoji} {ponto.prioridade}</span>
                                      {hasTs && <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 99 }}>⏱ {String(ponto.timestamp_min ?? 0).padStart(2,'0')}:{String(ponto.timestamp_seg ?? 0).padStart(2,'0')}</span>}
                                    </div>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{ponto.descricao}</p>
                                  </div>
                                </div>
                              );
                            })}
                            {motivo.observacao_geral && (
                              <div style={{ marginTop: 4, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                💬 {motivo.observacao_geral}
                              </div>
                            )}
                          </div>
                        ) : (
                          // Feedback legado (texto puro)
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>
                            "{typeof motivo === 'string' ? motivo : JSON.stringify(motivo)}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* REVISION MODAL — ESTRUTURADO */}
      {showRevisionModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '16px'
        }}>
          <div className="glass" style={{ 
            maxWidth: 600, width: '100%', borderRadius: 24,
            animation: 'fadeUp 0.3s ease-out', margin: 'auto',
            maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Solicitar Alterações</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  Adicione cada ponto de ajuste separadamente para um feedback preciso.
                </p>
              </div>
              <button onClick={() => setShowRevisionModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-muted)', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Alerta de última revisão */}
              {ultimaRevisao && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', color: '#b8873a', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>Esta é a sua <strong>última revisão</strong> incluída no projeto.</span>
                </div>
              )}

              {/* ---- FORMULÁRIO DE UM PONTO ---- */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Novo Ponto de Ajuste</div>

                {/* Categoria */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>CATEGORIA</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {CATEGORIAS.map(cat => (
                      <button
                        key={cat.label}
                        type="button"
                        onClick={() => setPontoCategoria(cat.label)}
                        style={{
                          padding: '5px 11px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '0.15s',
                          background: pontoCategoria === cat.label ? `${cat.cor}22` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${pontoCategoria === cat.label ? cat.cor : 'rgba(255,255,255,0.08)'}`,
                          color: pontoCategoria === cat.label ? cat.cor : 'var(--text-secondary)',
                        }}
                      >
                        {cat.emoji} {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time-stamp */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>MARCAÇÃO DE TEMPO (opcional)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="number" min={0} max={59} placeholder="min"
                      value={pontoTsMin}
                      onChange={e => setPontoTsMin(e.target.value)}
                      style={{ width: 70, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 14, textAlign: 'center', outline: 'none' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>:</span>
                    <input
                      type="number" min={0} max={59} placeholder="seg"
                      value={pontoTsSeg}
                      onChange={e => setPontoTsSeg(e.target.value)}
                      style={{ width: 70, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 14, textAlign: 'center', outline: 'none' }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ex: 1min 23seg</span>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>DESCRIÇÃO DO AJUSTE</div>
                  <textarea
                    value={pontoDescricao}
                    onChange={e => setPontoDescricao(e.target.value)}
                    placeholder="Ex: O bumbo está cobrindo a nota do baixo na entrada do refrão..."
                    rows={2}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13, resize: 'none', outline: 'none' }}
                  />
                </div>

                {/* Prioridade */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>PRIORIDADE</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {PRIORIDADES.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setPontoPrioridade(p.label)}
                        style={{
                          flex: 1, padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: '0.15s',
                          background: pontoPrioridade === p.label ? p.bg : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${pontoPrioridade === p.label ? p.cor : 'rgba(255,255,255,0.08)'}`,
                          color: pontoPrioridade === p.label ? p.cor : 'var(--text-muted)',
                        }}
                      >
                        {p.emoji} {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Botão adicionar ponto */}
                <button
                  type="button"
                  onClick={adicionarPonto}
                  disabled={!pontoDescricao.trim()}
                  style={{
                    padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: pontoDescricao.trim() ? 'pointer' : 'not-allowed',
                    background: pontoDescricao.trim() ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${pontoDescricao.trim() ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: pontoDescricao.trim() ? 'var(--accent-light)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: 8, transition: '0.2s'
                  }}
                >
                  <Plus size={15} /> Adicionar à Lista
                </button>
              </div>

              {/* ---- LISTA DE PONTOS ADICIONADOS ---- */}
              {pontosRevisao.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    Pontos de Ajuste ({pontosRevisao.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pontosRevisao.map((ponto, idx) => {
                      const cat = CATEGORIAS.find(c => c.label === ponto.categoria);
                      const pri = PRIORIDADES.find(p => p.label === ponto.prioridade);
                      const hasTs = ponto.timestamp_min != null || ponto.timestamp_seg != null;
                      return (
                        <div key={ponto.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12 }}>
                          <div style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>{cat?.emoji}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: cat?.cor, background: `${cat?.cor}18`, border: `1px solid ${cat?.cor}33`, padding: '1px 7px', borderRadius: 99 }}>{ponto.categoria}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: pri?.cor, background: pri?.bg, padding: '1px 7px', borderRadius: 99 }}>{pri?.emoji} {ponto.prioridade}</span>
                              {hasTs && <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 7px', borderRadius: 99 }}>⏱ {String(ponto.timestamp_min ?? 0).padStart(2,'0')}:{String(ponto.timestamp_seg ?? 0).padStart(2,'0')}</span>}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{ponto.descricao}</div>
                          </div>
                          <button type="button" onClick={() => removerPonto(ponto.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observação Geral */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>OBSERVAÇÃO GERAL (opcional)</div>
                <textarea
                  value={observacaoGeral}
                  onChange={e => setObservacaoGeral(e.target.value)}
                  placeholder="Algum contexto geral sobre os ajustes? (ex: vibe geral, comparativo com referência...)"
                  rows={2}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13, resize: 'none', outline: 'none' }}
                />
              </div>

              {/* Botões de ação */}
              <form onSubmit={handleSolicitarRevisao} style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => { setShowRevisionModal(false); setPontosRevisao([]); setPontoDescricao(''); setObservacaoGeral(''); }}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '12px', borderRadius: 12 }}
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || pontosRevisao.length === 0}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 12,
                    background: pontosRevisao.length > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                    color: pontosRevisao.length > 0 ? '#fff' : 'var(--text-muted)',
                    border: 'none', fontWeight: 700, fontSize: 14,
                    cursor: (isPending || pontosRevisao.length === 0) ? 'not-allowed' : 'pointer',
                    transition: '0.2s'
                  }}
                >
                  {isPending ? 'Enviando...' : `Enviar ${pontosRevisao.length > 0 ? `(${pontosRevisao.length} ponto${pontosRevisao.length > 1 ? 's' : ''})` : 'Feedback'}`}
                </button>
              </form>
            </div>
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
