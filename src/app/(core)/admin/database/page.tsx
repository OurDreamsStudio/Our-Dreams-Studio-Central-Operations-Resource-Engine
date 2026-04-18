'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { 
  Users, 
  Briefcase, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  AlertTriangle, 
  AlertCircle,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Link as LinkIcon,
  Check,
  Disc,
  Tag,
  DollarSign
} from 'lucide-react';
import { ETAPAS_VENDAS, ETAPAS_PRODUCAO, SERVICOS, getStatusTheme } from '@/constants/workflow';
import { Cliente, Projeto, ProjetoComCliente, Terceirizado } from '@/types';
import { StandardModal } from '@/components/StandardModal';
import { handleSupabaseError, formatCurrency, formatDate } from '@/lib/utils';

// Import Server Actions
import { 
  getTerceirizados 
} from '@/actions/terceirizadosActions';
import { 
  getClientes, 
  saveCliente, 
  deleteCliente, 
  getProjetos, 
  saveProjeto, 
  deleteProjeto,
  faxinaProjetosFantasmas
} from '@/actions/databaseActions';

type Tab = 'clientes' | 'projetos';

export default function AdminDatabasePage() {
  const [activeTab, setActiveTab] = useState<Tab>('clientes');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  
  // Data
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [projetos, setProjetos] = useState<ProjetoComCliente[]>([]);
  
  // Modals
  const [showClientModal, setShowClientModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<{ id: string, type: 'cliente' | 'projeto' } | null>(null);
  
  // Form State
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Pricing State for Modal
  const [modalServicos, setModalServicos] = useState<string[]>([]);
  const [modalPrecos, setModalPrecos] = useState<Record<string, number>>({});

  // Terceirizados Integration
  const [terceirizados, setTerceirizados] = useState<any[]>([]);
  const [selectedTerceiros, setSelectedTerceiros] = useState<string[]>([]); // Array de IDs
  const [terceirosData, setTerceirosData] = useState<Record<string, { descricao: string, valor: number }>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'clientes') {
        const data = await getClientes();
        setClientes(data || []);
      } else {
        const data = await getProjetos();
        setProjetos(data || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      alert('Erro ao carregar dados: ' + handleSupabaseError(error));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
    // Pre-load terceirizados for the modal
    getTerceirizados().then(data => setTerceirizados(data || [])).catch(console.error);
  }, [fetchData]);

  // --- CLIENT ACTIONS ---

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const clientData = Object.fromEntries(formData.entries());

    startTransition(async () => {
      try {
        setFormError(null);
        await saveCliente(editingClient?.id || null, clientData);
        setShowClientModal(false);
        setEditingClient(null);
        fetchData();
        router.refresh();

      } catch (error) {
        console.error('Save client error:', error);
        alert('Erro na API: ' + handleSupabaseError(error as any));
      }
    });
  };

  const openEditClient = (client: any) => {
    setFormError(null);
    setEditingClient(client);
    setShowClientModal(true);
  };

  // --- PROJECT ACTIONS ---

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const projectData: Partial<Projeto> = Object.fromEntries(formData.entries());
    
    // Pre-calculate total and values with NaN safety
    const valorTotal = Object.values(modalPrecos).reduce((acc, v) => acc + (Number(v) || 0), 0);
    projectData.valor_fechado = valorTotal;
    
    const sanitizedPrecos: Record<string, number> = {};
    Object.keys(modalPrecos).forEach(k => {
      sanitizedPrecos[k] = Number(modalPrecos[k]) || 0;
    });
    projectData.valores_servicos = sanitizedPrecos;
    projectData.servicos_fechados = modalServicos.join(', ');
    
    // Clean empty status to null to avoid constraint violations
    if (projectData.status_producao === '') {
      projectData.status_producao = null;
    }
    
    // Ensure numeric fields
    projectData.valor_fechado = Number(valorTotal) || 0;

    // Prepare splits for partners
    const splits = selectedTerceiros.map(id => ({
      terceirizado_id: id,
      descricao: terceirosData[id]?.descricao || 'Tarefa alocada via Upsell',
      valor: Number(terceirosData[id]?.valor) || 0
    }));

    startTransition(async () => {
      try {
        await saveProjeto(editingProject?.id || null, projectData, splits);
        setShowProjectModal(false);
        setEditingProject(null);
        setSelectedTerceiros([]);
        setTerceirosData({});
        fetchData();
        router.refresh();

      } catch (error) {
        console.error('Save project error:', error);
        alert('Erro ao salvar projeto: ' + handleSupabaseError(error));
      }
    });
  };

  const openEditProject = (project: any) => {
    setEditingProject(project);
    setModalServicos(project.servicos_fechados ? project.servicos_fechados.split(',').map((s: string) => s.trim()) : []);
    setModalPrecos(project.valores_servicos || {});
    // Reset terceiros for editing (although alocation is mostly for NEW)
    setSelectedTerceiros([]);
    setTerceirosData({});
    setShowProjectModal(true);
  };

  // --- DELETE LOGIC ---

  const confirmDelete = async () => {
    if (!showDeleteModal) return;
    const { id, type } = showDeleteModal;
    
    startTransition(async () => {
      try {
        if (type === 'cliente') {
          await deleteCliente(id);
        } else {
          await deleteProjeto(id);
        }
        fetchData();
        setShowDeleteModal(null);
      } catch (error) {
        console.error('Delete error:', error);
        alert(`Erro ao excluir ${type}: ${handleSupabaseError(error)}`);
        setShowDeleteModal(null);
      }
    });
  };

  const handleFaxina = async () => {
    if (!confirm('Deseja remover todos os projetos fantasmas (sem status de produção)?')) return;
    startTransition(async () => {
      try {
        const result = await faxinaProjetosFantasmas();
        alert(result.message);
        fetchData();
      } catch (error) {
        alert('Erro na faxina: ' + handleSupabaseError(error));
      }
    });
  };

  return (
    <>
      <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }} className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Sala de <span className="gradient-text">Máquinas</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Gestão direta do banco de dados (Server Actions / RLS Secured)
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={handleFaxina}
            disabled={loading || isPending}
            className="btn-secondary"
            style={{ 
              padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, 
              color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)'
            }}
          >
            🧹 Faxina n8n
          </button>
          
          <div style={{ display: 'flex', gap: 12, background: 'var(--bg-surface)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
            <button 
              disabled={loading || isPending}
              onClick={() => setActiveTab('clientes')}
              style={{ 
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeTab === 'clientes' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'clientes' ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, transition: '0.2s',
                opacity: (loading || isPending) ? 0.6 : 1
              }}
            >
              <Users size={16} style={{ marginBottom: -3, marginRight: 8 }} /> Clientes
            </button>
            <button 
              disabled={loading || isPending}
              onClick={() => setActiveTab('projetos')}
              style={{ 
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeTab === 'projetos' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'projetos' ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, transition: '0.2s',
                opacity: (loading || isPending) ? 0.6 : 1
              }}
            >
              <Briefcase size={16} style={{ marginBottom: -3, marginRight: 8 }} /> Projetos
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="glass" style={{ padding: 0, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Listagem de {activeTab === 'clientes' ? 'Clientes' : 'Projetos'}
            </h2>
            {(loading || isPending) && <Loader2 size={16} className="animate-spin text-accent" />}
          </div>
          <button 
            onClick={() => activeTab === 'clientes' ? setShowClientModal(true) : setShowProjectModal(true)}
            disabled={loading || isPending}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', 
              borderRadius: 8, background: 'var(--accent)', color: '#fff', 
              border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              boxShadow: '0 0 15px var(--accent-glow)',
              opacity: (loading || isPending) ? 0.7 : 1
            }}
          >
            <Plus size={18} /> Novo {activeTab === 'clientes' ? 'Cliente' : 'Projeto Manual'}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>{activeTab === 'clientes' ? 'NOME / ARTISTA' : 'PROJETO'}</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>{activeTab === 'clientes' ? 'CONTATO' : 'CLIENTE'}</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>{activeTab === 'clientes' ? 'EMAIL' : 'STATUS'}</th>
                <th style={{ padding: '16px 24px', fontWeight: 600 }}>{activeTab === 'clientes' ? 'CADASTRO' : 'VALOR / PRAZO'}</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <Loader2 size={20} className="animate-spin" /> Carregando dados do servidor...
                    </div>
                  </td>
                </tr>
              ) : (activeTab === 'clientes' ? clientes : projetos).length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum registro encontrado.</td>
                </tr>
              ) : (activeTab === 'clientes' ? clientes : projetos).map((item) => {
                const isCliente = activeTab === 'clientes';
                const c = item as Cliente;
                const p = item as ProjetoComCliente;
                return (
                <tr key={item.id} className="table-row" style={{ borderBottom: '1px solid var(--border)', transition: '0.2s' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {isCliente 
                        ? (c.nome_artistico || c.nome_pessoal) 
                        : (p.nome || p.servicos_fechados || p.tipo_servico || 'Sem Nome')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {item.id.substring(0,8)}...</div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {isCliente ? (
                      <div>{c.telefone || '--'}</div>
                    ) : (
                      <div style={{ fontWeight: 600 }}>{p.clientes?.nome_artistico || p.clientes?.nome_pessoal || 'Desconhecido'}</div>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {isCliente ? (
                      <div style={{ fontSize: 13 }}>{c.email || '--'}</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ 
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, width: 'fit-content',
                          background: getStatusTheme(p.status_funil).bg, color: getStatusTheme(p.status_funil).text,
                          border: `1px solid ${getStatusTheme(p.status_funil).border}`
                        }}>
                          FUNIL: {p.status_funil}
                        </span>
                        {p.status_producao && (
                          <span style={{ 
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, width: 'fit-content',
                            background: getStatusTheme(p.status_producao).bg, color: getStatusTheme(p.status_producao).text,
                            border: `1px solid ${getStatusTheme(p.status_producao).border}`
                          }}>
                            PROD: {p.status_producao}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {isCliente ? (
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(c.data_entrada)}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 700, color: 'var(--green)' }}>
                          {formatCurrency(p.valor_fechado || 0)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Prazo: {formatDate(p.prazo_entrega)}
                        </div>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => isCliente ? openEditClient(c) : openEditProject(p)}
                        disabled={isPending}
                        style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: 'var(--accent-light)', padding: 6, borderRadius: 6, cursor: 'pointer', opacity: isPending ? 0.5 : 1 }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button 
                        onClick={() => setShowDeleteModal({ id: item.id, type: activeTab === 'clientes' ? 'cliente' : 'projeto' })}
                        disabled={isPending}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: 6, borderRadius: 6, cursor: 'pointer', opacity: isPending ? 0.5 : 1 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      </div>

      {/* MODAIS TELEPORTADOS PARA FORA DO CONTEXTO DE EMPILHAMENTO (STACKING CONTEXT) */}
      {/* CLIENT MODAL */}
      <StandardModal
        isOpen={showClientModal}
        onClose={() => { setShowClientModal(false); setEditingClient(null); setFormError(null); }}
        title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
        maxW="600px"
      >
        <form onSubmit={handleSaveClient} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {formError && (
            <div style={{ 
              gridColumn: 'span 2', 
              padding: '12px 16px', 
              background: 'rgba(239,68,68,0.1)', 
              border: '1px solid rgba(239,68,68,0.2)', 
              borderRadius: 10, 
              color: '#ef4444', 
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <AlertTriangle size={18} />
              {formError}
            </div>
          )}
          <div style={{ gridColumn: 'span 2' }}>
            <label className="field-label">Nome Artístico / Vulgo</label>
            <input name="nome_artistico" defaultValue={editingClient?.nome_artistico} className="field-input" required />
          </div>
          <div>
            <label className="field-label">Nome Pessoal</label>
            <input name="nome_pessoal" defaultValue={editingClient?.nome_pessoal} className="field-input" />
          </div>
          <div>
            <label className="field-label">E-mail</label>
            <input name="email" type="email" defaultValue={editingClient?.email} className="field-input" />
          </div>
          <div>
            <label className="field-label">Telefone / WhatsApp</label>
            <input name="telefone" defaultValue={editingClient?.telefone} className="field-input" />
          </div>
          <div>
            <label className="field-label">Instagram</label>
            <input name="instagram" defaultValue={editingClient?.instagram} className="field-input" />
          </div>
          <div>
            <label className="field-label">Data de Nascimento</label>
            <input name="data_nascimento" type="date" defaultValue={editingClient?.data_nascimento} className="field-input" />
          </div>
          <div>
            <label className="field-label">WhatsApp ID (Opcional)</label>
            <input name="whatsapp_id" defaultValue={editingClient?.whatsapp_id} className="field-input" />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label className="field-label">Status no Funil (Lead)</label>
            <select name="status_funil" defaultValue={editingClient?.status_funil || 'Diagnóstico Preenchido'} className="field-input">
              {ETAPAS_VENDAS.map(etapa => (
                <option key={etapa} value={etapa}>{etapa}</option>
              ))}
            </select>
          </div>
          
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: 12, marginTop: 12 }}>
            <button type="button" onClick={() => { setShowClientModal(false); setEditingClient(null); setFormError(null); }} className="btn-secondary" style={{ flex: 1 }} disabled={isPending}>Cancelar</button>
            <button type="submit" disabled={isPending} className="btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {isPending ? 'Salvando...' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </StandardModal>

      {/* PROJECT MODAL */}
      <StandardModal
        isOpen={showProjectModal}
        onClose={() => { setShowProjectModal(false); setEditingProject(null); }}
        title={editingProject ? 'Editar Projeto' : 'Novo Projeto Manual'}
        maxW="700px"
      >
        <form onSubmit={handleSaveProject} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              
              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Nome do Projeto (Título na Agenda)</label>
                <input name="nome" defaultValue={editingProject?.nome} className="field-input" placeholder="Ex: Mixagem EP - Artista X" required disabled={isPending} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Cliente Vinculado</label>
                <select name="cliente_id" defaultValue={editingProject?.cliente_id} className="field-input" required disabled={isPending}>
                  <option value="">Selecione um cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_artistico || c.nome_pessoal}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Serviços Selecionados</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, background: 'var(--bg-base)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                  {SERVICOS.map(servico => (
                    <label key={servico} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input 
                        type="checkbox" 
                        checked={modalServicos.includes(servico)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setModalServicos(prev => [...prev, servico]);
                          } else {
                            setModalServicos(prev => prev.filter(s => s !== servico));
                            const newPrecos = { ...modalPrecos };
                            delete newPrecos[servico];
                            setModalPrecos(newPrecos);
                          }
                        }}
                        style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                      />
                      {servico}
                    </label>
                  ))}
                </div>
              </div>

              {modalServicos.length > 0 && (
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label className="field-label">Preços Individuais (R$)</label>
                  {modalServicos.map(servico => (
                    <div key={servico} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{servico}</span>
                      <input
                        type="number"
                        step="0.01"
                         placeholder="0.00"
                         value={modalPrecos[servico] ?? ''}
                         onChange={(e) => {
                           const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                           setModalPrecos(prev => ({ ...prev, [servico]: val }));
                         }}
                        className="field-input"
                        style={{ width: 120, padding: '8px 12px' }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="field-label">Etapa do Funil (Vendas)</label>
                <select name="status_funil" defaultValue={editingProject?.status_funil || 'Inbound WhatsApp'} className="field-input" disabled={isPending}>
                  {ETAPAS_VENDAS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label className="field-label">Etapa de Produção</label>
                <select name="status_producao" defaultValue={editingProject?.status_producao || ''} className="field-input" disabled={isPending}>
                  <option value="">Nenhuma (No Kanban ainda)</option>
                  {ETAPAS_PRODUCAO.map(e => <option key={e} value={e}>{e}</option>)}
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>

              {/* [NOVO] Alocação de Terceiros / Split de Venda */}
              {!editingProject && (
                <div style={{ gridColumn: 'span 2', background: 'rgba(124,58,237,0.03)', border: '1px solid rgba(124,58,237,0.1)', borderRadius: 12, padding: 16 }}>
                  <label className="field-label" style={{ color: 'var(--accent-light)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={14} /> Alocação de Terceiros (Split de Venda)
                  </label>
                  
                  {terceirizados.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                      Nenhum parceiro cadastrado. Cadastre em Controle de Terceiros primeiro.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                        {terceirizados.map(t => (
                          <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, padding: '6px 10px', background: selectedTerceiros.includes(t.id) ? 'rgba(124,58,237,0.1)' : 'var(--bg-base)', borderRadius: 8, border: '1px solid', borderColor: selectedTerceiros.includes(t.id) ? 'var(--accent)' : 'var(--border)', transition: '0.2s' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedTerceiros.includes(t.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTerceiros(prev => [...prev, t.id]);
                                } else {
                                  setSelectedTerceiros(prev => prev.filter(id => id !== t.id));
                                  const newData = { ...terceirosData };
                                  delete newData[t.id];
                                  setTerceirosData(newData);
                                }
                              }}
                              style={{ display: 'none' }}
                            />
                            {t.nome}
                          </label>
                        ))}
                      </div>

                      {selectedTerceiros.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {selectedTerceiros.map(id => {
                            const t = terceirizados.find(x => x.id === id);
                            return (
                              <div key={id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>DESCRIÇÃO ({t?.nome})</div>
                                  <input 
                                    className="field-input" 
                                    style={{ padding: '6px 10px', fontSize: 12 }} 
                                    placeholder="Ex: Mixagem da voz..."
                                    value={terceirosData[id]?.descricao || ''}
                                    onChange={(e) => setTerceirosData(prev => ({ ...prev, [id]: { ...prev[id], descricao: e.target.value } }))}
                                  />
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>VALOR SPLIT</div>
                                  <input 
                                    type="number" 
                                    className="field-input" 
                                    style={{ padding: '6px 10px', fontSize: 12 }} 
                                    placeholder="0,00"
                                    value={terceirosData[id]?.valor || ''}
                                    onChange={(e) => setTerceirosData(prev => ({ ...prev, [id]: { ...prev[id], valor: Number(e.target.value) } }))}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Profit Footer Calculation */}
              <div style={{ gridColumn: 'span 2', marginTop: 8, padding: '16px 20px', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lucro do Estúdio (Estimado)</div>
                  {(() => {
                    const totalSplits = selectedTerceiros.reduce((acc, id) => acc + (terceirosData[id]?.valor || 0), 0);
                    const valorTotalProjeto = Object.values(modalPrecos).reduce((acc, v) => acc + Number(v || 0), 0);
                    const lucro = valorTotalProjeto - totalSplits;
                    const isDanger = lucro <= 0;

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: isDanger ? '#ef4444' : 'var(--green)', textShadow: isDanger ? '0 0 10px rgba(239,68,68,0.3)' : 'none' }}>
                          {formatCurrency(lucro)}
                        </div>
                        {isDanger && (
                          <div style={{ animation: 'pulse 1s infinite', color: '#ef4444' }}>
                            <AlertTriangle size={24} />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Mão de Obra: {formatCurrency(selectedTerceiros.reduce((acc, id) => acc + (terceirosData[id]?.valor || 0), 0))}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Venda Bruta: {formatCurrency(Object.values(modalPrecos).reduce((acc, v) => acc + Number(v || 0), 0))}</div>
                </div>
              </div>

              <div>
                <label className="field-label">Valor Total (Soma Automática)</label>
                <div style={{
                  padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)', color: 'var(--green)', fontWeight: 700, fontSize: 16
                }}>
                   {formatCurrency(Object.values(modalPrecos).reduce((acc, v) => acc + Number(v || 0), 0))}
                 </div>
              </div>

              <div>
                <label className="field-label">Prazo de Entrega</label>
                <input name="prazo_entrega" type="date" defaultValue={editingProject?.prazo_entrega} className="field-input" disabled={isPending} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label">Link Asset Vault (Drive/WeTransfer)</label>
                <input name="link_arquivos" type="url" placeholder="https://..." defaultValue={editingProject?.link_arquivos} className="field-input" disabled={isPending} />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input type="checkbox" name="sinal_pago" defaultChecked={editingProject?.sinal_pago} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} disabled={isPending} />
                <label style={{ fontSize: 13, fontWeight: 600 }}>Sinal Pago</label>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input type="checkbox" name="entrega_paga" defaultChecked={editingProject?.entrega_paga} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} disabled={isPending} />
                <label style={{ fontSize: 13, fontWeight: 600 }}>Entrega Paga</label>
              </div>

              {editingProject?.motivo_revisao && (
                <div style={{ gridColumn: 'span 2', padding: 16, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12 }}>
                  <label className="field-label" style={{ color: '#f59e0b' }}>
                    <AlertCircle size={14} style={{ marginBottom: -3, marginRight: 6 }} /> 
                    Feedback de Revisão do Cliente
                  </label>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 8, lineHeight: 1.5 }}>
                    "{editingProject.motivo_revisao}"
                  </p>
                </div>
              )}
              
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => { setShowProjectModal(false); setEditingProject(null); }} className="btn-secondary" style={{ flex: 1 }} disabled={isPending}>Cancelar</button>
                <button type="submit" disabled={isPending} className="btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {isPending ? 'Salvando...' : 'Salvar Projeto'}
                </button>
              </div>
            </form>
      </StandardModal>

      {/* DELETE CONFIRMATION MODAL */}
      <StandardModal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        title="Tem certeza?"
        maxW="400px"
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <AlertTriangle size={32} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
            Esta ação excluirá o {showDeleteModal?.type} permanentemente. Esta ação não pode ser desfeita.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={() => setShowDeleteModal(null)} 
              className="btn-secondary" 
              style={{ flex: 1 }}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button 
              onClick={confirmDelete} 
              disabled={isPending}
              className="btn-danger" 
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {isPending ? 'Excluindo...' : 'Excluir Agora'}
            </button>
          </div>
        </div>
      </StandardModal>

      <style jsx>{`
        .modal-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999 !important;
          padding: 2rem;
          overflow-y: auto;
        }
        .modal-content {
          background: #0f172a;
          border: 1px solid var(--border);
          border-radius: 20px;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 30px 60px rgba(0,0,0,0.5);
          animation: fadeUp 0.3s ease-out;
          position: relative;
          margin: auto;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-content::-webkit-scrollbar { width: 6px; }
        .modal-content::-webkit-scrollbar-track { background: transparent; }
        .modal-content::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.2); border-radius: 10px; }
        .modal-content::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.4); }
        .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { font-size: 18px; font-weight: 700; margin: 0; }
        .close-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; }
        .field-label { display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .field-input { width: 100%; padding: 12px 14px; border-radius: 10px; background: var(--bg-base); border: 1px solid var(--border); color: #fff; outline: none; transition: 0.2s; font-size: 14px; }
        .field-input:focus { border-color: var(--accent); box-shadow: 0 0 10px rgba(124,58,237,0.2); }
        .btn-primary { background: var(--accent); color: #fff; border: none; padding: 12px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-primary:hover { background: var(--accent-light); transform: translateY(-1px); }
        .btn-secondary { background: var(--bg-base); color: var(--text-primary); border: 1px solid var(--border); padding: 12px; border-radius: 10px; font-weight: 700; cursor: pointer; }
        .btn-danger { background: #ef4444; color: #fff; border: none; padding: 12px; border-radius: 10px; font-weight: 700; cursor: pointer; }
        .table-row:hover { background: rgba(255,255,255,0.03); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
