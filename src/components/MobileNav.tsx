'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Kanban,
  Users,
  Briefcase,
  Database,
  UserCheck,
  DollarSign,
  Calendar,
  Inbox,
  MoreHorizontal,
  X,
  CreditCard,
} from 'lucide-react';
import { getCountPendingApprovals } from '@/actions/terceirizadosActions';
import { getLeads } from '@/actions/leadsActions';

const PRIMARY_LINKS = [
  { href: '/dashboard',        label: 'Home',      icon: LayoutDashboard },
  { href: '/admin/agenda',     label: 'Agenda',    icon: Calendar },
  { href: '/kanban',           label: 'Vendas',    icon: Kanban },
  { href: '/producao',         label: 'Produção',  icon: Briefcase },
  { href: '/admin/database',   label: 'Admin',     icon: Database },
];

const MORE_LINKS = [
  { href: '/clientes',              label: 'Clientes',    icon: UserCheck },
  { href: '/admin/leads',           label: 'Leads',       icon: Inbox },
  { href: '/admin/financeiro',      label: 'Financeiro',  icon: DollarSign },
  { href: '/admin/propostas',       label: 'Pagamentos',  icon: CreditCard },
  { href: '/admin/terceirizados',   label: 'Parceiros',   icon: Users },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);
  const [leadsCount, setLeadsCount] = useState(0);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const count = await getCountPendingApprovals();
        setPendingCount(count);
        const leads = await getLeads();
        setLeadsCount((leads || []).filter((l: any) => !l.lido).length);
      } catch (e) {
        console.error('Error fetching badge count:', e);
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 1000 * 60 * 5);
    return () => clearInterval(interval);
  }, []);

  const getBadge = (href: string) => {
    if (href === '/admin/leads') return leadsCount > 0 ? leadsCount : null;
    if (href === '/admin/terceirizados') return pendingCount > 0 ? pendingCount : null;
    return null;
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 200,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {PRIMARY_LINKS.map((link) => {
          const active = isActive(link.href);
          const badge = getBadge(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                textDecoration: 'none',
                color: active ? 'var(--accent-light)' : 'var(--text-muted)',
                position: 'relative',
                transition: 'color 0.15s ease',
                padding: '8px 4px',
              }}
            >
              {/* Active indicator */}
              {active && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24,
                    height: 2,
                    background: 'var(--accent)',
                    borderRadius: '0 0 4px 4px',
                    boxShadow: '0 0 8px var(--accent-glow)',
                  }}
                />
              )}

              <div style={{ position: 'relative' }}>
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.8}
                  style={{
                    filter: active
                      ? 'drop-shadow(0 0 6px rgba(139,92,246,0.6))'
                      : 'none',
                  }}
                />
                {badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -6,
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 800,
                      minWidth: 15,
                      height: 15,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 3px',
                      border: '1.5px solid rgba(15,23,42,1)',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>

              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  letterSpacing: '0.01em',
                }}
              >
                {link.label}
              </span>
            </Link>
          );
        })}

        {/* "Mais" button */}
        <button
          onClick={() => setShowMore(true)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            background: 'none',
            border: 'none',
            color:
              leadsCount > 0 || pendingCount > 0
                ? '#ef4444'
                : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '8px 4px',
            transition: 'color 0.15s ease',
            position: 'relative',
          }}
        >
          <div style={{ position: 'relative' }}>
            <MoreHorizontal size={22} strokeWidth={1.8} />
            {(leadsCount > 0 || pendingCount > 0) && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -6,
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 800,
                  minWidth: 15,
                  height: 15,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  border: '1.5px solid rgba(15,23,42,1)',
                }}
              >
                {leadsCount + pendingCount}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 500 }}>Mais</span>
        </button>
      </nav>

      {/* "Mais" Drawer */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowMore(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 201,
            }}
          />

          {/* Drawer */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--bg-surface)',
              borderTop: '1px solid var(--border)',
              borderRadius: '20px 20px 0 0',
              zIndex: 202,
              padding: '16px 20px',
              paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
              animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Handle */}
            <div
              style={{
                width: 36,
                height: 4,
                background: 'var(--border-light)',
                borderRadius: 4,
                margin: '0 auto 20px',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Mais opções
              </span>
              <button
                onClick={() => setShowMore(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              {MORE_LINKS.map((link) => {
                const active = isActive(link.href);
                const badge = getBadge(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setShowMore(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      borderRadius: 12,
                      textDecoration: 'none',
                      background: active
                        ? 'rgba(124,58,237,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      border: active
                        ? '1px solid rgba(124,58,237,0.3)'
                        : '1px solid var(--border)',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      position: 'relative',
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Icon
                        size={20}
                        strokeWidth={active ? 2.2 : 1.8}
                        style={{ color: active ? 'var(--accent-light)' : 'inherit' }}
                      />
                      {badge && (
                        <span
                          style={{
                            position: 'absolute',
                            top: -5,
                            right: -7,
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 800,
                            minWidth: 15,
                            height: 15,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 3px',
                          }}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Logout quick action */}
            <form action="/api/auth/logout" method="POST" style={{ marginTop: 16 }}>
              <button
                type="submit"
                style={{
                  width: '100%',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  padding: '12px 0',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Encerrar Sessão
              </button>
            </form>
          </div>
        </>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
