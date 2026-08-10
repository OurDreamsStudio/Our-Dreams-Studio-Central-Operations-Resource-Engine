'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, CheckCircle, Disc, X, Share2, Check, FileText, RefreshCw, History, ChevronDown, ChevronUp, RotateCcw, StickyNote, Pencil, Trash2, Music, Bell, Sliders, BookOpen } from 'lucide-react';
import { SERVICOS, MIX_MASTER_CHECKLIST, ETAPAS_VENDAS, ETAPAS_PRODUCAO, getStatusTheme } from '@/constants/workflow';
import { getClientProfileData, updateClienteAnotacoesArray, createUpsellProject, ajustarRevisoesDisponiveis, desfazerEntregaProjeto } from '@/actions/databaseActions';
import { supabase } from '@/lib/supabase';

const FLUXO_LABEL: Record<string, { label: string; color: string }> = {
  AGUARDANDO_BASE:    { label: 'Aguardando Base',    color: '#8b8ba7' },
  EM_DIAGNOSTICO:     { label: 'Em Diagnóstico',     color: '#eab308' },
  ORCAMENTO_ENVIADO:  { label: 'Orçamento Enviado',  color: '#9d61ff' },
  CONTRATO_ATIVO:     { label: 'Contrato Ativo',     color: '#22c55e' },
  FINALIZADO:         { label: 'Finalizado',         color: '#3b82f6' },
};

// --- Anotações ---
type CategoriaKey = 'letra' | 'lembrete' | 'tecnico' | 'geral';

const CATEGORIAS: Record<CategoriaKey, { label: string; cor: string; icon: React.ReactNode }> = {
  letra:    { label: 'Letra',     cor: '#a855f7', icon: <Music     size={11} /> },
  lembrete: { label: 'Lembrete',  cor: '#f59e0b', icon: <Bell      size={11} /> },
  tecnico:  { label: 'Técnico',   cor: '#3b82f6', icon: <Sliders   size={11} /> },
  geral:    { label: 'Geral',     cor: '#22c55e', icon: <BookOpen  size={11} /> },
};

interface Anotacao {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: CategoriaKey;
  cor: string;
  criado_em: string;
  atualizado_em: string;
}

function parseLegacyNotes(raw: unknown): Anotacao[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Anotacao[];
  if (typeof raw === 'string') {
    // Tenta parsear como JSON primeiro
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Anotacao[];
    } catch {
      // é texto legado — converte para uma anotação geral
      if (raw.trim() === '') return [];
      return [{
        id: crypto.randomUUID(),
        titulo: 'Anotações Antigas',
        conteudo: raw,
        categoria: 'geral',
        cor: CATEGORIAS.geral.cor,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      }];
    }
  }
  return [];
}

