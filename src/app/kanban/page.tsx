'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Disc, DollarSign, X, Check, Tag, AlertCircle, Link as LinkIcon, Share2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useGrabScroll } from '@/hooks/useGrabScroll';
import { SERVICOS, ETAPAS_PRODUCAO, MIX_MASTER_CHECKLIST, ETAPAS_VENDAS, FunilStatus, getStatusTheme } from '@/constants/workflow';
import { getClientesKanban, moverClienteFunil, fecharProjetoNoKanban } from '@/actions/databaseActions'; // [SEC REFACTOR]

const COLUMNS: { id: FunilStatus; label: string }[] = [
  { id: 'Inbound WhatsApp', label: 'Inbound WhatsApp' },
  { id: 'Áudios Primordiais Enviados', label: 'Áudios Enviados' },
  { id: 'Diagnóstico Preenchido', label: 'Diag. Preenchido' },
  { id: 'Análise do Produtor', label: 'Análise Produtor' },
  { id: 'Reunião de Alinhamento', label: 'Reunião Alinh.' },
  { id: 'Orçamento Enviado', label: 'Orçamento Enviado' },
  { id: 'Fechado', label: 'Fechado' },
  { id: 'Perdido', label: 'Perdido' },
];

function getAvatarColor(name: string) {
  const colors = ['#7c3aed','#2563eb','#0891b2','#059669','#d97706'];
  return colors[name.charCodeAt(0) % colors.length];
}

