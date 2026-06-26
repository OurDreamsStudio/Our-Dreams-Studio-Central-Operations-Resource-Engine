'use client';

import { useState, useEffect, useTransition } from 'react';
import { CustoFixo, AtivoHardware } from '@/types';

interface EfiData {
  receitaBrutaTotal: number;
  receitaMesAtual: number;
  recebiveisProjetos: number;
  projecaoTotal: number;
  totalSplits: number;
  splitsPendentes: number;
  OpExMensal: number;
  valorInventarioAtual: number;
  ltvRanking: { nome: string; receita: number }[];
  margemContribuicao: number;
  lucroOperacional: number;
}
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  HardDrive, 
  Plus, 
  Trash2, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  Calendar,
  Layers,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Eye,
  Archive,
  RefreshCcw,
  Pencil
} from 'lucide-react';
import { handleSupabaseError } from '@/lib/utils';
import { 
  getCustosFixos, 
  saveCustoFixo, 
  deleteCustoFixo, 
  getAtivosHardware, 
  saveAtivoHardware, 
  getFinancialIntelligence,
  getOrcamentos,
  saveOrcamentoLink,
  toggleArchiveOrcamento,
  updateOrcamentoLink,
  removeOrcamentoLink
} from '@/actions/financeiroActions';
import { getClientes, getProjetos } from '@/actions/databaseActions';
import { supabase } from '@/lib/supabase';

const getBudgetStatus = (o: any) => {
  if (o.status_funil === 'Perdido') return 'Perdido';
  if (o.status_funil === 'Fechado') {
    if (o.entrega_paga || o.status_producao === 'Entregue') return 'Concluído';
    if (o.sinal_pago) return '50% Pago';
    return 'Fechado';
  }
  return 'Negociação';
};

