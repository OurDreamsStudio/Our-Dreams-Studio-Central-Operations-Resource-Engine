'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import { Disc, DollarSign, Calendar, Users, X, CheckCircle, Link as LinkIcon, Check, Settings, ChevronLeft, ChevronRight, ShieldCheck, RotateCcw } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useGrabScroll } from '@/hooks/useGrabScroll';

import { ETAPAS_PRODUCAO, ProducaoStatus, getStatusTheme } from '@/constants/workflow';
import { Projeto, Cliente, Terceirizado, TarefaTerceirizado, Notificacao } from '@/types';
import { getProjetosProducao, updateProjetoChecklist, updateProjetoStatusProducao, updateProjetoLinkArquivos, confirmarEntregaProjeto, adminAprovarProjeto, desfazerEntregaProjeto } from '@/actions/databaseActions'; // [SEC REFACTOR]
import { supabase } from '@/lib/supabase';

const COLUMNS: { id: typeof ETAPAS_PRODUCAO[number]; label: string }[] = [
  { id: 'Definição de Escopo', label: 'Def. Escopo' },
  { id: 'Preparação Técnica', label: 'Prep. Técnica' },
  { id: 'Execução & Captação', label: 'Execução' },
  { id: 'Pós-Produção', label: 'Pós-Produção' },
  { id: 'Revisão', label: 'Revisão' },
  { id: 'Aprovado', label: 'Aprovado ✅' },
  { id: 'Entregue', label: 'Entregue' },
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

function isDateLateOrToday(dateString: string | null) {
  if (!dateString) return false;
  const projectDate = new Date(dateString);
  const today = new Date();
  today.setHours(0,0,0,0);
  return projectDate <= today;
}

export default function ProducaoPage() {
  const [projetos, setProjetos] = useState<any[]>([]);
  const { scrollRef, isScrolling, events } = useGrabScroll();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();


  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ProducaoStatus | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delivery Modal
  const [deliveringProject, setDeliveringProject] = useState<string | null>(null);
  const [submittingDel, setSubmittingDel] = useState(false);
  const [entregaPaga, setEntregaPaga] = useState(true);
  
  // Admin Approval
  const [adminApprovingId, setAdminApprovingId] = useState<string | null>(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Undo Delivery Modal
  const [undoingProject, setUndoingProject] = useState<any | null>(null);
  const [undoTargetStatus, setUndoTargetStatus] = useState('Pós-Produção');
  const [submittingUndo, setSubmittingUndo] = useState(false);

  // Settings Modal
  const [settingsProject, setSettingsProject] = useState<any | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [submittingSettings, setSubmittingSettings] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const pData = await getProjetosProducao();
        setProjetos(pData || []);
      } catch (err: any) {
        console.error('Error fetching projetos de producao:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Inscreve no canal do Supabase Realtime para a tabela 'projetos'
    const channel = supabase
      .channel('realtime-producao')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projetos' },
        (payload) => {
          console.log('[Realtime] Mudança detectada na tabela projetos:', payload);
          if (payload.eventType === 'INSERT') {
            fetchData(); // Refetch to get joined relations like clientes
          } else if (payload.eventType === 'UPDATE') {
            const updatedProject = payload.new;
            setProjetos((prev) => {
              const exists = prev.some((p) => p.id === updatedProject.id);
              if (exists) {
                return prev.map((p) => (p.id === updatedProject.id ? { ...p, ...updatedProject } : p));
              } else {
                fetchData(); // Refetch if it's a new project entering the view
                return prev;
              }
            });
          } else if (payload.eventType === 'DELETE') {
            const oldProject = payload.old;
            setProjetos((prev) => prev.filter((p) => p.id !== oldProject.id));
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

  const handleToggleChecklist = async (projectId: string, itemIndex: number, newValue: boolean) => {
    // Snapshot do estado anterior para rollback
    const snapshot = projetos;

    // Optimistic UI update
    setProjetos(prev => prev.map(p => {
      if (p.id !== projectId || !p.checklist_preparacao) return p;
      const newChecklist = [...p.checklist_preparacao];
      newChecklist[itemIndex] = { ...newChecklist[itemIndex], done: newValue };
      return { ...p, checklist_preparacao: newChecklist };
    }));

    // Update DB
    const project = projetos.find(p => p.id === projectId);
    if (!project || !project.checklist_preparacao) return;

    const newChecklist = [...project.checklist_preparacao];
    newChecklist[itemIndex] = { ...newChecklist[itemIndex], done: newValue };

    try {
      await updateProjetoChecklist(projectId, newChecklist);
    } catch (err: any) {
      console.error('Failed to update checklist, reverting:', err);
      setProjetos(snapshot); // Rollback
      alert('Erro ao atualizar checklist: ' + err.message);
    }
  };

  const handleDragStart = useCallback((id: string) => {
    setDragging(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setOverCol(colId as typeof ETAPAS_PRODUCAO[number]);
  }, []);

  const handleDrop = useCallback(async (colId: string) => {
    if (!dragging) return;
    
    // Bloquear mover para 'Entregue' manualmente — só via pagamento
    if (colId === 'Entregue') {
      alert('Não é possível mover para "Entregue" manualmente. O projeto é movido automaticamente após confirmação do pagamento final.');
      setDragging(null);
      setOverCol(null);
      return;
    }

    // Bloquear mover para 'Aprovado' via drag — usar botão específico
    if (colId === 'Aprovado') {
      alert('Use o botão "Aprovar" no card para mover para "Aprovado". O cliente precisa ter aprovado primeiro.');
      setDragging(null);
      setOverCol(null);
      return;
    }

    // Snapshot do estado anterior para rollback
    const snapshot = projetos;

    // Optimistic Update
    setProjetos((prev) =>
      prev.map((p) => (p.id === dragging ? { ...p, status_producao: colId } : p))
    );
    
    const projectId = dragging;
    setDragging(null);
    setOverCol(null);

    try {
      await updateProjetoStatusProducao(projectId, colId);
      router.refresh();
    } catch (err: any) {

      console.error('Failed to update producao status, reverting:', err);
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

  const handleCloseDeliveryModal = () => {
    setDeliveringProject(null);
    setEntregaPaga(true);
  };

  const handleOpenSettings = (proj: Projeto) => {
    setSettingsProject(proj);
    setLinkInput(proj.link_arquivos || '');
  };

  const handleCloseSettings = () => {
    setSettingsProject(null);
    setLinkInput('');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsProject) return;
    setSubmittingSettings(true);

    try {
      await updateProjetoLinkArquivos(settingsProject.id, linkInput);
      setProjetos(prev => prev.map(p => p.id === settingsProject.id ? { ...p, link_arquivos: linkInput } : p));
      handleCloseSettings();
      router.refresh();
    } catch (error) {

      console.error('Error saving settings:', error);
      alert('Erro ao salvar configurações.');
    } finally {
      setSubmittingSettings(false);
    }
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveringProject) return;
    setSubmittingDel(true);

    try {
      await confirmarEntregaProjeto(deliveringProject, entregaPaga);
      setProjetos((prev) =>
        prev.map((p) => (p.id === deliveringProject ? {
          ...p,
          status_producao: 'Entregue',
          entrega_paga: entregaPaga
        } : p))
      );
      handleCloseDeliveryModal();
      router.refresh();

    } catch (error) {
      console.error('Error delivering project:', error);
      alert('Erro ao confirmar entrega.');
    } finally {
      setSubmittingDel(false);
    }
  };

  const handleAdminAprovar = async (projectId: string) => {
    setAdminApprovingId(projectId);
    setSubmittingApproval(true);
    try {
      await adminAprovarProjeto(projectId);
      setProjetos(prev => prev.map(p => p.id === projectId ? { ...p, status_producao: 'Aprovado' } : p));
      router.refresh();
    } catch (err: any) {
      alert('Erro ao aprovar: ' + err.message);
    } finally {
      setAdminApprovingId(null);
      setSubmittingApproval(false);
    }
  };

  const handleConfirmUndo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!undoingProject) return;
    setSubmittingUndo(true);
    try {
      await desfazerEntregaProjeto(undoingProject.id, undoTargetStatus);
      setProjetos(prev => prev.map(p => p.id === undoingProject.id ? {
        ...p, status_producao: undoTargetStatus, entrega_paga: false, data_aprovacao: null, cliente_aprovado: false
      } : p));
      setUndoingProject(null);
      router.refresh();
    } catch (err: any) {
      alert('Erro ao reverter: ' + err.message);
    } finally {
      setSubmittingUndo(false);
    }
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Carregando Produção...</div>;


  return (
    <>
      <div style={{ padding: isMobile ? '20px 16px' : '32px 36px', height: '100dvh', display: 'flex', flexDirection: 'column' }} className="fade-up">
        {/* Header */}
        <div style={{ marginBottom: 28, flexShrink: 0 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
            <span className="gradient-text">Studio Tracker</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {isMobile ? 'Deslize para ver as colunas' : 'Mova os projetos pelas etapas musicais do estúdio'}
          </p>
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
            const cards = projetos.filter((p) => p.status_producao === col.id);
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
                    const cliente = proj.clientes;
                    const isDragging = dragging === proj.id;
                    const av = cliente?.nome_artistico || cliente?.nome_pessoal || '?';
                    const isLate = isDateLateOrToday(proj.prazo_entrega);

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
                          padding: isMobile ? '10px' : '16px',
                          cursor: 'grab',
                          opacity: isDragging ? 0.5 : 1,
                          transition: 'all 0.15s',
                          boxShadow: isDragging ? '0 0 20px var(--accent-glow)' : 'none',
                        }}
                      >
                        {/* Card top: Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, marginBottom: isMobile ? 8 : 12 }}>
                          <div style={{
                            width: isMobile ? 28 : 38, height: isMobile ? 28 : 38, borderRadius: 8, flexShrink: 0,
                            background: `linear-gradient(135deg, ${getAvatarColor(av)}, ${getAvatarColor(av)}99)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: isMobile ? 11 : 15, color: '#fff',
                          }}>
                            {av.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Link href={`/clientes/${proj.cliente_id}`} style={{ textDecoration: 'none' }}>
                              <div style={{ fontWeight: 700, fontSize: isMobile ? 12 : 15, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {av}
                              </div>
                            </Link>
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
                          
                          {/* Project Settings */}
                          <button
                            onClick={() => handleOpenSettings(proj)}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              borderRadius: 8, padding: 6, cursor: 'pointer',
                              color: 'var(--text-muted)',
                              transition: 'all 0.2s', marginLeft: 6
                            }}
                            title="Configurações do Projeto"
                          >
                            <Settings size={14} />
                          </button>
                        </div>

                        {/* Serviços */}
                        <div style={{
                          fontSize: 12, color: 'var(--text-primary)',
                          background: 'var(--bg-base)', padding: '8px 12px',
                          borderRadius: 8, marginBottom: 10,
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          lineHeight: 1.4
                        }}>
                          <Disc size={14} className="text-accent" style={{ marginTop: 2, flexShrink: 0 }} /> 
                          <span style={{ fontWeight: 500 }}>
                            {proj.servicos_fechados || proj.tipo_servico || 'Serviço não especificado'}
                          </span>
                        </div>

                        {/* Terceirizados (if any) */}
                        {proj.terceirizados && (
                          <div style={{
                            fontSize: 11, color: 'var(--text-muted)',
                            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6
                          }}>
                            <Users size={12} /> {proj.terceirizados}
                          </div>
                        )}

                        {/* Badges de Aprovação Dupla */}
                        {proj.status_producao === 'Revisão' && (
                          <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {proj.cliente_aprovado ? (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                                padding: '6px 8px', borderRadius: 6, fontSize: 11, color: '#4ade80', fontWeight: 600
                              }}>
                                <Check size={12} /> Cliente Aprovou!
                              </div>
                            ) : (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                                padding: '6px 8px', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)'
                              }}>
                                <Clock size={12} /> Aguardando aprovação do cliente
                              </div>
                            )}

                            {/* Botão de aprovação pelo admin se o cliente já aprovou */}
                            {proj.cliente_aprovado && (
                              <button
                                onClick={() => handleAdminAprovar(proj.id)}
                                disabled={adminApprovingId === proj.id}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                  background: 'var(--accent)', color: '#fff', border: 'none', padding: '8px',
                                  borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                                }}
                              >
                                <ShieldCheck size={14} /> {adminApprovingId === proj.id ? 'Aprovando...' : 'Aprovar como Admin'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Botão de Reverter Etapa para projetos Aprovados ou Entregues */}
                        {(proj.status_producao === 'Aprovado' || proj.status_producao === 'Entregue') && (
                          <button
                            onClick={() => {
                              setUndoingProject(proj);
                              setUndoTargetStatus('Pós-Produção'); // valor inicial sugerido
                            }}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                              color: '#f87171', padding: '8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              cursor: 'pointer', marginBottom: 10, transition: 'all 0.2s'
                            }}
                            className="hover:bg-red-500/20"
                          >
                            <RotateCcw size={12} /> Desfazer / Reverter Etapa
                          </button>
                        )}

                        {/* Checklist (if any) */}
                        {proj.checklist_preparacao && Array.isArray(proj.checklist_preparacao) && proj.checklist_preparacao.length > 0 && (
                          <div style={{ marginBottom: 10, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>CHECKLIST MIX/MASTER</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                                {proj.checklist_preparacao.filter((c: any) => c.done).length} / {proj.checklist_preparacao.length}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {proj.checklist_preparacao.map((item: any, idx: number) => (
                                <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={item.done}
                                    onChange={() => handleToggleChecklist(proj.id, idx, !item.done)}
                                    style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', marginTop: 1 }}
                                  />
                                  <span style={{ fontSize: 11, color: item.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.3 }}>
                                    {item.item}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Footer / Prazo */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                          {proj.prazo_entrega ? (
                            <span style={{ 
                              fontSize: 12, fontWeight: 700, 
                              color: isLate ? '#ef4444' : 'var(--text-secondary)', 
                              display: 'flex', alignItems: 'center', gap: 6,
                              background: isLate ? 'rgba(239,68,68,0.1)' : 'transparent',
                              padding: isLate ? '4px 8px' : '0',
                              borderRadius: 6
                            }}>
                              <Calendar size={13} /> 
                              {new Date(proj.prazo_entrega).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={13} /> S/ Prazo
                            </span>
                          )}
                          
                          {proj.entrega_paga && col.id === 'Entregue' && (
                            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle size={13} /> Pago
                            </span>
                          )}
                        </div>

                        {/* Mobile arrow controls */}
                        {isMobile && (() => {
                          const colIdx = COLUMNS.findIndex(c => c.id === col.id);
                          const prevCol = COLUMNS[colIdx - 1];
                          const nextCol = COLUMNS[colIdx + 1];
                          if (!prevCol && !nextCol) return null;
                          return (
                            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                              {prevCol && (
                                <button
                                  onClick={async () => {
                                    setDragging(proj.id);
                                    await handleDrop(prevCol.id);
                                  }}
                                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 4px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, minHeight: 36 }}
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
                                  style={{ flex: 1, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 6, padding: '7px 4px', cursor: 'pointer', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, minHeight: 36 }}
                                >
                                  <ChevronRight size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })()}
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

      {/* Delivery Checkout Modal */}
      {deliveringProject && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 1000, padding: isMobile ? 0 : 20
        }} className="fade-in">
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            padding: isMobile ? '24px 20px' : '32px',
            borderRadius: isMobile ? '20px 20px 0 0' : '16px',
            width: '100%', maxWidth: isMobile ? '100%' : '400px',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.5)', textAlign: 'center'
          }} className="fade-up">
            
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle size={24} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Entregar Projeto</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              Você está movendo este projeto para finalizado. O cliente já realizou o pagamento dos 50% finais (acerto de contas)?
            </p>

            <form onSubmit={handleConfirmDelivery} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', background: 'var(--bg-base)', padding: '16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  checked={entregaPaga}
                  onChange={e => setEntregaPaga(e.target.checked)}
                  style={{ width: 20, height: 20, accentColor: '#22c55e' }}
                />
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Sim, o projeto está 100% pago.</span>
              </label>

              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  type="button" 
                  onClick={handleCloseDeliveryModal}
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
                  disabled={submittingDel}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8,
                    background: '#22c55e', color: '#fff', fontWeight: 700,
                    border: 'none', cursor: submittingDel ? 'not-allowed' : 'pointer',
                    opacity: submittingDel ? 0.7 : 1, transition: '0.2s'
                  }}
                >
                  {submittingDel ? 'Concluindo...' : 'Confirmar Entrega'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Settings Modal */}
      {settingsProject && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 1000, padding: isMobile ? 0 : 20
        }} className="fade-in">
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            padding: isMobile ? '20px 16px' : '32px',
            borderRadius: isMobile ? '20px 20px 0 0' : '16px',
            width: '100%', maxWidth: isMobile ? '100%' : '450px',
            maxHeight: isMobile ? '80dvh' : 'auto',
            overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)'
          }} className="fade-up">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Settings size={20} className="text-accent" /> Configurações
              </h2>
              <button 
                onClick={handleCloseSettings}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
              Gerencie os links de entrega e arquivos finais deste projeto. Os links salvos aqui ficarão visíveis para o cliente quando o projeto atingir a fase 'Entregue'.
            </p>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                  Link dos Entregáveis (Drive, WeTransfer, etc.)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={linkInput}
                  onChange={e => setLinkInput(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8,
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: '#fff', outline: 'none', fontSize: 13
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <button 
                  type="button" 
                  onClick={handleCloseSettings}
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
                  disabled={submittingSettings}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8,
                    background: 'var(--accent)', color: '#fff', fontWeight: 700,
                    border: 'none', cursor: submittingSettings ? 'not-allowed' : 'pointer',
                    opacity: submittingSettings ? 0.7 : 1, transition: '0.2s'
                  }}
                >
                  {submittingSettings ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
      {/* Undo/Revert Delivery Modal */}
      {undoingProject && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 1000, padding: isMobile ? 0 : 20
        }} className="fade-in">
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            padding: isMobile ? '24px 20px' : '32px',
            borderRadius: isMobile ? '20px 20px 0 0' : '16px',
            width: '100%', maxWidth: isMobile ? '100%' : '400px',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.5)', textAlign: 'center'
          }} className="fade-up">
            
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <RotateCcw size={24} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Reverter Projeto</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Você está desfazendo a entrega/aprovação de <strong>{undoingProject.clientes?.nome_artistico || undoingProject.clientes?.nome_pessoal || 'Projeto'}</strong>.<br/>
              Para qual etapa da produção o projeto deve voltar?
            </p>

            <form onSubmit={handleConfirmUndo} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div>
                <select
                  value={undoTargetStatus}
                  onChange={e => setUndoTargetStatus(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8,
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: '#fff', outline: 'none', fontSize: 14
                  }}
                >
                  {ETAPAS_PRODUCAO.filter(e => e !== 'Entregue' && e !== 'Aprovado').map(etapa => (
                    <option key={etapa} value={etapa}>{etapa}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  type="button" 
                  onClick={() => setUndoingProject(null)}
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
                  disabled={submittingUndo}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8,
                    background: '#ef4444', color: '#fff', fontWeight: 700,
                    border: 'none', cursor: submittingUndo ? 'not-allowed' : 'pointer',
                    opacity: submittingUndo ? 0.7 : 1, transition: '0.2s'
                  }}
                >
                  {submittingUndo ? 'Revertendo...' : 'Confirmar Reversão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
