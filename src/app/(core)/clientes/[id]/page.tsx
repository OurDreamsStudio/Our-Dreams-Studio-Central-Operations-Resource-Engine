'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Save, Activity, CheckCircle, Disc, X, Share2, Check, FileText, RefreshCw, History, ChevronDown, ChevronUp } from 'lucide-react';
import { SERVICOS, MIX_MASTER_CHECKLIST, ETAPAS_VENDAS, getStatusTheme } from '@/constants/workflow';
import { getClientProfileData, updateClienteAnotacoes, createUpsellProject, ajustarRevisoesDisponiveis } from '@/actions/databaseActions';

const FLUXO_LABEL: Record<string, { label: string; color: string }> = {
  AGUARDANDO_BASE:    { label: 'Aguardando Base',    color: '#8b8ba7' },
  EM_DIAGNOSTICO:     { label: 'Em Diagnóstico',     color: '#eab308' },
  ORCAMENTO_ENVIADO:  { label: 'Orçamento Enviado',  color: '#9d61ff' },
  CONTRATO_ATIVO:     { label: 'Contrato Ativo',     color: '#22c55e' },
  FINALIZADO:         { label: 'Finalizado',         color: '#3b82f6' },
};

export default function ClienteProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const [cliente, setCliente] = useState<any>(null);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [n8n, setN8n] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Cofre do Engenheiro (Anotações)
  const [anotacoes, setAnotacoes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Upsell Modal (+ Novo Projeto)
  const [showUpsell, setShowUpsell] = useState(false);
  const [submittingUpsell, setSubmittingUpsell] = useState(false);
  const [upsellData, setUpsellData] = useState({
    servicosSelecionados: [] as string[],
    valor_fechado: '',
    prazo_entrega: '',
    terceirizados: ''
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Revision admin state: maps projectId -> overrideValue being typed
  const [revOverride, setRevOverride] = useState<Record<string, string>>({});
  // Expanded history: set of projectIds with history panel open
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [adjustingRev, setAdjustingRev] = useState<string | null>(null);

  const handleCopyLink = (token: string, projectId: string) => {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(projectId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAdjustRevisoes = async (projectId: string, novoValor: number) => {
    setAdjustingRev(projectId);
    try {
      const updated = await ajustarRevisoesDisponiveis(projectId, novoValor);
      setProjetos(prev => prev.map(p => p.id === projectId ? { ...p, revisoes_disponiveis: updated.revisoes_disponiveis } : p));
    } catch (err: any) {
      alert('Erro ao ajustar revisões: ' + err.message);
    } finally {
      setAdjustingRev(null);
    }
  };

  const handleViewOrcamento = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const { cliente: cData, projetos: pData, n8n: nData } = await getClientProfileData(id);
        setCliente(cData);
        setAnotacoes(cData?.anotacoes || '');
        setProjetos(pData || []);
        if (nData) setN8n(nData);
      } catch (err: any) {
        console.error('Error fetching client data:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateClienteAnotacoes(id, anotacoes);
    } catch (error) {
      console.error('Erro ao salvar anotações:', error);
      alert('Erro ao salvar anotações.');
    }
    setSavingNotes(false);
  };

  const handleSubmitUpsell = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUpsell(true);

    const valorFechadoNum = upsellData.valor_fechado.replace(/\D/g, ''); 
    const isValorValid = valorFechadoNum.trim() !== '';
    const servicosStr = upsellData.servicosSelecionados.join(', ');
    const checklist = upsellData.servicosSelecionados.includes('Mixagem e Masterização') 
      ? MIX_MASTER_CHECKLIST.map(item => ({ item, done: false })) 
      : null;

    const newProject = {
      cliente_id: id,
      status_funil: 'Orçamento Enviado', // Starts at Orçamento Enviado since it's a direct flow
      tipo_servico: servicosStr,
      servicos_fechados: servicosStr,
      valor_fechado: isValorValid ? Number(valorFechadoNum) : null,
      prazo_entrega: upsellData.prazo_entrega || null,
      terceirizados: upsellData.terceirizados || null,
      checklist_preparacao: checklist,
      sinal_pago: false // Always starts false for a new upsell, they can change it later
    };

    try {
      const createdProj = await createUpsellProject(newProject);
      if (createdProj) {
        setProjetos([createdProj, ...projetos]);
        setShowUpsell(false);
        setUpsellData({ servicosSelecionados: [], valor_fechado: '', prazo_entrega: '', terceirizados: '' });
        router.refresh();
      }
    } catch (error: any) {
      console.error('Failed to create upsell project:', error.message);
      alert(`Erro ao criar projeto: ${error.message}`);
    } finally {
      setSubmittingUpsell(false);
    }
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Carregando perfil...</div>;

  if (!cliente) {
    return (
      <div style={{ padding: 40, color: 'var(--text-secondary)' }}>
        Cliente não encontrado. <Link href="/" style={{ color: 'var(--accent-light)' }}>Voltar</Link>
      </div>
    );
  }

  const fluxo = n8n && FLUXO_LABEL[n8n.status_fluxo] ? FLUXO_LABEL[n8n.status_fluxo] : null;
  const displayName = cliente.nome_artistico || cliente.nome_pessoal || 'N/A';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const receitaTotal = projetos
    .filter((p) => p.status_funil === 'Fechado' && p.valor_fechado)
    .reduce((a, p) => a + Number(p.valor_fechado || 0), 0);

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 36px)', maxWidth: 900 }} className="fade-up">
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button 
          onClick={() => router.back()} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Voltar
        </button>
        <button 
          onClick={() => setShowUpsell(true)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 6, background: '#22c55e', 
            color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, 
            fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(34,197,94,0.3)'
          }}
        >
          <Plus size={16} /> Novo Projeto (Upsell)
        </button>
      </div>

      {/* Profile Header */}
      <div className="glass" style={{ padding: '28px 30px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: 18, flexShrink: 0,
            background: 'linear-gradient(135deg, #7c3aed, #c084fc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 26, color: '#fff',
            boxShadow: '0 0 24px rgba(124,58,237,0.5)',
          }}>
            {initials}
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }} className="gradient-text">
                {displayName}
              </h1>
              {fluxo && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                  background: `${fluxo.color}20`, color: fluxo.color,
                  border: `1px solid ${fluxo.color}40`,
                }}>
                  <span className="pulse-dot" style={{ background: fluxo.color, display: 'inline-block', marginRight: 5, verticalAlign: 'middle' }} />
                  n8n: {fluxo.label}
                </span>
              )}
              {cliente.status_funil && (
                <span className="badge" style={{ 
                  background: getStatusTheme(cliente.status_funil).bg, 
                  color: getStatusTheme(cliente.status_funil).text,
                  border: `1px solid ${getStatusTheme(cliente.status_funil).border}`
                }}>
                  Funil: {cliente.status_funil}
                </span>
              )}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
              {cliente.nome_pessoal}
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { icon: '📱', val: cliente.telefone },
                { icon: '✉️', val: cliente.email },
                { icon: '📸', val: cliente.instagram },
                { icon: '🎂', val: cliente.data_nascimento ? new Date(cliente.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data' },
              ].filter(item => item.val).map((item) => (
                <span key={item.val} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {item.icon} {item.val}
                </span>
              ))}
            </div>
          </div>

          {/* Revenue & Total Projects badge */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>LTV (Lifetime Value)</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: receitaTotal > 0 ? '#22c55e' : 'var(--text-muted)' }}>
              {receitaTotal > 0 ? `R$ ${receitaTotal.toLocaleString('pt-BR')}` : '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4, fontWeight: 600 }}>
              {projetos.length} Projetos Realizados
            </div>
          </div>
        </div>
      </div>

      {/* Diagnóstico & Financeiro */}
      <div className="dashboard-grid" style={{ display: 'grid', gap: 20, marginBottom: 20 }}>
        {/* Diagnóstico */}
        <div className="glass" style={{ padding: '20px 24px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            📋 Diagnóstico n8n
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Serviço de Interesse', val: cliente.diag_servico_interesse || 'Não informado' },
              { label: 'Nível de Experiência', val: cliente.diag_nivel_experiencia || 'Não informado' },
              { label: 'Status dos Arquivos',  val: cliente.diag_status_arquivos || 'Não informado' },
              { label: 'Orçamento Previsto',   val: cliente.diag_capacidade_investimento || 'Não informado' },
            ].map(d => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{d.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Financeiro */}
        <div className="glass" style={{ padding: '20px 24px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            💰 Status Financeiro
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projetos.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nenhum projeto encontrado.</div>
            ) : (
              projetos.filter((p) => p.status_funil === 'Fechado').map(proj => (
                <div key={proj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '10px 14px', borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {proj.tipo_servico || 'Não informado'}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                      background: proj.sinal_pago ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: proj.sinal_pago ? '#22c55e' : '#ef4444'
                    }}>
                      {proj.sinal_pago ? 'Sinal ✔' : 'Sinal ⏳'}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                      background: proj.entrega_paga ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: proj.entrega_paga ? '#22c55e' : '#ef4444'
                    }}>
                      {proj.entrega_paga ? 'Entrega ✔' : 'Entrega ⏳'}
                    </span>
                  </div>
                </div>
              ))
            )}
            {projetos.filter((p) => p.status_funil === 'Fechado').length === 0 && projetos.length > 0 && (
               <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aguardando fechamento do projeto...</div>
            )}
          </div>
        </div>
      </div>

      {/* n8n Status & Cofre do Engenheiro */}
      <div style={{ display: 'grid', gridTemplateColumns: n8n ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 20 }} className={n8n ? 'dashboard-grid' : ''}>
        {n8n && (
          <div className="glass" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              🤖 Estado n8n — WhatsApp
            </h2>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                ID: {n8n.whatsapp_id} <br/>
                Última interação: {new Date(n8n.ultima_interacao).toLocaleString('pt-BR')}
              </div>
              <span style={{
                background: `${fluxo?.color}20`, color: fluxo?.color, fontWeight: 700,
                padding: '5px 14px', borderRadius: 999, fontSize: 12,
                border: `1px solid ${fluxo?.color}40`, display: 'inline-block'
              }}>
                {n8n.status_fluxo}
              </span>
            </div>
          </div>
        )}

        {/* Cofre do Engenheiro (Anotações Persistent Notes) */}
        <div className="glass" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔐 Cofre do Engenheiro
            </h2>
            <button 
              onClick={handleSaveNotes}
              disabled={savingNotes}
              style={{
                background: 'rgba(124,58,237,0.15)', color: 'var(--accent)', border: 'none',
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                cursor: savingNotes ? 'not-allowed' : 'pointer', transition: '0.2s',
                display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              <Save size={12} /> {savingNotes ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          <textarea
            value={anotacoes}
            onChange={e => setAnotacoes(e.target.value)}
            placeholder="Links de Stems, referências do Spotify, BPM, tom da música e observações..."
            style={{
              width: '100%', flex: 1, minHeight: 100, background: 'var(--bg-base)',
              border: '1px solid var(--border)', borderRadius: 8, padding: '12px',
              color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Project Timeline */}
      <div className="glass" style={{ padding: '24px 26px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>
          Histórico de Projetos ({projetos.length})
        </h2>
        {projetos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum projeto cadastrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {projetos.map((proj, i) => (
              <div key={proj.id} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', marginTop: 16, flexShrink: 0,
                    background: proj.status_funil === 'Fechado' ? '#22c55e'
                      : proj.status_funil === 'Perdido' ? '#ef4444'
                      : '#9d61ff',
                    boxShadow: `0 0 8px ${proj.status_funil === 'Fechado' ? '#22c55e' : proj.status_funil === 'Perdido' ? '#ef4444' : '#9d61ff'}`,
                  }} />
                  {i < projetos.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 4 }} />
                  )}
                </div>

                {/* Card */}
                <div style={{
                  flex: 1,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '16px',
                  marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Disc size={16} className="text-accent" /> {proj.nome || proj.servicos_fechados || proj.tipo_servico || 'Sem Nome'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {new Date(proj.created_at).toLocaleDateString('pt-BR')}
                        {proj.cupom_usado && ` · 🎟️ ${proj.cupom_usado}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {/* Ver Orçamento */}
                      {proj.orcamento_pdf_url && (
                        <button
                          onClick={() => handleViewOrcamento(proj.orcamento_pdf_url)}
                          style={{
                            background: 'rgba(124,58,237,0.1)',
                            border: '1px solid var(--accent)',
                            borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                            color: 'var(--accent-light)',
                            display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'all 0.2s', fontSize: 11, fontWeight: 700
                          }}
                        >
                          <FileText size={12} /> Ver Orçamento
                        </button>
                      )}

                      {/* Share Button */}
                      {proj.public_token && (
                        <button
                          onClick={() => handleCopyLink(proj.public_token, proj.id)}
                          style={{
                            background: copiedId === proj.id ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${copiedId === proj.id ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                            borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                            color: copiedId === proj.id ? '#22c55e' : 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'all 0.2s', fontSize: 11, fontWeight: 600
                          }}
                        >
                          {copiedId === proj.id ? <Check size={12} /> : <Share2 size={12} />}
                          {copiedId === proj.id ? 'Copiado!' : 'Link Ouro'}
                        </button>
                      )}

                      {/* Checklist Mix/Master display */}
                      {proj.checklist_preparacao && Array.isArray(proj.checklist_preparacao) && proj.checklist_preparacao.length > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6,
                          background: 'rgba(139,92,246,0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <CheckCircle size={12} /> Mix/Master: {proj.checklist_preparacao.filter((c: any) => c.done).length}/{proj.checklist_preparacao.length}
                        </span>
                      )}
                      
                      <span className="badge" style={{ 
                        background: getStatusTheme(proj.status_funil).bg, 
                        color: getStatusTheme(proj.status_funil).text,
                        border: `1px solid ${getStatusTheme(proj.status_funil).border}`
                      }}>
                        {proj.status_funil}
                      </span>
                    </div>
                  </div>

                  {/* Admin Revision Controls — only for projects in production */}
                  {proj.status_funil === 'Fechado' && (
                    <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        {/* Left: counters */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Disponíveis: </span>
                            <span style={{
                              fontWeight: 700,
                              color: (proj.revisoes_disponiveis ?? 3) === 0 ? '#6b7280'
                                : (proj.revisoes_disponiveis ?? 3) === 1 ? '#f59e0b'
                                : 'var(--accent-light)'
                            }}>
                              {proj.revisoes_disponiveis ?? 3}
                            </span>
                          </div>
                          <div style={{ fontSize: 12 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Usadas: </span>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {proj.contador_revisoes ?? 0}
                            </span>
                          </div>
                        </div>

                        {/* Right: adjustment buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => handleAdjustRevisoes(proj.id, Math.max(0, (proj.revisoes_disponiveis ?? 3) - 1))}
                            disabled={adjustingRev === proj.id || (proj.revisoes_disponiveis ?? 3) <= 0}
                            title="Remover 1 revisão disponível"
                            style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 14, fontWeight: 700,
                              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                              border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                              opacity: (proj.revisoes_disponiveis ?? 3) <= 0 ? 0.4 : 1
                            }}
                          >
                            −
                          </button>
                          {/* Manual override input */}
                          <input
                            type="number"
                            min={0} max={10}
                            value={revOverride[proj.id] ?? (proj.revisoes_disponiveis ?? 3)}
                            onChange={e => setRevOverride(prev => ({ ...prev, [proj.id]: e.target.value }))}
                            onBlur={e => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) handleAdjustRevisoes(proj.id, val);
                              setRevOverride(prev => { const n = { ...prev }; delete n[proj.id]; return n; });
                            }}
                            style={{
                              width: 40, textAlign: 'center', padding: '4px 4px', borderRadius: 6,
                              background: 'var(--bg-base)', border: '1px solid var(--border)',
                              color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, outline: 'none'
                            }}
                          />
                          <button
                            onClick={() => handleAdjustRevisoes(proj.id, Math.min(10, (proj.revisoes_disponiveis ?? 3) + 1))}
                            disabled={adjustingRev === proj.id || (proj.revisoes_disponiveis ?? 3) >= 10}
                            title="Restaurar 1 revisão"
                            style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 14, fontWeight: 700,
                              background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                              border: '1px solid rgba(34,197,94,0.2)', cursor: 'pointer',
                              opacity: (proj.revisoes_disponiveis ?? 3) >= 10 ? 0.4 : 1
                            }}
                          >
                            +
                          </button>
                          {adjustingRev === proj.id && (
                            <RefreshCw size={13} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                          )}
                        </div>
                      </div>

                      {/* Collapsible revision history */}
                      {Array.isArray(proj.historico_revisoes) && proj.historico_revisoes.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <button
                            onClick={() => setExpandedHistory(prev => {
                              const next = new Set(prev);
                              next.has(proj.id) ? next.delete(proj.id) : next.add(proj.id);
                              return next;
                            })}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                              display: 'flex', alignItems: 'center', gap: 5, padding: 0
                            }}
                          >
                            <History size={12} />
                            Ver histórico ({proj.historico_revisoes.length})
                            {expandedHistory.has(proj.id) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>

                          {expandedHistory.has(proj.id) && (
                            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {proj.historico_revisoes.map((rev: any, ri: number) => (
                                <div key={ri} style={{
                                  padding: '10px 12px', borderRadius: 8,
                                  background: 'var(--bg-base)', border: '1px solid var(--border)'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                      Revisão #{ri + 1}
                                    </span>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                      {new Date(rev.data).toLocaleString('pt-BR', {
                                        day: '2-digit', month: '2-digit', year: '2-digit',
                                        hour: '2-digit', minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>
                                    "{rev.motivo}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upsell Modal */}
      {showUpsell && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 1000, padding: 0
        }} className="fade-in">
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            padding: 'clamp(20px, 4vw, 32px)',
            borderRadius: '20px 20px 0 0',
            width: '100%', maxWidth: '100%',
            maxHeight: '90dvh', overflowY: 'auto',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.5)'
          }} className="fade-up">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Novo Projeto (Upsell)</h2>
              <button onClick={() => setShowUpsell(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitUpsell} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
                  Serviços (Múltipla Escolha)
                </label>
                <div className="form-grid-2" style={{ gap: 10 }}>
                  {SERVICOS.map((servico) => (
                    <label key={servico} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <input
                        type="checkbox"
                        checked={upsellData.servicosSelecionados.includes(servico)}
                        onChange={(e) => {
                          if (e.target.checked) setUpsellData(u => ({ ...u, servicosSelecionados: [...u.servicosSelecionados, servico] }));
                          else setUpsellData(u => ({ ...u, servicosSelecionados: u.servicosSelecionados.filter(s => s !== servico) }));
                        }}
                        style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{servico}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-grid-2" style={{ gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Valor Total (R$)</label>
                  <input
                    required type="number" placeholder="Ex: 800"
                    value={upsellData.valor_fechado}
                    onChange={e => setUpsellData({...upsellData, valor_fechado: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Prazo de Entrega</label>
                  <input
                    type="date"
                    value={upsellData.prazo_entrega}
                    onChange={e => setUpsellData({...upsellData, prazo_entrega: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Terceirizados (Split)</label>
                <input
                  type="text" placeholder="Ex: Beatmaker 20%"
                  value={upsellData.terceirizados}
                  onChange={e => setUpsellData({...upsellData, terceirizados: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', outline: 'none' }}
                />
              </div>

              <button 
                type="submit" disabled={submittingUpsell || upsellData.servicosSelecionados.length === 0}
                style={{
                  marginTop: 8, padding: '14px', borderRadius: 8,
                  background: 'var(--accent)', color: '#fff', fontWeight: 700,
                  border: 'none', cursor: (submittingUpsell || upsellData.servicosSelecionados.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (submittingUpsell || upsellData.servicosSelecionados.length === 0) ? 0.7 : 1, transition: '0.2s'
                }}
              >
                {submittingUpsell ? 'Iniciando Projeto...' : 'Iniciar Projeto no Funil'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
