'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Disc, DollarSign, Calendar, Users, X, CheckCircle, Link as LinkIcon, Check, Settings } from 'lucide-react';
import { handleSupabaseError, formatCurrency, formatDate } from '@/lib/utils';
import { useGrabScroll } from '@/hooks/useGrabScroll';

import { ETAPAS_PRODUCAO, ProducaoStatus, getStatusTheme } from '@/constants/workflow';
import { Projeto, Cliente, Terceirizado, TarefaTerceirizado, Notificacao } from '@/types';

const COLUMNS: { id: typeof ETAPAS_PRODUCAO[number]; label: string }[] = [
  { id: 'Definição de Escopo', label: 'Def. Escopo' },
  { id: 'Preparação Técnica', label: 'Prep. Técnica' },
  { id: 'Execução & Captação', label: 'Execução' },
  { id: 'Pós-Produção', label: 'Pós-Produção' },
  { id: 'Revisão', label: 'Revisão' },
  { id: 'Entregue', label: 'Entregue' },
];

function getAvatarColor(name: string) {
  const colors = ['#7c3aed','#2563eb','#0891b2','#059669','#d97706'];
  return colors[name.charCodeAt(0) % colors.length];
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
  const [loading, setLoading] = useState(true);

  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ProducaoStatus | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delivery Modal
  const [deliveringProject, setDeliveringProject] = useState<string | null>(null);
  const [submittingDel, setSubmittingDel] = useState(false);
  const [entregaPaga, setEntregaPaga] = useState(true);
  
  // Settings Modal
  const [settingsProject, setSettingsProject] = useState<any | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [submittingSettings, setSubmittingSettings] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // Fetches all projects that have a status_producao and not cancelled
      const { data: pData, error } = await supabase
        .from('projetos')
        .select('*, clientes(*)')
        .not('status_producao', 'is', null)
        .neq('status_producao', 'Cancelado')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching projetos de producao:', error);
      }
      
      setProjetos(pData || []);
      setLoading(false);
    }
    fetchData();
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
      const { error } = await supabase
        .from('projetos')
        .update({ checklist_preparacao: newChecklist })
        .eq('id', projectId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update checklist, reverting:', err);
      setProjetos(snapshot); // Rollback
      alert('Erro ao atualizar checklist. A alteração foi revertida.');
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
    
    if (colId === 'Entregue') {
      setDeliveringProject(dragging);
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
      const { error } = await supabase
        .from('projetos')
        .update({ status_producao: colId })
        .eq('id', projectId);
        
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update producao status, reverting:', err);
      setProjetos(snapshot); // Rollback
      alert('Erro ao atualizar posição. A alteração foi revertida.');
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

    const { error } = await supabase
      .from('projetos')
      .update({ link_arquivos: linkInput })
      .eq('id', settingsProject.id);

    if (error) {
      console.error('Error saving settings:', error);
      alert('Erro ao salvar configurações.');
    } else {
      setProjetos(prev => prev.map(p => p.id === settingsProject.id ? { ...p, link_arquivos: linkInput } : p));
      handleCloseSettings();
    }
    setSubmittingSettings(false);
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveringProject) return;
    setSubmittingDel(true);

    const { error } = await supabase
      .from('projetos')
      .update({
        status_producao: 'Entregue',
        entrega_paga: entregaPaga
      })
      .eq('id', deliveringProject);

    if (error) {
      console.error('Error delivering project:', error);
      alert('Erro ao confirmar entrega.');
      setSubmittingDel(false);
      return;
    }

    setProjetos((prev) =>
      prev.map((p) => (p.id === deliveringProject ? {
        ...p,
        status_producao: 'Entregue',
        entrega_paga: entregaPaga
      } : p))
    );

    setSubmittingDel(false);
    handleCloseDeliveryModal();
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Carregando Produção...</div>;

  return (
    <>
      <div style={{ padding: '32px 36px', height: '100vh', display: 'flex', flexDirection: 'column' }} className="fade-up">
        {/* Header */}
        <div style={{ marginBottom: 28, flexShrink: 0 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
            <span className="gradient-text">Studio Tracker</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Mova os projetos pelas etapas musicais do estúdio
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
                          borderRadius: 12,
                          padding: '16px',
                          cursor: 'grab',
                          opacity: isDragging ? 0.5 : 1,
                          transition: 'all 0.15s',
                          boxShadow: isDragging ? '0 0 20px var(--accent-glow)' : 'none',
                        }}
                      >
                        {/* Card top: Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            background: `linear-gradient(135deg, ${getAvatarColor(av)}, ${getAvatarColor(av)}99)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: 15, color: '#fff',
                          }}>
                            {av.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <Link href={`/clientes/${proj.cliente_id}`} style={{ textDecoration: 'none' }}>
                              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }} className="fade-in">
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center'
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
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }} className="fade-in">
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '450px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
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
          </div>
        </div>
      )}
    </>
  );
}
