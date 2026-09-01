'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import { Disc, DollarSign, X, Check, Tag, AlertCircle, Link as LinkIcon, ChevronLeft, ChevronRight, Plus, Music2, Search, UserCheck, UserPlus, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useGrabScroll } from '@/hooks/useGrabScroll';
import { SERVICOS, ETAPAS_PRODUCAO, MIX_MASTER_CHECKLIST, ETAPAS_VENDAS, FunilStatus, getStatusTheme } from '@/constants/workflow';
import { getClientesKanban, moverClienteFunil, fecharProjetoNoKanban, buscarClientesParaKanban, criarLeadOuReabrirNoKanban } from '@/actions/databaseActions'; // [SEC REFACTOR]
import { supabase } from '@/lib/supabase';

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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function KanbanPage() {
  const [projetos, setProjetos] = useState<any[]>([]);
  const { scrollRef, isScrolling, events } = useGrabScroll();
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  const [dragging, setDragging] = useState<string | null>(null);
  const router = useRouter();

  const [overCol, setOverCol] = useState<FunilStatus | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Closing Project Modal State
  const [closingProject, setClosingProject] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalData, setModalData] = useState({
    nome: '',
    entregaveis: [{ nome: '', valor: 0 }] as { nome: string; valor: number }[],
    sinal_pago: false,
    prazo_entrega: '',
    terceirizados: '',
  });

  // New Lead / Card Modal State
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [newCardMode, setNewCardMode] = useState<'search' | 'new'>('search');
  const [newCardSearch, setNewCardSearch] = useState('');
  const [newCardSuggestions, setNewCardSuggestions] = useState<any[]>([]);
  const [newCardSelectedClient, setNewCardSelectedClient] = useState<any | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [newCardData, setNewCardData] = useState({
    nome_artistico: '',
    nome_pessoal: '',
    telefone: '',
    instagram: '',
    email: '',
    status_funil: 'Inbound WhatsApp' as FunilStatus,
    diag_servico_interesse: '',
    nome_projeto: '',
    prazo_entrega: '',
    sinal_pago: false,
    terceirizados: '',
  });

  const [newCardEntregaveis, setNewCardEntregaveis] = useState<Array<{ nome: string; valor: number }>>([
    { nome: '', valor: 0 }
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Autocomplete search for clients
  useEffect(() => {
    if (!newCardSearch.trim() || newCardMode !== 'search') {
      setNewCardSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await buscarClientesParaKanban(newCardSearch);
        setNewCardSuggestions(results || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Error searching clients:', err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [newCardSearch, newCardMode]);

  // Click outside to close client search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

    // Inscreve no canal do Supabase Realtime para a tabela 'clientes'
    const channel = supabase
      .channel('realtime-kanban')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        (payload) => {
          console.log('[Realtime] Mudança detectada na tabela clientes:', payload);
          if (payload.eventType === 'INSERT') {
            const newClient = payload.new;
            if (newClient.status_funil !== 'Concluído/Produção') {
              setProjetos((prev) => {
                if (prev.some((p) => p.id === newClient.id)) return prev;
                return [newClient, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedClient = payload.new;
            if (updatedClient.status_funil === 'Concluído/Produção') {
              setProjetos((prev) => prev.filter((p) => p.id !== updatedClient.id));
            } else {
              setProjetos((prev) => {
                const exists = prev.some((p) => p.id === updatedClient.id);
                if (exists) {
                  return prev.map((p) => (p.id === updatedClient.id ? { ...p, ...updatedClient } : p));
                } else {
                  return [updatedClient, ...prev];
                }
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const oldClient = payload.old;
            setProjetos((prev) => prev.filter((p) => p.id !== oldClient.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Status da conexão:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
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
      router.refresh();
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
      nome: '',
      entregaveis: [{ nome: '', valor: 0 }],
      sinal_pago: false,
      prazo_entrega: '',
      terceirizados: '',
    });
  };

  const handleSubmitClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingProject) return;
    if (modalData.entregaveis.length === 0 || modalData.entregaveis.some(ent => !ent.nome.trim())) {
      alert('Preencha o nome de todos os entregáveis.');
      return;
    }
    setSubmitting(true);

    const servicosNomes = modalData.entregaveis.map(ent => ent.nome).join(', ');
    const valorTotal = modalData.entregaveis.reduce((acc, ent) => acc + Number(ent.valor || 0), 0);
    const valoresServicos: Record<string, number> = {};
    modalData.entregaveis.forEach(ent => {
      valoresServicos[ent.nome] = Number(ent.valor || 0);
    });

    const checklist = modalData.entregaveis.some(ent => ent.nome.toLowerCase().includes('mix'))
      ? MIX_MASTER_CHECKLIST.map(item => ({ item, done: false }))
      : null;

    const projectData = {
      nome: modalData.nome.trim() || `Projeto - ${modalData.entregaveis[0]?.nome || 'Novo'}`,
      status_producao: ETAPAS_PRODUCAO[0], // Definição de Escopo
      servicos_fechados: servicosNomes,
      checklist_preparacao: checklist,
      valor_fechado: valorTotal,
      valores_servicos: valoresServicos,
      entregaveis: modalData.entregaveis,
      sinal_pago: modalData.sinal_pago,
      prazo_entrega: modalData.prazo_entrega,
      terceirizados: modalData.terceirizados,
    };

    try {
      await fecharProjetoNoKanban(closingProject, projectData);
      setProjetos((prev) => prev.filter((p) => p.id !== closingProject));
      handleCloseModal();
      router.refresh();
    } catch (err: any) {
      console.error('Failed to create project:', err);
      alert('Erro ao criar projeto: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetNewCardModal = () => {
    setNewCardMode('search');
    setNewCardSearch('');
    setNewCardSuggestions([]);
    setNewCardSelectedClient(null);
    setShowDropdown(false);
    setNewCardData({
      nome_artistico: '',
      nome_pessoal: '',
      telefone: '',
      instagram: '',
      email: '',
      status_funil: 'Inbound WhatsApp',
      diag_servico_interesse: '',
      nome_projeto: '',
      prazo_entrega: '',
      sinal_pago: false,
      terceirizados: '',
    });
    setNewCardEntregaveis([{ nome: '', valor: 0 }]);
  };

  const handleCreateNewCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingCard(true);

    try {
      if (newCardMode === 'search' && !newCardSelectedClient) {
        alert('Selecione um cliente existente ou mude para a aba "Novo Cliente".');
        setIsCreatingCard(false);
        return;
      }

      if (newCardMode === 'new' && !newCardData.nome_artistico.trim()) {
        alert('Informe o Nome Artístico / Vulgo do novo cliente.');
        setIsCreatingCard(false);
        return;
      }

      const validEntregaveis = newCardEntregaveis.filter(e => e.nome.trim().length > 0);
      const servicosStr = validEntregaveis.map(e => e.nome.trim()).join(', ');

      await criarLeadOuReabrirNoKanban({
        cliente_id: newCardMode === 'search' ? newCardSelectedClient?.id : null,
        nome_artistico: newCardData.nome_artistico,
        nome_pessoal: newCardData.nome_pessoal,
        telefone: newCardData.telefone,
        instagram: newCardData.instagram,
        email: newCardData.email,
        status_funil: newCardData.status_funil,
        diag_servico_interesse: servicosStr || newCardData.diag_servico_interesse || undefined,
        entregaveis: validEntregaveis,
        fechamento: newCardData.status_funil === 'Fechado' ? {
          nome_projeto: newCardData.nome_projeto || `Projeto - ${validEntregaveis[0]?.nome || 'Novo'}`,
          prazo_entrega: newCardData.prazo_entrega,
          sinal_pago: newCardData.sinal_pago,
          terceirizados: newCardData.terceirizados,
        } : undefined,
      });

      setShowNewCardModal(false);
      resetNewCardModal();
      
      // Refresh leads
      const refreshed = await getClientesKanban();
      setProjetos(refreshed || []);
      router.refresh();
    } catch (err: any) {
      console.error('Failed to create/reopen card:', err);
      alert('Erro ao criar card: ' + err.message);
    } finally {
      setIsCreatingCard(false);
    }
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Carregando Kanban...</div>;

  return (
    <>
      <div style={{ padding: isMobile ? '20px 16px' : '32px 36px', height: '100dvh', display: 'flex', flexDirection: 'column' }} className="fade-up">
        {/* Header */}
        <div style={{ marginBottom: 28, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
              <span className="gradient-text">Board Kanban</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {isMobile ? 'Deslize para ver as colunas' : 'Arraste os cards para mover projetos entre etapas do funil'}
            </p>
          </div>

          <button
            onClick={() => {
              resetNewCardModal();
              setShowNewCardModal(true);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--accent)', color: '#fff', border: 'none',
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 0 16px var(--accent-glow)',
              transition: 'all 0.2s', whiteSpace: 'nowrap'
            }}
            className="hover:scale-105"
          >
            <Plus size={16} /> Novo Lead / Card
          </button>
        </div>

        {/* Mobile swipe hint */}
        {isMobile && (
          <div className="kanban-swipe-hint">
            <ChevronLeft size={14} /> deslize para navegar entre colunas <ChevronRight size={14} />
          </div>
        )}

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
                  borderRadius: 12,
                  padding: isMobile ? '12px 10px' : '16px 12px',
                  boxShadow: isOver ? `0 0 20px ${getStatusTheme(col.id).bg}` : 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  minHeight: isMobile ? 200 : 400,
                  minWidth: isMobile ? 220 : 260,
                  maxWidth: isMobile ? 240 : undefined,
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
                          borderRadius: 10,
                          padding: isMobile ? '10px' : '14px',
                          cursor: 'grab',
                          opacity: isDragging ? 0.5 : 1,
                          transition: 'all 0.15s',
                          boxShadow: isDragging ? '0 0 20px var(--accent-glow)' : 'none',
                        }}
                      >
                        {/* Card top */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <div style={{
                              width: isMobile ? 28 : 34, height: isMobile ? 28 : 34, borderRadius: 8, flexShrink: 0,
                              background: `linear-gradient(135deg, ${getAvatarColor(av)}, ${getAvatarColor(av)}99)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: isMobile ? 11 : 13, color: '#fff',
                            }}>
                              {av.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <Link href={`/clientes/${proj.id}`} style={{ textDecoration: 'none' }}>
                                <div style={{ fontWeight: 700, fontSize: isMobile ? 12 : 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {av}
                                </div>
                              </Link>
                              {!isMobile && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {proj.instagram || proj.email}
                                </div>
                              )}
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

                        {/* Mobile arrow controls */}
                        {isMobile && (() => {
                          const colIdx = COLUMNS.findIndex(c => c.id === col.id);
                          const prevCol = COLUMNS[colIdx - 1];
                          const nextCol = COLUMNS[colIdx + 1];
                          if (!prevCol && !nextCol) return null;
                          return (
                            <div style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                              {prevCol && (
                                <button
                                  onClick={async () => {
                                    setDragging(proj.id);
                                    await handleDrop(prevCol.id);
                                  }}
                                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 4px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 10, fontWeight: 700, minHeight: 36 }}
                                  title={`← ${prevCol.label}`}
                                >
                                  <ChevronLeft size={12} />
                                </button>
                              )}
                              {nextCol && (
                                <button
                                  onClick={async () => {
                                    setDragging(proj.id);
                                    await handleDrop(nextCol.id);
                                  }}
                                  style={{ flex: 1, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 6, padding: '7px 4px', cursor: 'pointer', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 10, fontWeight: 700, minHeight: 36 }}
                                  title={`${nextCol.label} →`}
                                >
                                  <ChevronRight size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })()}
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
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 1000, padding: isMobile ? 0 : 20
        }}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            padding: isMobile ? '20px 16px' : '28px',
            borderRadius: isMobile ? '20px 20px 0 0' : '16px',
            width: '100%', maxWidth: isMobile ? '100%' : '500px',
            maxHeight: isMobile ? '90dvh' : '85dvh',
            overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)'
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
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                  Nome do Projeto *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ex: EP Vol.1 - Mixagem, Single Verão 2026..."
                  value={modalData.nome}
                  onChange={e => setModalData({...modalData, nome: e.target.value})}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8,
                    background: 'var(--bg-base)', border: '1px solid var(--accent)',
                    color: '#fff', outline: 'none', fontSize: 14,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Entregáveis livres */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Entregáveis (Músicas / Serviços) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setModalData(m => ({ ...m, entregaveis: [...m.entregaveis, { nome: '', valor: 0 }] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(124,58,237,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(124,58,237,0.3)', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {modalData.entregaveis.map((ent, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-base)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <Music2 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <input
                        required
                        type="text"
                        placeholder="Ex: Mixagem Música X..."
                        value={ent.nome}
                        onChange={e => {
                          const updated = [...modalData.entregaveis];
                          updated[idx] = { ...updated[idx], nome: e.target.value };
                          setModalData(m => ({ ...m, entregaveis: updated }));
                        }}
                        style={{ flex: 2, padding: '8px 10px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: '#fff', outline: 'none', fontSize: 13, minWidth: 0 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>R$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={ent.valor}
                          onChange={e => {
                            const updated = [...modalData.entregaveis];
                            updated[idx] = { ...updated[idx], valor: Number(e.target.value) };
                            setModalData(m => ({ ...m, entregaveis: updated }));
                          }}
                          style={{ width: 90, padding: '8px 8px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: '#fff', outline: 'none', fontSize: 13, textAlign: 'right' }}
                        />
                      </div>
                      {modalData.entregaveis.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setModalData(m => ({ ...m, entregaveis: m.entregaveis.filter((_, i) => i !== idx) }))}
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  Total:&nbsp;<strong style={{ color: '#22c55e' }}>R$ {modalData.entregaveis.reduce((a, e) => a + Number(e.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              <div className="form-grid-2" style={{ gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Prazo de Entrega</label>
                  <input
                    required
                    type="date"
                    value={modalData.prazo_entrega}
                    onChange={e => setModalData({...modalData, prazo_entrega: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
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

      {/* New Lead / Card Modal */}
      {showNewCardModal && mounted && createPortal(
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setShowNewCardModal(false); resetNewCardModal(); } }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, padding: isMobile ? '12px' : '20px'
          }}
        >
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 20, width: '100%', maxWidth: '580px',
            maxHeight: isMobile ? '92dvh' : '88dvh',
            overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
          }} className="fade-up">
            {/* Modal Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '22px 26px 18px', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 10,
              borderRadius: '20px 20px 0 0'
            }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Novo Card no Kanban</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Inicie uma nova negociação para um cliente existente ou cadastre um novo lead.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowNewCardModal(false); resetNewCardModal(); }}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewCard} style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Toggle Mode: Cliente Existente vs Novo */}
              <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--bg-base)', borderRadius: 10 }}>
                {([
                  { mode: 'search' as const, icon: <UserCheck size={14} />, label: 'Cliente Existente' },
                  { mode: 'new' as const, icon: <UserPlus size={14} />, label: 'Novo Cliente' },
                ]).map(({ mode, icon, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setNewCardMode(mode);
                      setNewCardSelectedClient(null);
                      setNewCardSearch('');
                    }}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                      cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 0.2s',
                      background: newCardMode === mode ? 'var(--bg-surface)' : 'transparent',
                      color: newCardMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: newCardMode === mode ? '0 2px 8px rgba(0,0,0,0.3)' : 'none'
                    }}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {/* Cliente Existente Search Autocomplete */}
              {newCardMode === 'search' && (
                <div ref={searchContainerRef} style={{ position: 'relative' }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Buscar Cliente Existente *
                  </label>
                  {newCardSelectedClient ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.4)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{newCardSelectedClient.nome_artistico || newCardSelectedClient.nome_pessoal}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {newCardSelectedClient.nome_pessoal && `${newCardSelectedClient.nome_pessoal} · `}
                          {newCardSelectedClient.telefone || newCardSelectedClient.instagram || 'Sem contato extra'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setNewCardSelectedClient(null); setNewCardSearch(''); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                          type="text"
                          placeholder="Buscar por vulgo, nome, telefone ou instagram..."
                          value={newCardSearch}
                          onChange={e => { setNewCardSearch(e.target.value); setShowDropdown(true); }}
                          onFocus={() => newCardSearch && setShowDropdown(true)}
                          style={{
                            width: '100%', padding: '10px 14px 10px 36px', borderRadius: 8,
                            background: 'var(--bg-base)', border: '1px solid var(--border)',
                            color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      {showDropdown && newCardSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, zIndex: 100, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                          {newCardSuggestions.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setNewCardSelectedClient(c);
                                setNewCardSearch('');
                                setShowDropdown(false);
                              }}
                              style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, borderBottom: '1px solid var(--border)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              <span style={{ fontWeight: 700, fontSize: 13 }}>{c.nome_artistico || c.nome_pessoal}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {c.nome_pessoal && `${c.nome_pessoal} · `}
                                {c.telefone || c.instagram || ''}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {showDropdown && newCardSearch && newCardSuggestions.length === 0 && (
                        <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', paddingLeft: 2 }}>
                          Nenhum cliente encontrado.{' '}
                          <button type="button" onClick={() => setNewCardMode('new')} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontWeight: 700, padding: 0 }}>Cadastrar novo?</button>
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Novo Cliente Form */}
              {newCardMode === 'new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Nome Artístico / Vulgo *
                    </label>
                    <input
                      required={newCardMode === 'new'}
                      type="text"
                      placeholder="Ex: MC Falcão, TrapBoy..."
                      value={newCardData.nome_artistico}
                      onChange={e => setNewCardData({ ...newCardData, nome_artistico: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Nome Pessoal
                      </label>
                      <input
                        type="text"
                        placeholder="Nome real"
                        value={newCardData.nome_pessoal}
                        onChange={e => setNewCardData({ ...newCardData, nome_pessoal: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        WhatsApp / Telefone
                      </label>
                      <input
                        type="text"
                        placeholder="(11) 99999-9999"
                        value={newCardData.telefone}
                        onChange={e => setNewCardData({ ...newCardData, telefone: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Instagram
                      </label>
                      <input
                        type="text"
                        placeholder="@usuario"
                        value={newCardData.instagram}
                        onChange={e => setNewCardData({ ...newCardData, instagram: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        E-mail
                      </label>
                      <input
                        type="email"
                        placeholder="cliente@email.com"
                        value={newCardData.email}
                        onChange={e => setNewCardData({ ...newCardData, email: e.target.value })}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Coluna Inicial do Funil */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Etapa Inicial no Funil (Coluna) *
                </label>
                <select
                  value={newCardData.status_funil}
                  onChange={e => setNewCardData({ ...newCardData, status_funil: e.target.value as FunilStatus })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                  }}
                >
                  {COLUMNS.map(col => (
                    <option key={col.id} value={col.id}>{col.label}</option>
                  ))}
                </select>
              </div>

              {/* Entregáveis / Músicas */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Entregáveis / Músicas (Escopo da Negociação)
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewCardEntregaveis(prev => [...prev, { nome: '', valor: 0 }])}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'rgba(124,58,237,0.12)', color: 'var(--accent-light)',
                      border: '1px solid rgba(124,58,237,0.3)', padding: '4px 10px',
                      borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700
                    }}
                  >
                    <Plus size={13} /> Adicionar Item
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-base)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                  {newCardEntregaveis.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Music2 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <input
                        type="text"
                        placeholder="Ex: Mixagem Música 1, Beat..."
                        value={item.nome}
                        onChange={(e) => {
                          const updated = [...newCardEntregaveis];
                          updated[idx] = { ...updated[idx], nome: e.target.value };
                          setNewCardEntregaveis(updated);
                        }}
                        style={{
                          flex: 2, padding: '7px 10px', borderRadius: 6,
                          background: 'var(--bg-surface)', border: '1px solid var(--border)',
                          color: '#fff', outline: 'none', fontSize: 13, minWidth: 0
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>R$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={item.valor || ''}
                          onChange={(e) => {
                            const updated = [...newCardEntregaveis];
                            updated[idx] = { ...updated[idx], valor: parseFloat(e.target.value) || 0 };
                            setNewCardEntregaveis(updated);
                          }}
                          style={{
                            width: 90, padding: '7px 8px', borderRadius: 6,
                            background: 'var(--bg-surface)', border: '1px solid var(--border)',
                            color: '#fff', outline: 'none', fontSize: 13, textAlign: 'right'
                          }}
                        />
                      </div>
                      {newCardEntregaveis.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewCardEntregaveis(prev => prev.filter((_, i) => i !== idx))}
                          style={{
                            background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none',
                            width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                    Total: <strong style={{ color: '#22c55e', marginLeft: 6 }}>R$ {newCardEntregaveis.reduce((acc, v) => acc + (Number(v.valor) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>

              {/* Se a etapa escolhida for "Fechado", exibe campos extras de encerramento */}
              {newCardData.status_funil === 'Fechado' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>
                    Dados de Fechamento Imediato (Produção)
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, display: 'block', textTransform: 'uppercase' }}>
                      Nome do Projeto
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: EP Vol. 1 - Final"
                      value={newCardData.nome_projeto}
                      onChange={e => setNewCardData({ ...newCardData, nome_projeto: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, display: 'block', textTransform: 'uppercase' }}>
                        Prazo de Entrega
                      </label>
                      <input
                        type="date"
                        value={newCardData.prazo_entrega}
                        onChange={e => setNewCardData({ ...newCardData, prazo_entrega: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, display: 'block', textTransform: 'uppercase' }}>
                        Terceirizados (Split)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Mix 20%"
                        value={newCardData.terceirizados}
                        onChange={e => setNewCardData({ ...newCardData, terceirizados: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                    <input
                      type="checkbox"
                      checked={newCardData.sinal_pago}
                      onChange={e => setNewCardData({ ...newCardData, sinal_pago: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Sinal de Entrada Pago</span>
                  </label>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => { setShowNewCardModal(false); resetNewCardModal(); }}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  disabled={isCreatingCard}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCard}
                  style={{
                    flex: 2, padding: '11px', borderRadius: 10,
                    background: isCreatingCard ? 'rgba(124,58,237,0.4)' : 'var(--accent)',
                    color: '#fff', border: 'none', cursor: isCreatingCard ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: 13, boxShadow: isCreatingCard ? 'none' : '0 0 16px var(--accent-glow)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  {isCreatingCard && <Loader2 size={16} className="animate-spin" />}
                  {isCreatingCard ? 'Criando Card...' : 'Criar Card no Kanban'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
