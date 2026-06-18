'use client';

import { useState, useEffect, useTransition } from 'react';
import { FileText, Plus, Trash2, Edit, Copy, CheckCircle, ExternalLink, Loader2, Send } from 'lucide-react';
import { getPropostasDinamicas, savePropostaDinamica, deletePropostaDinamica } from '@/actions/propostasActions';
import { getClientes } from '@/actions/databaseActions';
import { handleSupabaseError, formatCurrency } from '@/lib/utils';

export default function CentralPropostasPage() {
  const [propostas, setPropostas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [clienteId, setClienteId] = useState('');
  const [nomeProjeto, setNomeProjeto] = useState('');
  const [tipoServico, setTipoServico] = useState('');
  
  // Dynamic Services List
  const [servicos, setServicos] = useState<{ id: number; nome: string; valor: string }[]>([]);
  const [servicoIdCounter, setServicoIdCounter] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [propsData, clsData] = await Promise.all([
        getPropostasDinamicas(),
        getClientes()
      ]);
      setPropostas(propsData || []);
      setClientes(clsData || []);
    } catch (e: any) {
      alert('Erro ao carregar propostas: ' + handleSupabaseError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setClienteId('');
    setNomeProjeto('');
    setTipoServico('');
    setServicos([{ id: Date.now(), nome: '', valor: '' }]);
    setServicoIdCounter(Date.now() + 1);
    setEditId(null);
    setIsEditing(false);
  };

  const handleOpenNew = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditId(p.id);
    setClienteId(p.clientes?.id || '');
    setNomeProjeto(p.nome || '');
    setTipoServico(p.tipo_servico || '');
    
    if (p.valores_servicos && typeof p.valores_servicos === 'object') {
      const parsedServicos = Object.entries(p.valores_servicos).map(([k, v], i) => ({
        id: Date.now() + i,
        nome: k,
        valor: String(v)
      }));
      setServicos(parsedServicos.length > 0 ? parsedServicos : [{ id: Date.now(), nome: '', valor: '' }]);
      setServicoIdCounter(Date.now() + 100);
    } else {
      setServicos([{ id: Date.now(), nome: '', valor: '' }]);
    }
    
    setIsEditing(true);
    setShowModal(true);
  };

  const addServicoLinha = () => {
    setServicos([...servicos, { id: servicoIdCounter, nome: '', valor: '' }]);
    setServicoIdCounter(prev => prev + 1);
  };

  const removeServicoLinha = (id: number) => {
    setServicos(servicos.filter(s => s.id !== id));
  };

  const updateServico = (id: number, field: 'nome' | 'valor', value: string) => {
    setServicos(servicos.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const calculateTotal = () => {
    return servicos.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !nomeProjeto || !tipoServico) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    const valoresFormatados: Record<string, number> = {};
    servicos.forEach(s => {
      if (s.nome.trim()) {
        valoresFormatados[s.nome.trim()] = Number(s.valor) || 0;
      }
    });

    if (Object.keys(valoresFormatados).length === 0) {
      alert('Adicione pelo menos um serviço com valor.');
      return;
    }

    const total = calculateTotal();

    startTransition(async () => {
      try {
        await savePropostaDinamica(editId, {
          cliente_id: clienteId,
          nome: nomeProjeto,
          tipo_servico: tipoServico,
          valores_servicos: valoresFormatados,
          valor_fechado: total
        });
        setShowModal(false);
        fetchData();
      } catch (err: any) {
        alert(handleSupabaseError(err));
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta proposta?')) return;
    startTransition(async () => {
      try {
        await deletePropostaDinamica(id);
        fetchData();
      } catch (err: any) {
        alert(err.message);
      }
    });
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/proposta/${token}`;
    navigator.clipboard.writeText(url);
    alert('Link copiado!');
  };

  const openWhatsApp = (token: string, clienteNome: string) => {
    const url = `${window.location.origin}/proposta/${token}`;
    const text = encodeURIComponent(`Olá ${clienteNome}! Segue o link da sua proposta oficial: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 40px)', maxWidth: 1400, margin: '0 auto' }} className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Central de <span className="gradient-text">Propostas Dinâmicas</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Crie propostas interativas com "One-Click Close" integrado ao seu Gateway de Pagamento.
          </p>
        </div>
        <button 
          onClick={handleOpenNew} 
          style={{ 
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', 
            borderRadius: 8, background: 'var(--accent)', color: '#fff', 
            border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', 
            boxShadow: '0 0 15px var(--accent-glow)' 
          }}
        >
          <Plus size={16} /> Nova Proposta
        </button>
      </div>

      <div className="glass" style={{ padding: 0, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 800 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '16px 24px' }}>CLIENTE / PROJETO</th>
                <th style={{ padding: '16px 24px' }}>TIPO SERVIÇO</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>VALOR TOTAL</th>
                <th style={{ padding: '16px 24px', textAlign: 'center' }}>SINAL</th>
                <th style={{ padding: '16px 24px', textAlign: 'center' }}>STATUS</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => {
                const clienteNome = p.clientes?.nome_artistico || p.clientes?.nome_pessoal || 'Desconhecido';
                const isPaid = p.sinal_pago || p.status_funil === 'Fechado';
                return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 700 }}>{clienteNome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.nome}</div>
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                    {p.tipo_servico}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-light)' }}>
                    {formatCurrency(Number(p.valor_fechado || 0))}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    {isPaid ? (
                      <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                        <CheckCircle size={14} /> Pago
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Aguardando</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                     <span style={{ 
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        border: isPaid ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(245,158,11,0.3)',
                        color: isPaid ? 'var(--green)' : '#f59e0b', background: isPaid ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)'
                      }}>
                        {p.status_funil}
                      </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => copyLink(p.public_token)} title="Copiar Link" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
                      <Copy size={14} />
                    </button>
                    <button onClick={() => openWhatsApp(p.public_token, clienteNome)} title="Enviar WhatsApp" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green)', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
                      <Send size={14} />
                    </button>
                    <button onClick={() => window.open(`/proposta/${p.public_token}`, '_blank')} title="Ver Proposta" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', color: 'var(--accent-light)', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
                      <ExternalLink size={14} />
                    </button>
                    {!isPaid && (
                      <>
                        <button onClick={() => handleOpenEdit(p)} title="Editar" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} title="Excluir" style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )})}
              {propostas.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    Nenhuma proposta gerada ainda. Crie uma nova para enviar ao seu cliente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>{isEditing ? 'Editar Proposta' : 'Nova Proposta Dinâmica'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="field-label">Cliente *</label>
                <select className="field-input" value={clienteId} onChange={e => setClienteId(e.target.value)} required>
                  <option value="">Selecione o Cliente</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_artistico || c.nome_pessoal}</option>
                  ))}
                </select>
              </div>

              <div className="form-grid-2" style={{ gap: 16 }}>
                <div>
                  <label className="field-label">Nome do Projeto *</label>
                  <input className="field-input" placeholder="Ex: EP Acústico 2026" value={nomeProjeto} onChange={e => setNomeProjeto(e.target.value)} required />
                </div>
                <div>
                  <label className="field-label">Tipo de Serviço *</label>
                  <input className="field-input" placeholder="Ex: Produção Completa" value={tipoServico} onChange={e => setTipoServico(e.target.value)} required />
                </div>
              </div>

              <div style={{ marginTop: 12, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <label className="field-label" style={{ marginBottom: 0 }}>Itens do Escopo (Serviços e Valores)</label>
                  <button type="button" onClick={addServicoLinha} style={{ background: 'rgba(124,58,237,0.1)', color: 'var(--accent-light)', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    + Adicionar Linha
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {servicos.map((s) => (
                    <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <input 
                        className="field-input" 
                        placeholder="Nome do serviço (ex: Mixagem)" 
                        style={{ flex: 2 }}
                        value={s.nome}
                        onChange={e => updateServico(s.id, 'nome', e.target.value)}
                        required
                      />
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)', fontSize: 13 }}>R$</span>
                        <input 
                          type="number" 
                          step="0.01" 
                          className="field-input" 
                          style={{ paddingLeft: 36 }}
                          placeholder="0.00" 
                          value={s.valor}
                          onChange={e => updateServico(s.id, 'valor', e.target.value)}
                          required
                        />
                      </div>
                      {servicos.length > 1 && (
                        <button type="button" onClick={() => removeServicoLinha(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 8 }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Valor Total Estimado:</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-light)' }}>{formatCurrency(calculateTotal())}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '12px 24px', borderRadius: 8 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isPending} className="btn-primary" style={{ padding: '12px 24px', borderRadius: 8 }}>
                  {isPending ? 'Salvando...' : 'Salvar Proposta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