const getBudgetStatusStyle = (status: string) => {
  switch (status) {
    case 'Negociação':
      return { border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' };
    case 'Fechado':
      return { border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    case 'Perdido':
      return { border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
    case '50% Pago':
      return { border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
    case 'Concluído':
      return { border: '1px solid rgba(34, 197, 94, 0.4)', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)' };
    default:
      return { border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' };
  }
};

export default function FinanceiroPage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orcamentos'>('dashboard');
  
  const [efi, setEfi] = useState<EfiData | null>(null);
  const [custos, setCustos] = useState<CustoFixo[]>([]);
  const [ativos, setAtivos] = useState<AtivoHardware[]>([]);
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [projetosSemPdf, setProjetosSemPdf] = useState<any[]>([]);

  // Modals
  const [showCustoModal, setShowCustoModal] = useState(false);
  const [showAtivoModal, setShowAtivoModal] = useState(false);
  const [showOrcamentoModal, setShowOrcamentoModal] = useState(false);
  
  const [isNewProject, setIsNewProject] = useState(false);
  const [orcamentoLink, setOrcamentoLink] = useState('');
  const [orcamentoProjetoId, setOrcamentoProjetoId] = useState('');
  const [orcamentoClienteId, setOrcamentoClienteId] = useState('');
  const [orcamentoNome, setOrcamentoNome] = useState('');
  const [orcamentoTipo, setOrcamentoTipo] = useState('');
  const [orcamentoValor, setOrcamentoValor] = useState('');
  const [orcamentoClassification, setOrcamentoClassification] = useState('Negociação');

  // Editar link e status
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrcamento, setEditingOrcamento] = useState<any>(null);
  const [editLink, setEditLink] = useState('');
  const [editClassification, setEditClassification] = useState('Negociação');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [intel, c, a, orcs, cls, projs] = await Promise.all([
        getFinancialIntelligence(),
        getCustosFixos(),
        getAtivosHardware(),
        getOrcamentos(),
        getClientes(),
        getProjetos()
      ]);
      setEfi(intel);
      setCustos(c);
      setAtivos(a);
      setOrcamentos(orcs || []);
      setClientes(cls || []);
      setProjetosSemPdf((projs || []).filter(p => !p.orcamento_pdf_url && p.status_producao !== 'Cancelado'));
    } catch (e: any) {
      alert('Erro ao carregar dados financeiros: ' + handleSupabaseError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Realtime: refaz fetch em mudanças nas tabelas financeiras
    const channel = supabase
      .channel('realtime-financeiro')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projetos' }, () => { fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => { fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custos_fixos' }, () => { fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, () => { fetchData(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSaveCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const data = Object.fromEntries(fd.entries());
    startTransition(async () => {
      await saveCustoFixo(null, data);
      setShowCustoModal(false);
      fetchData();
    });
  };

  const handleSaveAtivo = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const data = Object.fromEntries(fd.entries());
    startTransition(async () => {
      await saveAtivoHardware(null, {
        ...data,
        valor_compra: Number(data.valor_compra),
        vida_util_meses: Number(data.vida_util_meses)
      });
      setShowAtivoModal(false);
      fetchData();
    });
  };

  const handleDeleteCusto = async (id: string) => {
    if (!confirm('Excluir este custo fixo?')) return;
    startTransition(async () => {
      await deleteCustoFixo(id);
      fetchData();
    });
  };

  const handleSaveOrcamento = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (isNewProject) {
          await saveOrcamentoLink(true, orcamentoLink, undefined, {
            clienteId: orcamentoClienteId,
            nomeProjeto: orcamentoNome,
            tipoServico: orcamentoTipo,
            valorFechado: Number(orcamentoValor) || 0,
            statusClassification: orcamentoClassification,
          });
        } else {
          await saveOrcamentoLink(false, orcamentoLink, orcamentoProjetoId);
        }
        setShowOrcamentoModal(false);
        setOrcamentoLink('');
        setOrcamentoProjetoId('');
        setOrcamentoClienteId('');
        setOrcamentoNome('');
        setOrcamentoTipo('');
        setOrcamentoValor('');
        setOrcamentoClassification('Negociação');
        fetchData();
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  const handleOpenLink = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenEditModal = (o: any) => {
    setEditingOrcamento(o);
    setEditLink(o.orcamento_pdf_url || '');
    setEditClassification(getBudgetStatus(o));
    setShowEditModal(true);
  };

  const handleSaveEditLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrcamento) return;
    startTransition(async () => {
      try {
        await updateOrcamentoLink(editingOrcamento.id, editLink, editClassification);
        setShowEditModal(false);
        setEditingOrcamento(null);
        setEditLink('');
        setEditClassification('Negociação');
        fetchData();
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  const handleToggleArchive = async (id: string, current: boolean) => {
    startTransition(async () => {
       await toggleArchiveOrcamento(id, !current);
       fetchData();
    });
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Tem certeza que deseja apagar o link deste orçamento? Isso não excluirá o projeto, apenas removerá o link.')) return;
    startTransition(async () => {
      try {
        await removeOrcamentoLink(id);
        fetchData();
      } catch (err: any) {
        alert(err.message);
      }
    });
  };



  if (loading && !efi) {
    return (
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  if (!efi) {
    return (
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Não foi possível carregar os dados financeiros. Tente novamente mais tarde.
      </div>
    );
  }

  const receitaMesAtual = efi.receitaMesAtual ?? 0;
  const breakEvenProgress = Math.min(100, (receitaMesAtual / (efi.OpExMensal || 1)) * 100);
  const faltaParaBreakEven = Math.max(0, efi.OpExMensal - receitaMesAtual);

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 40px)', maxWidth: 1400, margin: '0 auto' }} className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Enterprise <span className="gradient-text">Financial Intelligence</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Análise Operacional, Fluxo de Caixa e Gestão de Orçamentos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {activeTab === 'dashboard' ? (
            <>
              <button onClick={() => setShowCustoModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={16} /> Novo Custo Fixo
              </button>
              <button onClick={() => setShowAtivoModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 15px var(--accent-glow)' }}>
                <HardDrive size={16} /> Registrar Ativo
              </button>
            </>
          ) : (
            <button onClick={() => setShowOrcamentoModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 15px var(--accent-glow)' }}>
              <Plus size={16} /> Novo Orçamento PDF
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <button 
          onClick={() => setActiveTab('dashboard')} 
          style={{ background: 'none', border: 'none', fontSize: 14, fontWeight: 700, color: activeTab === 'dashboard' ? 'var(--accent-light)' : 'var(--text-secondary)', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <BarChart3 size={18} /> Inteligência Financeira
        </button>
        <button 
          onClick={() => setActiveTab('orcamentos')} 
          style={{ background: 'none', border: 'none', fontSize: 14, fontWeight: 700, color: activeTab === 'orcamentos' ? 'var(--accent-light)' : 'var(--text-secondary)', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <FileText size={18} /> Orçamentos (PDFs)
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* Quick Metrics Row */}
          <div className="stats-grid" style={{ display: 'grid', gap: 20, marginBottom: 32 }}>
            {[
              { label: 'Receita em Caixa', value: `R$ ${efi.receitaBrutaTotal.toLocaleString('pt-BR')}`, icon: <TrendingUp className="text-green" />, color: 'var(--green)', sub: 'Pagamentos efetivamente recebidos' },
              { label: 'A Receber', value: `R$ ${efi.recebiveisProjetos.toLocaleString('pt-BR')}`, icon: <ArrowUpRight style={{ color: '#eab308' }} />, color: '#eab308', sub: 'Parcelas pendentes de projetos ativos' },
              { label: 'Projeção Total', value: `R$ ${efi.projecaoTotal.toLocaleString('pt-BR')}`, icon: <Target className="text-accent" />, color: 'var(--accent-light)', sub: 'Caixa + pipeline completo' },
              { label: 'Repasses (Splits)', value: `R$ ${efi.totalSplits.toLocaleString('pt-BR')}`, icon: <TrendingDown className="text-red" />, color: '#ef4444', sub: 'Total alocado a terceiros' },
              { label: 'OpEx Mensal (Fixo)', value: `R$ ${efi.OpExMensal.toLocaleString('pt-BR')}`, icon: <Layers className="text-muted" />, color: 'var(--text-secondary)', sub: 'Custos fixos mensais' },
            ].map((m, i) => (
              <div key={i} className="glass" style={{ padding: 20, borderRadius: 16 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  {m.label} {m.icon}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
                {m.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{m.sub}</div>}
              </div>
            ))}
          </div>

          {/* Main Grid: Charts & Tables */}
          <div className="dashboard-grid" style={{ display: 'grid', gap: 24, marginBottom: 24 }}>
            {/* Left Column: Line Chart & DRE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Fluxo de Caixa Visualization */}
              <div className="glass" style={{ padding: 24, borderRadius: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Fluxo de Caixa Operacional</h3>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} /> Recebíveis</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> Saídas</span>
                  </div>
                </div>
                <div style={{ height: 180, width: '100%', position: 'relative', marginTop: 20 }}>
                   <svg width="100%" height="100%" viewBox="0 0 800 180" preserveAspectRatio="none">
                     <path d="M0,150 Q100,120 200,140 T400,60 T600,40 T800,20" fill="none" stroke="var(--accent)" strokeWidth="3" />
                     <path d="M0,160 Q100,165 200,155 T400,170 T600,160 T800,155" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="5" />
                   </svg>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>
                     <span>JAN</span><span>FEV</span><span>MAR (HOJE)</span><span>ABR</span><span>MAI</span><span>JUN</span>
                   </div>
                </div>
              </div>

              {/* DRE Table */}
              <div className="glass" style={{ padding: 0, borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>DRE Operacional (Histórico Consolidado)</h3>
                </div>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 500 }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Receita em Caixa (Pagamentos Recebidos)</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>+ R$ {efi.receitaBrutaTotal.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(234,179,8,0.04)' }}>
                      <td style={{ padding: '16px 24px', color: '#eab308' }}>(↑) A Receber (Pipeline Ativo)</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: '#eab308' }}>+ R$ {efi.recebiveisProjetos.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(167,139,250,0.06)' }}>
                      <td style={{ padding: '16px 24px', fontWeight: 700 }}>(=) Projeção Total</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, color: 'var(--accent-light)' }}>R$ {efi.projecaoTotal.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>(-) Repasses a Terceiros (Splits/Comissão)</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>- R$ {efi.totalSplits.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(124,58,237,0.05)' }}>
                      <td style={{ padding: '16px 24px', fontWeight: 700 }}>(=) Margem de Contribuição</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, color: 'var(--accent-light)' }}>R$ {efi.margemContribuicao.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>(-) Custos Fixos (OpEx / Infra)</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>- R$ {efi.OpExMensal.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                      <td style={{ padding: '20px 24px', fontWeight: 800, fontSize: 16 }}>(=) Lucro Operacional Líquido</td>
                      <td style={{ padding: '20px 24px', textAlign: 'right', fontWeight: 900, fontSize: 20, color: efi.lucroOperacional > 0 ? 'var(--green)' : '#ef4444' }}>
                        R$ {efi.lucroOperacional.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
            </div>

            {/* Right Column: Intelligence & Inventory */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="glass" style={{ padding: 24, borderRadius: 20, textAlign: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <BarChart3 size={16} /> Break-even Mensal
                </h3>
                <div style={{ position: 'relative', width: 140, height: 70, margin: '0 auto 16px' }}>
                  <svg width="140" height="70">
                    <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${breakEvenProgress * 1.88}, 1000`} />
                  </svg>
                  <div style={{ fontSize: 20, fontWeight: 800, position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)' }}>
                    {Math.round(breakEvenProgress)}%
                  </div>
                </div>
                {faltaParaBreakEven > 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Faltam <span style={{ color: '#ef4444', fontWeight: 700 }}>R$ {faltaParaBreakEven.toLocaleString('pt-BR')}</span> para cobrir os custos fixos.
                  </p>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                    <CheckCircle2 size={14} /> Custos Fixos pagos este mês!
                  </div>
                )}
              </div>

              <div className="glass" style={{ padding: 24, borderRadius: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HardDrive size={16} /> Inventário de Hardware
                </h3>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-light)' }}>
                    R$ {efi.valorInventarioAtual.toLocaleString('pt-BR')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Patrimonial Atualizado</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ativos.slice(0, 3).map(a => (
                    <div key={a.id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{a.item}</span>
                      <span style={{ fontWeight: 600 }}>R$ {Number(a.valor_compra).toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                  {ativos.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum ativo registrado.</div>}
                </div>
              </div>

              <div className="glass" style={{ padding: 24, borderRadius: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowUpRight size={16} /> Top Clientes (LTV)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {efi.ltvRanking.map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: i === 0 ? 'gold' : 'rgba(255,255,255,0.05)', color: i === 0 ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>
                        {i+1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>R$ {c.receita.toLocaleString('pt-BR')} faturados</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tables Row: Full Management */}
          <div className="dashboard-grid" style={{ display: 'grid', gap: 24 }}>
            <div className="glass" style={{ padding: 0, borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Gestão de Custos Fixos</h3>
              </div>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 400 }}>
                 <thead>
                   <tr style={{ background: 'rgba(0,0,0,0.2)', textAlign: 'left', color: 'var(--text-muted)' }}>
                     <th style={{ padding: '12px 24px' }}>DESCRIÇÃO</th>
                     <th style={{ padding: '12px 24px' }}>CATEGORIA</th>
                     <th style={{ padding: '12px 24px', textAlign: 'right' }}>VALOR</th>
                     <th style={{ padding: '12px 24px', textAlign: 'right' }}>AÇÕES</th>
                   </tr>
                 </thead>
                 <tbody>
                   {custos.map(c => (
                     <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                       <td style={{ padding: '12px 24px' }}>
                         {c.descricao}
                         <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Vence dia {c.vencimento_dia}</div>
                       </td>
                       <td style={{ padding: '12px 24px' }}>
                         <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                           {c.categoria}
                         </span>
                       </td>
                       <td style={{ padding: '12px 24px', textAlign: 'right', fontWeight: 600 }}>R$ {Number(c.valor).toLocaleString('pt-BR')}</td>
                       <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                         <button onClick={() => handleDeleteCusto(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                       </td>
                     </tr>
                   ))}
                   {custos.length === 0 && <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum custo fixo cadastrado.</td></tr>}
                 </tbody>
              </table>
              </div>
            </div>

            <div className="glass" style={{ padding: 0, borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Inventário de Ativos (Real Estate)</h3>
              </div>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 400 }}>
                 <thead>
                   <tr style={{ background: 'rgba(0,0,0,0.2)', textAlign: 'left', color: 'var(--text-muted)' }}>
                     <th style={{ padding: '12px 24px' }}>ITEM</th>
                     <th style={{ padding: '12px 24px' }}>DATA COMPRA</th>
                     <th style={{ padding: '12px 24px', textAlign: 'right' }}>VALOR ORIGINAL</th>
                     <th style={{ padding: '12px 24px', textAlign: 'right' }}>VIDA ÚTIL</th>
                   </tr>
                 </thead>
                 <tbody>
                   {ativos.map(a => (
                     <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                       <td style={{ padding: '12px 24px', fontWeight: 600 }}>{a.item}</td>
                       <td style={{ padding: '12px 24px', color: 'var(--text-secondary)' }}>{new Date(a.data_compra).toLocaleDateString()}</td>
                       <td style={{ padding: '12px 24px', textAlign: 'right', color: 'var(--accent-light)' }}>R$ {Number(a.valor_compra).toLocaleString('pt-BR')}</td>
                       <td style={{ padding: '12px 24px', textAlign: 'right' }}>{a.vida_util_meses} meses</td>
                     </tr>
                   ))}
                   {ativos.length === 0 && <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum equipamento registrado.</td></tr>}
                 </tbody>
              </table>
             </div>
           </div>
         </div>
       </>
      )}

      {/* TABS CONTENT: ORCAMENTOS */}
      {activeTab === 'orcamentos' && (
        <div className="glass" style={{ padding: 0, borderRadius: 20, overflow: 'hidden' }}>
           <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h3 style={{ fontSize: 16, fontWeight: 700 }}>Orçamentos Registrados</h3>
           </div>
           <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
           <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 600 }}>
             <thead>
               <tr style={{ background: 'rgba(0,0,0,0.2)', textAlign: 'left', color: 'var(--text-muted)' }}>
                 <th style={{ padding: '16px 24px' }}>PROJETO / CLIENTE</th>
                 <th style={{ padding: '16px 24px' }}>DATA</th>
                 <th style={{ padding: '16px 24px', textAlign: 'right' }}>VALOR FECHADO</th>
                 <th style={{ padding: '16px 24px', textAlign: 'center' }}>STATUS</th>
                 <th style={{ padding: '16px 24px', textAlign: 'right' }}>AÇÕES</th>
               </tr>
             </thead>
             <tbody>
               {orcamentos.map((o) => (
                 <tr key={o.id} style={{ borderBottom: '1px solid var(--border)', opacity: o.orcamento_arquivado ? 0.6 : 1 }}>
                   <td style={{ padding: '16px 24px' }}>
                     <div style={{ fontWeight: 700 }}>{o.nome}</div>
                     <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                       {(o.clientes as any)?.nome_artistico || (o.clientes as any)?.nome_pessoal}
                     </div>
                   </td>
                   <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                     {new Date(o.created_at).toLocaleDateString('pt-BR')}
                   </td>
                   <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-light)' }}>
                     R$ {Number(o.valor_fechado || 0).toLocaleString('pt-BR')}
                   </td>
                   <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                     <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                       <span style={{ 
                         padding: '4px 10px', 
                         borderRadius: 6, 
                         fontSize: 11, 
                         fontWeight: 700,
                         textTransform: 'uppercase',
                         letterSpacing: '0.03em',
                         ...getBudgetStatusStyle(getBudgetStatus(o))
                       }}>
                         {getBudgetStatus(o)}
                       </span>
                       {o.orcamento_arquivado && (
                         <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                           ARQUIVADO
                         </span>
                       )}
                     </div>
                   </td>
                   <td style={{ padding: '16px 24px', textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                     <button onClick={() => handleOpenLink(o.orcamento_pdf_url)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                       <Eye size={14} /> Abrir Link
                     </button>
                     <button onClick={() => handleOpenEditModal(o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'rgba(124,58,237,0.08)', color: 'var(--accent-light)', border: '1px solid rgba(124,58,237,0.3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                       <Pencil size={14} /> Editar
                     </button>
                     <button onClick={() => handleToggleArchive(o.id, o.orcamento_arquivado)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'transparent', color: o.orcamento_arquivado ? 'var(--green)' : 'var(--text-secondary)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                       {o.orcamento_arquivado ? <RefreshCcw size={14} /> : <Archive size={14} />} 
                       {o.orcamento_arquivado ? 'Desarquivar' : 'Arquivar'}
                     </button>
                   </td>
                 </tr>
               ))}
               {orcamentos.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum orçamento registrado ainda.</td></tr>}
             </tbody>
           </table>
           </div>
        </div>
      )}

      {/* Modals */}
      {showCustoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>Novo Custo Fixo</h3>
              <button onClick={() => setShowCustoModal(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveCusto} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Descrição</label>
                <input name="descricao" className="field-input" placeholder="Ex: Aluguel Estúdio" required />
              </div>
              <div className="form-grid-2" style={{ gap: 16 }}>
                <div>
                  <label className="field-label">Valor (R$)</label>
                  <input name="valor" type="number" step="0.01" className="field-input" placeholder="0.00" required />
                </div>
                <div>
                  <label className="field-label">Dia do Vencimento</label>
                  <input name="vencimento_dia" type="number" min="1" max="31" className="field-input" defaultValue="10" required />
                </div>
              </div>
              <div>
                <label className="field-label">Categoria</label>
                <select name="categoria" className="field-input" required>
                  <option value="Serviços (Luz/Água)">Serviços (Luz/Água)</option>
                  <option value="Aluguel/IPTU">Aluguel/IPTU</option>
                  <option value="Software/Assinaturas">Software/Assinaturas</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <button type="submit" disabled={isPending} className="btn-primary" style={{ marginTop: 12 }}>
                {isPending ? 'Salvando...' : 'Salvar Custo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showAtivoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>Registrar Novo Ativo</h3>
              <button onClick={() => setShowAtivoModal(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveAtivo} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Equipamento</label>
                <input name="item" className="field-input" placeholder="Ex: Mac Studio M2" required />
              </div>
              <div className="form-grid-2" style={{ gap: 16 }}>
                <div>
                  <label className="field-label">Valor de Compra (R$)</label>
                  <input name="valor_compra" type="number" step="0.01" className="field-input" placeholder="0.00" required />
                </div>
                <div>
                  <label className="field-label">Vida Útil (Meses)</label>
                  <input name="vida_util_meses" type="number" className="field-input" defaultValue="60" required />
                </div>
              </div>
              <div>
                <label className="field-label">Data de Compra</label>
                <input name="data_compra" type="date" className="field-input" defaultValue={new Date().toISOString().split('T')[0]} required />
              </div>
              <button type="submit" disabled={isPending} className="btn-primary" style={{ marginTop: 12 }}>
                {isPending ? 'Salvando...' : 'Registrar Ativo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showOrcamentoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Registrar Link de Orçamento</h3>
              <button type="button" onClick={() => setShowOrcamentoModal(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveOrcamento} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Toggle Novo vs Existente */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setIsNewProject(false)} style={{ flex: 1, padding: 10, borderRadius: 8, background: !isNewProject ? 'rgba(124,58,237,0.1)' : 'transparent', border: `1px solid ${!isNewProject ? 'var(--accent)' : 'var(--border)'}`, color: !isNewProject ? 'var(--accent-light)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: '0.2s' }}>
                  Projeto Existente
                </button>
                <button type="button" onClick={() => setIsNewProject(true)} style={{ flex: 1, padding: 10, borderRadius: 8, background: isNewProject ? 'rgba(124,58,237,0.1)' : 'transparent', border: `1px solid ${isNewProject ? 'var(--accent)' : 'var(--border)'}`, color: isNewProject ? 'var(--accent-light)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', transition: '0.2s' }}>
                  Criar Novo Projeto
                </button>
              </div>

              {/* Link do Orçamento - OBRIGATÓRIO */}
              <div>
                <label className="field-label">Link do Orçamento (Google Drive, Dropbox, etc.) *</label>
                <input
                  type="url"
                  className="field-input"
                  placeholder="https://drive.google.com/..."
                  value={orcamentoLink}
                  onChange={e => setOrcamentoLink(e.target.value)}
                  required
                />
              </div>

              {/* Campos Condicionais */}
              {!isNewProject ? (
                <div>
                  <label className="field-label">Vincular ao Projeto Existente</label>
                  <select
                    className="field-input"
                    required={!isNewProject}
                    value={orcamentoProjetoId}
                    onChange={e => setOrcamentoProjetoId(e.target.value)}
                  >
                    <option value="">Selecione um projeto...</option>
                    {projetosSemPdf.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nome || p.tipo_servico || `Projeto de ${p.clientes?.nome_artistico || p.clientes?.nome_pessoal}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="field-label">Cliente</label>
                    <select
                      className="field-input"
                      required={isNewProject}
                      value={orcamentoClienteId}
                      onChange={e => setOrcamentoClienteId(e.target.value)}
                    >
                      <option value="">Selecione o Cliente</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nome_artistico || c.nome_pessoal}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Nome do Projeto</label>
                    <input type="text" className="field-input" placeholder="Ex: EP Acústico 2026" required={isNewProject} value={orcamentoNome} onChange={e => setOrcamentoNome(e.target.value)} />
                  </div>
                  <div className="form-grid-2" style={{ gap: 16 }}>
                    <div>
                      <label className="field-label">Tipo de Serviço</label>
                      <input type="text" className="field-input" placeholder="Produção Completa" required={isNewProject} value={orcamentoTipo} onChange={e => setOrcamentoTipo(e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">Valor Fechado (R$)</label>
                      <input type="number" step="0.01" className="field-input" placeholder="0.00" value={orcamentoValor} onChange={e => setOrcamentoValor(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Classificação Inicial</label>
                    <select
                      className="field-input"
                      value={orcamentoClassification}
                      onChange={e => setOrcamentoClassification(e.target.value)}
                    >
                      <option value="Negociação">Negociação</option>
                      <option value="Fechado">Fechado</option>
                      <option value="50% Pago">50% Pago</option>
                      <option value="Concluído">Concluído</option>
                      <option value="Perdido">Perdido</option>
                    </select>
                  </div>
                </>
              )}

              <button type="submit" disabled={isPending} className="btn-primary" style={{ marginTop: 12 }}>
                {isPending ? 'Salvando...' : 'Salvar Orçamento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Link */}
      {showEditModal && editingOrcamento && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Editar Orçamento</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEditLink} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <strong>{editingOrcamento.nome}</strong><br />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {editingOrcamento.clientes?.nome_artistico || editingOrcamento.clientes?.nome_pessoal}
                </span>
              </div>
              <div>
                <label className="field-label">Link do Orçamento (Google Drive, Dropbox, etc.) *</label>
                <input
                  type="url"
                  className="field-input"
                  placeholder="https://drive.google.com/..."
                  value={editLink}
                  onChange={e => setEditLink(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="field-label">Classificação do Orçamento</label>
                <select
                  className="field-input"
                  value={editClassification}
                  onChange={e => setEditClassification(e.target.value)}
                >
                  <option value="Negociação">Negociação</option>
                  <option value="Fechado">Fechado</option>
                  <option value="50% Pago">50% Pago</option>
                  <option value="Concluído">Concluído</option>
                  <option value="Perdido">Perdido</option>
                </select>
              </div>
              <button type="submit" disabled={isPending} className="btn-primary" style={{ marginTop: 4 }}>
                {isPending ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
          display: flex; align-items: flex-start; justify-content: center;
          z-index: 2000; padding: 40px 20px; overflow-y: auto;
        }
        .modal-content {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: 20px; width: 100%; box-shadow: 0 30px 60px rgba(0,0,0,0.5);
          animation: fadeUp 0.3s ease-out; position: relative;
        }
        .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .close-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; }
        .field-label { display: block; font-size: 11; font-weight: 700; color: var(--text-secondary); margin-bottom: 8; text-transform: uppercase; }
        .field-input { width: 100%; padding: 12px; border-radius: 10; background: var(--bg-base); border: 1px solid var(--border); color: #fff; outline: none; transition: 0.2s; font-size: 14; }
        .btn-primary { background: var(--accent); color: #fff; border: none; padding: 12px; border-radius: 10; font-weight: 700; cursor: pointer; transition: 0.2s; width: 100%; }
        
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
