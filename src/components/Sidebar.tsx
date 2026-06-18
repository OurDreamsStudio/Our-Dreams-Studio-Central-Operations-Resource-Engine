'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Kanban, Users, Briefcase, Database, UserCheck, DollarSign, Calendar, Inbox, FileText } from 'lucide-react';
import { getCountPendingApprovals } from '@/actions/terceirizadosActions';
import { getLeads } from '@/actions/leadsActions';
import { Projeto, Cliente, Terceirizado, TarefaTerceirizado, Notificacao } from '@/types';

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);
  const [leadsCount, setLeadsCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const count = await getCountPendingApprovals();
        setPendingCount(count);
        const leads = await getLeads();
        setLeadsCount((leads || []).filter((l: any) => !l.lido).length);
      } catch (e) {
        console.error('Error fetching badge count:', e);
      }
    };
    fetchCount();
    // Poll every 5 minutes or just on mount for now as per "quick query" requirement
    const interval = setInterval(fetchCount, 1000 * 60 * 5);
    return () => clearInterval(interval);
  }, []);

  const links = [
    { href: '/dashboard', label: 'Dashboard',  icon: <LayoutDashboard size={18} /> },
    { href: '/admin/agenda', label: 'Agenda',   icon: <Calendar size={18} /> },
    { href: '/kanban',  label: 'Vendas',     icon: <Kanban size={18} /> },
    { href: '/producao',label: 'Produção',   icon: <Briefcase size={18} /> },
    { 
      href: '/admin/terceirizados', 
      label: 'Controle de Terceiros', 
      icon: <Users size={18} />,
      badge: pendingCount > 0 ? pendingCount : null
    },
    { href: '/clientes',label: 'Clientes',   icon: <UserCheck size={18} /> },
    {
      href: '/admin/leads',
      label: 'Leads',
      icon: <Inbox size={18} />,
      badge: leadsCount > 0 ? leadsCount : null
    },
    { href: '/admin/financeiro', label: 'Financeiro', icon: <DollarSign size={18} /> },
    { href: '/admin/propostas', label: 'Propostas Web', icon: <FileText size={18} /> },
    { href: '/admin/database', label: 'Gestão/Admin', icon: <Database size={18} /> },
  ];

  return (
    <aside
      style={{
        width: 220,
        minHeight: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 12px',
        gap: 4,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '0 6px 24px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/logo.png" 
            alt="Logo" 
            style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8, background: 'rgba(255,255,255,0.05)' }} 
          />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Our Dreams Studio
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '0 10px 8px' }}>
          MENU
        </div>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link${pathname === l.href ? ' active' : ''}`}
            style={{ position: 'relative' }}
          >
            {l.icon}
            {l.label}
            {l.badge && (
              <span style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--red)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)'
              }}>
                {l.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '12px 10px',
          borderTop: '1px solid var(--border)',
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="pulse-dot" style={{ background: 'var(--green)' }} />
            n8n conectado
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            v0.4.1 — EFI · Phase 3
          </div>
        </div>
        
        <form action="/api/auth/logout" method="POST">
           <button 
             type="submit"
             style={{ 
               width: '100%', 
               background: 'rgba(239, 68, 68, 0.1)', 
               border: '1px solid rgba(239, 68, 68, 0.2)', 
               color: '#ef4444', 
               padding: '8px 0', 
               borderRadius: 8, 
               fontSize: 12, 
               fontWeight: 600,
               cursor: 'pointer',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: 6
             }}
             className="hover:bg-red-500/20 transition-colors"
           >
             Encerrar Sessão
           </button>
        </form>
      </div>
    </aside>
  );
}
