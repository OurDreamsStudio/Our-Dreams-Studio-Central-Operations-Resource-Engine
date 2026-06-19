'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Loader2,
  Music,
  Mic,
  Guitar,
  Disc
} from 'lucide-react';
import Link from 'next/link';
import { getProjetosAgenda, updateProjectDeadline } from '@/actions/databaseActions';
import { getAlertedProjectIds } from '@/actions/alertaActions';
import { supabase } from '@/lib/supabase';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface AgendaEvent {
  id: string;
  type: string;
  title: string;
  prazo_entrega: string;
  status_producao: string;
  projeto_id?: string;
  // Extra properties that might be on the fetched object
  nome?: string | null;
  servicos_fechados?: any;
  tipo_servico?: string | null;
  descricao_tarefa?: string | null;
  status_entrega?: string | null;
}

export default function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projetos, setProjetos] = useState<AgendaEvent[]>([]);
  const [alertedIds, setAlertedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();


  const fetchData = async () => {
    try {
      const [data, alerts] = await Promise.all([
        getProjetosAgenda(),
        getAlertedProjectIds()
      ]);
      setProjetos(data || []);
      setAlertedIds((alerts as string[]) || []);
    } catch (e: any) {
      console.error('Erro ao buscar dados:', e);
      setError(e.message || 'Erro desconhecido ao carregar agenda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Realtime: escuta mudanças em projetos e tarefas de terceiros
    const channel = supabase
      .channel('realtime-agenda')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projetos' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_terceirizados' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleDrop = async (e: React.DragEvent, dayStr: string) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('projectId');
    if (!projectId) return;

    startTransition(async () => {
      try {
        await updateProjectDeadline(projectId, dayStr);
        fetchData();
        router.refresh();
      } catch (err: any) {
        alert('Erro ao atualizar prazo: ' + err.message);
      }
    });

  };

  if (loading) {
    return (
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ padding: 24, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 16 }}>
          <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={20} />
            Erro de Carregamento
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{error}</div>
        </div>
      </div>
    );
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days = [];
  // Padrão do calendário: dias do mês anterior para preencher
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  // Helper colors
  const getStatusColor = (status: string, type?: string) => {
    if (type === 'terceiro') {
      return status === 'Entregue' ? 'var(--green)' : '#00f5ff'; // Aqua Neon for partners
    }
    switch (status) {
      case 'Entregue': return 'var(--green)';
      case 'Revisão': return '#f59e0b';
      case 'Em Execução': return 'var(--accent-light)';
      case 'Pendente': return 'var(--text-muted)';
      case 'Briefing': return '#3b82f6';
      default: return 'var(--accent)';
    }
  };

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 40px)', maxWidth: 1400, margin: '0 auto' }} className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
            <CalendarIcon className="text-accent" /> The <span className="gradient-text">Pulse</span> Agenda
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Gestão visual de prazos e fluxo de entrega.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '4px 8px' }}>
            <button onClick={prevMonth} className="icon-btn-small"><ChevronLeft size={18} /></button>
            <div style={{ fontSize: 16, fontWeight: 700, minWidth: 150, textAlign: 'center', color: '#fff' }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <button onClick={nextMonth} className="icon-btn-small"><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-light)' }} /> EM EXECUÇÃO</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> REVISÃO</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} /> ENTREGUE</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '2px', background: '#00f5ff' }} /> TAREFA PARCEIRO (🎸)</span>
      </div>

      {/* Calendar Grid */}
      <div className="glass" style={{ padding: 1, borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}
             className="agenda-calendar-grid">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} style={{ padding: '10px 4px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{d}</div>
          ))}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(70px, auto)' }}
             className="agenda-calendar-grid">
          {days.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} style={{ border: '0.1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }} />;
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const dayProjects = projetos.filter(p => p.prazo_entrega === dateStr);

            return (
              <div 
                key={dateStr}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, dateStr)}
                className="agenda-cell"
                style={{ 
                  border: '0.1px solid var(--border)', 
                  padding: 6, 
                  background: isToday ? 'rgba(124,58,237,0.02)' : 'transparent',
                  transition: '0.2s',
                  position: 'relative',
                  minHeight: 80,
                }}
              >
                <div className="agenda-cell-number" style={{ 
                  fontSize: 12, 
                  fontWeight: 800, 
                  color: isToday ? 'var(--accent-light)' : 'var(--text-muted)',
                  marginBottom: 4,
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  {day}
                  {isToday && <span style={{ fontSize: 9, background: 'var(--accent)', color: '#fff', padding: '1px 4px', borderRadius: 4 }}>HOJE</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dayProjects.map(p => {
                    const isAlerted = alertedIds.includes(p.id);
                    const isTerceiro = p.type === 'terceiro';
                    
                    return (
                      <div 
                        key={`${p.type}-${p.id}`}
                        draggable={!isTerceiro}
                        onDragStart={(e) => !isTerceiro && e.dataTransfer.setData('projectId', p.id)}
                        className={`agenda-event-pill ${!isTerceiro ? 'project-card-hover' : ''}`}
                        style={{ 
                          fontSize: 10, 
                          fontWeight: 700, 
                          padding: '4px 6px', 
                          borderRadius: 6, 
                          background: isTerceiro ? 'rgba(0, 245, 255, 0.05)' : 'rgba(0,0,0,0.4)', 
                          borderLeft: `3px solid ${getStatusColor(p.status_producao, p.type)}`,
                          border: isAlerted ? '1px solid #ef4444' : isTerceiro ? '1px solid rgba(0, 245, 255, 0.2)' : undefined,
                          boxShadow: isAlerted ? '0 0 12px rgba(239, 68, 68, 0.4)' : '0 2px 4px rgba(0,0,0,0.2)',
                          cursor: isTerceiro ? 'default' : 'grab',
                          transition: '0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          animation: isAlerted ? 'pulse-red 2s infinite' : 'none',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%', display: 'flex', alignItems: 'center', gap: 4 }}>
                             {isTerceiro ? <Guitar size={10} style={{ color: '#00f5ff' }} /> : <Disc size={10} className="text-accent" />}
                             {p.title}
                           </span>
                           <Link href={`/admin/projetos/${isTerceiro ? p.projeto_id : p.id}`} title="Ir para Dossiê">
                             <ExternalLink size={10} className={isTerceiro ? "text-aqua" : "text-muted hover:text-white"} />
                           </Link>
                        </div>
                        <div style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{p.status_producao}</span>
                          {isAlerted && <AlertCircle size={8} style={{ color: '#ef4444' }} />}
                          {p.status_producao === 'Entregue' && <CheckCircle2 size={8} style={{ color: 'var(--green)' }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .icon-btn-small { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .icon-btn-small:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .project-card-hover:hover { transform: translateY(-2px); background: rgba(255,255,255,0.05); }
        .project-card-hover:active { cursor: grabbing; }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
