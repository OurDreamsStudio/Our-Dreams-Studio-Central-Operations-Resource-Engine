'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Loader2
} from 'lucide-react';
import { getProjetosAgenda } from '@/actions/databaseActions';
import { Projeto, Cliente, Terceirizado, TarefaTerceirizado, Notificacao } from '@/types';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function PublicAgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const data = await getProjetosAgenda();
      setProjetos(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
             /* eslint-disable-next-line @next/next/no-img-element */
<img src="/logo.png" alt="Logo" style={{ width: 40, height: 40, borderRadius: 8 }} />
             <h1 style={{ fontSize: 24, fontWeight: 800 }}>Our Dreams <span className="gradient-text">Studio Pulse</span></h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cronograma Público de Produção e Prazos.</p>
        </div>

        {/* Calendar Nav */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 32 }}>
            <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: 8, borderRadius: 8, cursor: 'pointer' }}><ChevronLeft size={20} /></button>
            <div style={{ fontSize: 18, fontWeight: 800, minWidth: 200, textAlign: 'center' }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: 8, borderRadius: 8, cursor: 'pointer' }}><ChevronRight size={20} /></button>
        </div>

        {/* Public Grid */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
            {DAYS_OF_WEEK.map(d => (
              <div key={d} style={{ padding: '16px', textAlign: 'center', fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>{d}</div>
            ))}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(100px, auto)' }}>
            {days.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} style={{ border: '0.1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }} />;
              
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayProjects = projetos.filter(p => p.prazo_entrega === dateStr);

              return (
                <div key={dateStr} style={{ border: '0.1px solid rgba(255,255,255,0.05)', padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>{day}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dayProjects.map(p => (
                      <div key={p.id} style={{ fontSize: 10, fontWeight: 700, padding: '6px 10px', borderRadius: 8, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', color: 'var(--accent-light)' }}>
                        {p.nome}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-muted)', fontSize: 11 }}>
          © {new Date().getFullYear()} Our Dreams Studio — Central de Comando Pulse
        </div>
      </div>
    </div>
  );
}