export default function KanbanPage() {
  const [projetos, setProjetos] = useState<any[]>([]);
  const { scrollRef, isScrolling, events } = useGrabScroll();
  const [loading, setLoading] = useState(true);

  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<FunilStatus | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [closingProject, setClosingProject] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalData, setModalData] = useState({
    servicosSelecionados: [] as string[],
    valor_fechado: '',
    sinal_pago: false,
    prazo_entrega: '',
    terceirizados: '',
    servicosPrecos: {} as Record<string, number>
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const cData = await getClientesKanban();
        setProjetos(cData || []);
      } catch (err) {
        console.error('Error fetching leads:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleDragStart = useCallback((id: string) => {
    setDragging(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colId: FunilStatus) => {
    e.preventDefault();
    setOverCol(colId);
  }, []);

  const handleDrop = useCallback(async (colId: FunilStatus) => {
    if (!dragging) return;
    
    if (colId === 'Fechado') {
      setClosingProject(dragging);
      setDragging(null);
      setOverCol(null);
      return;
    }

    // Snapshot do estado anterior para rollback
    const snapshot = projetos;

    // Update otimista — UI reflete a mudança imediatamente
    setProjetos((prev) =>
      prev.map((p) => (p.id === dragging ? { ...p, status_funil: colId } : p))
    );
    
    const projectId = dragging;
    setDragging(null);
    setOverCol(null);

    // Persiste no banco usando Server Action
    try {
      await moverClienteFunil(projectId, colId);
    } catch (err: any) {
      console.error('Failed to update status, reverting:', err);
      setProjetos(snapshot); // Rollback
      alert('Erro ao atualizar posição: ' + err.message);
    }
  }, [dragging, projetos]);

  const handleDragEnd = useCallback(() => {
    setDragging(null);
    setOverCol(null);
  }, []);

  const handleCopyLink = (token: string, projectId: string) => {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(projectId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCloseModal = () => {
    setClosingProject(null);
    setModalData({
      servicosSelecionados: [],
      valor_fechado: '',
      sinal_pago: false,
      prazo_entrega: '',
      terceirizados: '',
      servicosPrecos: {}
    });
  };

  const handleSubmitClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingProject) return;
    setSubmitting(true);

    const servicosStr = modalData.servicosSelecionados.join(', ');
    const checklist = modalData.servicosSelecionados.includes('Mixagem e Masterização') 
      ? MIX_MASTER_CHECKLIST.map(item => ({ item, done: false })) 
      : null;

    const valorTotal = Object.values(modalData.servicosPrecos).reduce((acc, v) => acc + v, 0);

    const projectData = {
      nome: `Projeto - ${modalData.servicosSelecionados[0] || 'Novo'}`,
      status_producao: ETAPAS_PRODUCAO[0], // Definição de Escopo
      servicos_fechados: servicosStr,
      checklist_preparacao: checklist,
      valor_fechado: valorTotal,
      valores_servicos: modalData.servicosPrecos,
      sinal_pago: modalData.sinal_pago,
      prazo_entrega: modalData.prazo_entrega,
      terceirizados: modalData.terceirizados
    };

    try {
      await fecharProjetoNoKanban(closingProject, projectData);
      setProjetos((prev) => prev.filter((p) => p.id !== closingProject));
      handleCloseModal();
    } catch (err: any) {
      console.error('Failed to create project:', err);
      alert('Erro ao criar projeto: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Carregando Kanban...</div>;

  return (
    <>
      <div style={{ padding: '32px 36px', height: '100vh', display: 'flex', flexDirection: 'column' }} className="fade-up">
        {/* Header */}
        <div style={{ marginBottom: 28, flexShrink: 0 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
            <span className="gradient-text">Board Kanban</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Arraste os cards para mover projetos entre etapas do funil
          </p>
        </div>

        {/* Board */}
        <div
          ref={scrollRef}
          {...events}
          className="no-scrollbar"
          style={{
            display: 'flex', gap: 16, overflowX: 'auto',
            flex: 1, paddingBottom: 16, alignItems: 'flex-start',
            cursor: isScrolling ? 'grabbing' : 'grab',
            userSelect: isScrolling ? 'none' : 'auto',
          }}
        >
          {COLUMNS.map((col) => {
            const cards = projetos.filter((p) => p.status_funil === col.id);
            const isOver = overCol === col.id;
            return (
              <div
                key={col.id}
                className="kanban-col"
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDrop={() => handleDrop(col.id)}
                style={{
                  background: 'var(--bg-surface)',
                  border: `1px solid ${isOver ? getStatusTheme(col.id).border : 'var(--border)'}`,
                  borderRadius: 14,
                  padding: '16px 12px',
                  boxShadow: isOver ? `0 0 20px ${getStatusTheme(col.id).bg}` : 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  minHeight: 400,
                  minWidth: 280,
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: getStatusTheme(col.id).text, boxShadow: `0 0 8px ${getStatusTheme(col.id).text}` }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{col.label}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 999, background: getStatusTheme(col.id).bg, color: getStatusTheme(col.id).text,
                    border: `1px solid ${getStatusTheme(col.id).border}`
                  }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {cards.map((proj) => {
                    const isDragging = dragging === proj.id;
                    const av = proj.nome_artistico || proj.nome_pessoal || '?';
                    return (
                      <div
                        key={proj.id}
                        draggable
                        onDragStart={() => handleDragStart(proj.id)}
                        onDragEnd={handleDragEnd}
                        style={{
                          background: isDragging ? 'rgba(124,58,237,0.15)' : 'var(--bg-card)',
                          border: `1px solid ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 12,
                          padding: '14px',
                          cursor: 'grab',
                          opacity: isDragging ? 0.5 : 1,
                          transition: 'all 0.15s',
                          boxShadow: isDragging ? '0 0 20px var(--accent-glow)' : 'none',
                        }}
                      >
                        {/* Card top */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                              background: `linear-gradient(135deg, ${getAvatarColor(av)}, ${getAvatarColor(av)}99)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: 14, color: '#fff',
                            }}>
                              {av.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <Link href={`/clientes/${proj.id}`} style={{ textDecoration: 'none' }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {av}
                                </div>
                              </Link>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {proj.instagram || proj.email}
                              </div>
                              {proj.instagram || proj.email}
                            </div>
                          </div>
                          
                          {/* Copy Link Action */}
                          {proj.public_token && (
                            <button
                              onClick={() => handleCopyLink(proj.public_token, proj.id)}
                              style={{
                                background: copiedId === proj.id ? 'rgba(34,197,94,0.1)' : 'transparent',
                                border: `1px solid ${copiedId === proj.id ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                                borderRadius: 8, padding: 6, cursor: 'pointer',
                                color: copiedId === proj.id ? '#22c55e' : 'var(--text-muted)',
                                transition: 'all 0.2s', marginLeft: 'auto'
                              }}
                              title="Copiar Link de Acompanhamento"
                            >
                              {copiedId === proj.id ? <Check size={14} /> : <LinkIcon size={14} />}
                            </button>
                          )}
                        </div>

                        <div style={{
                          fontSize: 12, color: 'var(--text-secondary)',
                          background: 'var(--bg-base)', padding: '6px 10px',
                          borderRadius: 8, marginBottom: 10,
                          display: 'flex', alignItems: 'center', gap: 6
                        }}>
                          <Disc size={14} className="text-accent" /> {proj.diag_servico_interesse || 'Não informado'}
                        </div>

                        {/* Revision Feedback Alert */}
                        {proj.status_producao === 'Revisão' && proj.motivo_revisao && (
                          <div style={{ 
                            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                            borderRadius: 8, padding: '8px 10px', marginBottom: 10
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <AlertCircle size={12} /> FEEDBACK DO CLIENTE
                            </div>
                            <p style={{ fontSize: 11, color: '#fcd34d', fontStyle: 'italic' }} className="line-clamp-2">
                              "{proj.motivo_revisao}"
                            </p>
                          </div>
                        )}

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {proj.valor_fechado ? (
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <DollarSign size={12} /> {Number(proj.valor_fechado).toLocaleString('pt-BR')}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Valor pendente</span>
                          )}
                          {proj.cupom_usado && (
                            <span style={{ fontSize: 10, background: 'rgba(124,58,237,0.15)', color: '#c084fc', borderRadius: 6, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Tag size={10} /> {proj.cupom_usado}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty state */}
                  {cards.length === 0 && (
                    <div style={{
                      flex: 1, border: '2px dashed var(--border)', borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', fontSize: 12, minHeight: 80,
                    }}>
                      Arraste um card aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial Bridge Modal */}
      {closingProject && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }} className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>CPQ: Fechar Projeto</h2>
              <button 
                onClick={handleCloseModal}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Preencha os dados reais e prazos para encaminhar esse projeto imediatamente para a Produção.
            </p>

            <form onSubmit={handleSubmitClosing} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
                  Serviços (Múltipla Escolha)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SERVICOS.map((servico) => (
                    <label key={servico} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <input
                        type="checkbox"
                        checked={modalData.servicosSelecionados.includes(servico)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setModalData(m => ({ ...m, servicosSelecionados: [...m.servicosSelecionados, servico] }));
                          } else {
                            setModalData(m => {
                              const newPrecos = { ...m.servicosPrecos };
                              delete newPrecos[servico];
                              return {
                                ...m,
                                servicosSelecionados: m.servicosSelecionados.filter(s => s !== servico),
                                servicosPrecos: newPrecos
                              };
                            });
                          }
                        }}
                        style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{servico}</span>
                    </label>
                  ))}
                </div>
              </div>

              {modalData.servicosSelecionados.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
                    Preços por Serviço (R$)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {modalData.servicosSelecionados.map(servico => (
                      <div key={servico} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{servico}</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={modalData.servicosPrecos[servico] || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setModalData(m => ({
                              ...m,
                              servicosPrecos: { ...m.servicosPrecos, [servico]: val }
                            }));
                          }}
                          style={{
                            width: 100, padding: '8px 12px', borderRadius: 8,
                            background: 'var(--bg-base)', border: '1px solid var(--border)',
                            color: '#fff', outline: 'none', fontSize: 13
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                    Valor Total (Soma Automática)
                  </label>
                  <div style={{
                    padding: '12px 16px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                    color: 'var(--green)', fontWeight: 700, fontSize: 16
                  }}>
                    R$ {Object.values(modalData.servicosPrecos).reduce((acc, v) => acc + v, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                    Prazo de Entrega
                  </label>
                  <input
                    required
                    type="date"
                    value={modalData.prazo_entrega}
                    onChange={e => setModalData({...modalData, prazo_entrega: e.target.value})}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 8,
                      background: 'var(--bg-base)', border: '1px solid var(--border)',
                      color: '#fff', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                  Terceirizados Envolvidos (Split)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Violão - 100%, Mix - 20%"
                  value={modalData.terceirizados}
                  onChange={e => setModalData({...modalData, terceirizados: e.target.value})}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8,
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: '#fff', outline: 'none'
                  }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={modalData.sinal_pago}
                  onChange={e => setModalData({...modalData, sinal_pago: e.target.checked})}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Sinal de Entrada Pago</span>
              </label>

              <button 
                type="submit" 
                disabled={submitting}
                style={{
                  marginTop: 8, padding: '14px', borderRadius: 8,
                  background: 'var(--accent)', color: '#fff', fontWeight: 700,
                  border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1, transition: '0.2s'
                }}
              >
                {submitting ? 'Salvando...' : 'Confirmar e Fechar Projeto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