export default function ClienteProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const [cliente, setCliente] = useState<any>(null);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [n8n, setN8n] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Anotações individualizadas
  const [notas, setNotas] = useState<Anotacao[]>([]);
  const [savingNotes, setSavingNotes] = useState(false);

  // Modal de anotação
  const [notaModal, setNotaModal] = useState<{
    open: boolean;
    editing: Anotacao | null;
  }>({ open: false, editing: null });
  const [notaForm, setNotaForm] = useState<{
    titulo: string;
    conteudo: string;
    categoria: CategoriaKey;
  }>({ titulo: '', conteudo: '', categoria: 'geral' });

  // Confirmação de exclusão
  const [deletingNotaId, setDeletingNotaId] = useState<string | null>(null);

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

  // Desfazer Entrega modal state
  const [desfazerModal, setDesfazerModal] = useState<{ id: string; nome: string } | null>(null);
  const [desfazerStage, setDesfazerStage] = useState<string>('Revisão');
  const [submittingDesfazer, setSubmittingDesfazer] = useState(false);

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

  const handleDesfazerEntrega = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desfazerModal) return;
    setSubmittingDesfazer(true);
    try {
      await desfazerEntregaProjeto(desfazerModal.id, desfazerStage);
      setProjetos(prev => prev.map(p =>
        p.id === desfazerModal.id
          ? { ...p, status_producao: desfazerStage, entrega_paga: false, data_aprovacao: null }
          : p
      ));
      setDesfazerModal(null);
      router.refresh();
    } catch (err: any) {
      alert('Erro ao desfazer entrega: ' + err.message);
    } finally {
      setSubmittingDesfazer(false);
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
        setNotas(parseLegacyNotes(cData?.anotacoes));
        setProjetos(pData || []);
        if (nData) setN8n(nData);
      } catch (err: any) {
        console.error('Error fetching client data:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Realtime: escuta mudanças no cliente e nos projetos vinculados
    const channel = supabase
      .channel(`realtime-cliente-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes', filter: `id=eq.${id}` }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projetos', filter: `cliente_id=eq.${id}` }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // --- Handlers de Anotações ---

  const openNewNota = () => {
    setNotaForm({ titulo: '', conteudo: '', categoria: 'geral' });
    setNotaModal({ open: true, editing: null });
  };

  const openEditNota = (nota: Anotacao) => {
    setNotaForm({ titulo: nota.titulo, conteudo: nota.conteudo, categoria: nota.categoria });
    setNotaModal({ open: true, editing: nota });
  };

  const closeNotaModal = () => {
    setNotaModal({ open: false, editing: null });
    setNotaForm({ titulo: '', conteudo: '', categoria: 'geral' });
  };

  const handleSaveNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notaForm.titulo.trim() || !notaForm.conteudo.trim()) return;
    setSavingNotes(true);
    const now = new Date().toISOString();
    let novasNotas: Anotacao[];

    if (notaModal.editing) {
      // Editar existente
      novasNotas = notas.map(n =>
        n.id === notaModal.editing!.id
          ? { ...n, titulo: notaForm.titulo, conteudo: notaForm.conteudo, categoria: notaForm.categoria, cor: CATEGORIAS[notaForm.categoria].cor, atualizado_em: now }
          : n
      );
    } else {
      // Nova anotação
      const nova: Anotacao = {
        id: crypto.randomUUID(),
        titulo: notaForm.titulo,
        conteudo: notaForm.conteudo,
        categoria: notaForm.categoria,
        cor: CATEGORIAS[notaForm.categoria].cor,
        criado_em: now,
        atualizado_em: now,
      };
      novasNotas = [nova, ...notas];
    }

    try {
      await updateClienteAnotacoesArray(id, novasNotas);
      setNotas(novasNotas);
      closeNotaModal();
    } catch (err: any) {
      alert('Erro ao salvar anotação: ' + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteNota = async (notaId: string) => {
    const novasNotas = notas.filter(n => n.id !== notaId);
    try {
      await updateClienteAnotacoesArray(id, novasNotas);
      setNotas(novasNotas);
    } catch (err: any) {
      alert('Erro ao excluir anotação: ' + err.message);
    } finally {
      setDeletingNotaId(null);
    }
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
      <div className="responsive-grid-2" style={{ marginBottom: 20 }}>
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

      {/* n8n Status */}
      {n8n && (
        <div className="glass" style={{ padding: '20px 24px', marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            🤖 Estado n8n — WhatsApp
          </h2>
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
      )}

      {/* ===== ANOTAÇÕES ===== */}
      <div className="glass" style={{ padding: '20px 24px', marginBottom: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <StickyNote size={15} /> Anotações
            {notas.length > 0 && (
              <span style={{
                background: 'rgba(124,58,237,0.2)', color: 'var(--accent-light)',
                borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700
              }}>{notas.length}</span>
            )}
          </h2>
          <button
            onClick={openNewNota}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(124,58,237,0.15)', color: 'var(--accent-light)',
              border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8,
              padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Plus size={13} /> Nova Anotação
          </button>
        </div>

        {/* Cards */}
        {notas.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 20px',
            border: '1px dashed var(--border)', borderRadius: 12,
            color: 'var(--text-muted)', fontSize: 13
          }}>
            <StickyNote size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>Nenhuma anotação ainda.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Adicione letras, lembretes técnicos ou observações sobre o artista.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {notas.map(nota => {
              const cat = CATEGORIAS[nota.categoria] || CATEGORIAS.geral;
              const isDeleting = deletingNotaId === nota.id;
              return (
                <div
                  key={nota.id}
                  style={{
                    background: 'var(--bg-base)',
                    border: `1px solid ${nota.cor}40`,
                    borderLeft: `3px solid ${nota.cor}`,
                    borderRadius: 10,
                    padding: '14px',
                    position: 'relative',
                    transition: 'box-shadow 0.2s',
                    cursor: 'pointer',
                  }}
                  className="nota-card"
                >
                  {/* Categoria badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: `${nota.cor}20`, color: nota.cor,
                      border: `1px solid ${nota.cor}40`,
                      borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 700
                    }}>
                      {cat.icon} {cat.label}
                    </span>
                    {/* Ações */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={e => { e.stopPropagation(); openEditNota(nota); }}
                        title="Editar"
                        style={{
                          background: 'rgba(255,255,255,0.05)', border: 'none',
                          color: 'var(--text-muted)', borderRadius: 6,
                          padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                        }}
                      >
                        <Pencil size={11} />
                      </button>
                      {isDeleting ? (
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteNota(nota.id); }}
                          title="Confirmar exclusão"
                          style={{
                            background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
                            color: '#ef4444', borderRadius: 6,
                            padding: '4px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3
                          }}
                        >
                          <Trash2 size={10} /> Confirmar
                        </button>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setDeletingNotaId(nota.id); setTimeout(() => setDeletingNotaId(null), 3000); }}
                          title="Excluir"
                          style={{
                            background: 'rgba(255,255,255,0.05)', border: 'none',
                            color: 'var(--text-muted)', borderRadius: 6,
                            padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Título */}
                  <div
                    onClick={() => openEditNota(nota)}
                    style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.3 }}
                  >
                    {nota.titulo}
                  </div>

                  {/* Preview do conteúdo */}
                  <div
                    onClick={() => openEditNota(nota)}
                    style={{
                      fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}
                  >
                    {nota.conteudo}
                  </div>

                  {/* Timestamp */}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>
                    {new Date(nota.atualizado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                      
                      {/* Desfazer Entrega — only when project is delivered */}
                      {proj.status_producao === 'Entregue' && (
                        <button
                          onClick={() => {
                            setDesfazerModal({ id: proj.id, nome: proj.nome || proj.servicos_fechados || 'Projeto' });
                            setDesfazerStage('Revisão');
                          }}
                          title="Desfazer entrega e retornar ao kanban de produção"
                          style={{
                            background: 'rgba(245,158,11,0.1)',
                            border: '1px solid rgba(245,158,11,0.3)',
                            borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
                            color: '#f59e0b',
                            display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'all 0.2s', fontSize: 11, fontWeight: 700
                          }}
                        >
                          <RotateCcw size={12} /> Desfazer Entrega
                        </button>
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
                                    "{typeof rev.motivo === 'string' ? rev.motivo : (rev.motivo?.resumo || JSON.stringify(rev.motivo))}"
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

      {/* ===== MODAL DE ANOTAÇÃO ===== */}
      {notaModal.open && (
        <div
          onClick={closeNotaModal}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20
          }}
          className="fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${CATEGORIAS[notaForm.categoria].cor}40`,
              padding: 28, borderRadius: 18,
              width: '100%', maxWidth: 520,
              boxShadow: `0 24px 60px rgba(0,0,0,0.65), 0 0 40px ${CATEGORIAS[notaForm.categoria].cor}15`,
              display: 'flex', flexDirection: 'column', gap: 18,
              transition: 'box-shadow 0.3s',
            }}
            className="fade-up"
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${CATEGORIAS[notaForm.categoria].cor}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: CATEGORIAS[notaForm.categoria].cor
                }}>
                  <StickyNote size={17} />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                  {notaModal.editing ? 'Editar Anotação' : 'Nova Anotação'}
                </h2>
              </div>
              <button
                onClick={closeNotaModal}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNota} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Categoria Selector */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Categoria
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(Object.entries(CATEGORIAS) as [CategoriaKey, typeof CATEGORIAS[CategoriaKey]][]).map(([key, cat]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNotaForm(f => ({ ...f, categoria: key }))}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.18s',
                        border: `1.5px solid ${notaForm.categoria === key ? cat.cor : 'var(--border)'}`,
                        background: notaForm.categoria === key ? `${cat.cor}22` : 'var(--bg-base)',
                        color: notaForm.categoria === key ? cat.cor : 'var(--text-muted)',
                        transform: notaForm.categoria === key ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Título
                </label>
                <input
                  autoFocus
                  required
                  type="text"
                  placeholder={
                    notaForm.categoria === 'letra' ? 'Ex: Letra — Verso 1' :
                    notaForm.categoria === 'lembrete' ? 'Ex: Enviar stems até sexta' :
                    notaForm.categoria === 'tecnico' ? 'Ex: BPM, Tom e referências' : 'Título da anotação'
                  }
                  value={notaForm.titulo}
                  onChange={e => setNotaForm(f => ({ ...f, titulo: e.target.value }))}
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 8,
                    background: 'var(--bg-base)',
                    border: `1px solid ${notaForm.titulo ? CATEGORIAS[notaForm.categoria].cor + '50' : 'var(--border)'}`,
                    color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                />
              </div>

              {/* Conteúdo */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Conteúdo
                </label>
                <textarea
                  required
                  placeholder={
                    notaForm.categoria === 'letra' ? 'Cole aqui a letra da música, voz guia ou trecho...' :
                    notaForm.categoria === 'lembrete' ? 'Descreva o lembrete ou tarefa...' :
                    notaForm.categoria === 'tecnico' ? 'BPM: 128\nTom: Lá menor\nReferências: ...' :
                    'Escreva sua observação aqui...'
                  }
                  value={notaForm.conteudo}
                  onChange={e => setNotaForm(f => ({ ...f, conteudo: e.target.value }))}
                  rows={8}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 8,
                    background: 'var(--bg-base)',
                    border: `1px solid ${notaForm.conteudo ? CATEGORIAS[notaForm.categoria].cor + '50' : 'var(--border)'}`,
                    color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', outline: 'none',
                    lineHeight: 1.6, fontFamily: notaForm.categoria === 'letra' ? 'Georgia, serif' : 'inherit',
                    transition: 'border-color 0.2s',
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={closeNotaModal}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 8,
                    background: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 600,
                    border: '1px solid var(--border)', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingNotes || !notaForm.titulo.trim() || !notaForm.conteudo.trim()}
                  style={{
                    flex: 2, padding: '11px', borderRadius: 8,
                    background: CATEGORIAS[notaForm.categoria].cor, color: '#fff', fontWeight: 700,
                    border: 'none',
                    cursor: (savingNotes || !notaForm.titulo.trim() || !notaForm.conteudo.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (savingNotes || !notaForm.titulo.trim() || !notaForm.conteudo.trim()) ? 0.6 : 1,
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {savingNotes ? 'Salvando...' : notaModal.editing ? '✔ Salvar Alterações' : '+ Criar Anotação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Desfazer Entrega Modal */}
      {desfazerModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }} className="fade-in">
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid rgba(245,158,11,0.3)',
            padding: 28, borderRadius: 16,
            width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(245,158,11,0.05)'
          }} className="fade-up">

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={18} style={{ color: '#f59e0b' }} />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Desfazer Entrega</h2>
              </div>
              <button onClick={() => setDesfazerModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              marginBottom: 20, fontSize: 13, color: '#fcd34d', lineHeight: 1.5
            }}>
              ⚠️ Você está revertendo a entrega de <strong>{desfazerModal.nome}</strong>. O status de <em>entrega paga</em> e a <em>data de aprovação</em> serão redefinidos.
            </div>

            <form onSubmit={handleDesfazerEntrega} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                  Retornar para qual etapa do Kanban de Produção?
                </label>
                <select
                  value={desfazerStage}
                  onChange={e => setDesfazerStage(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 8,
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: '#fff', outline: 'none', fontSize: 14
                  }}
                >
                  {ETAPAS_PRODUCAO.filter(e => e !== 'Entregue').map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setDesfazerModal(null)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8,
                    background: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 600,
                    border: '1px solid var(--border)', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingDesfazer}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8,
                    background: 'rgba(245,158,11,0.9)', color: '#000', fontWeight: 700,
                    border: 'none', cursor: submittingDesfazer ? 'not-allowed' : 'pointer',
                    opacity: submittingDesfazer ? 0.7 : 1, transition: '0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  <RotateCcw size={14} />
                  {submittingDesfazer ? 'Revertendo...' : 'Confirmar Reversão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
