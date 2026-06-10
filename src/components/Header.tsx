'use client';

import { useState, useEffect, useTransition } from 'react';
import { Bell, X, ExternalLink, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getNotifications, getUnreadCount, markAsRead, runVigilanceEngine, clearAllNotifications } from '@/actions/alertaActions';

interface HeaderProps {
  isMobile?: boolean;
}

export default function Header({ isMobile = false }: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const fetchNotifications = async () => {
    try {
      const [list, count] = await Promise.all([
        getNotifications(),
        getUnreadCount()
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const THROTTLE_KEY = 'ods_vigilance_last_run';
    const THROTTLE_MS = 1000 * 60 * 10; // 10 minutos
    const lastRun = Number(localStorage.getItem(THROTTLE_KEY) || 0);
    const now = Date.now();

    if (now - lastRun > THROTTLE_MS) {
      localStorage.setItem(THROTTLE_KEY, String(now));
      runVigilanceEngine().then(fetchNotifications).catch(console.error);
    }

    const interval = setInterval(fetchNotifications, 1000 * 60 * 2);
    return () => clearInterval(interval);
  }, []);

  const handleClearAll = async () => {
    startTransition(async () => {
      try {
        await clearAllNotifications();
        setNotifications([]);
        setUnreadCount(0);
      } catch (e) {
        alert('Erro ao limpar notificações. Tente novamente.');
        fetchNotifications();
      }
    });
  };

  const handleMarkRead = async (id: string) => {
    startTransition(async () => {
      try {
        await markAsRead(id);
        fetchNotifications();
      } catch (e) {
        console.error('Error marking as read:', e);
      }
    });
  };

  return (
    <header
      style={{
        height: 56,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isMobile ? 'space-between' : 'flex-end',
        padding: isMobile ? '0 16px' : '0 40px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Mobile: brand name on the left */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo"
            style={{
              width: 28,
              height: 28,
              objectFit: 'contain',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.05)',
            }}
          />
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', marginTop: 2 }}>
            Our Dreams Studio
          </span>
        </div>
      )}

      {/* Notification bell */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: 8,
            position: 'relative',
            borderRadius: '50%',
            transition: '0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: '#ef4444',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid rgba(15,23,42,1)',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {showDropdown && (
          <div
            className="glass"
            style={{
              position: isMobile ? 'fixed' : 'absolute',
              top: isMobile ? 56 : 'calc(100% + 8px)',
              right: isMobile ? 0 : 0,
              left: isMobile ? 0 : 'auto',
              width: isMobile ? '100vw' : 380,
              maxHeight: isMobile ? '70vh' : 500,
              overflowY: 'auto',
              borderRadius: isMobile ? '0 0 16px 16px' : 16,
              zIndex: 1000,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              animation: 'fadeUp 0.2s ease-out',
              border: '1px solid var(--border)',
              borderTop: isMobile ? 'none' : '1px solid var(--border)',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.02)',
                position: 'sticky',
                top: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Vigilância</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleClearAll}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Limpar Tudo
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowDropdown(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border)',
                      background: n.lida ? 'transparent' : 'rgba(239, 68, 68, 0.03)',
                      display: 'flex',
                      gap: 12,
                    }}
                  >
                    <div style={{ marginTop: 2 }}>
                      <AlertCircle
                        size={16}
                        style={{
                          color: n.titulo.includes('🆘') ? '#ef4444' : '#f59e0b',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          marginBottom: 4,
                          color: n.lida ? 'var(--text-muted)' : '#fff',
                        }}
                      >
                        {n.titulo}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          lineHeight: 1.4,
                          marginBottom: 10,
                        }}
                      >
                        {n.mensagem}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 16,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => {
                              handleMarkRead(n.id);
                              setShowDropdown(false);
                            }}
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: 'var(--accent-light)',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            IR PARA DOSSIÊ <ExternalLink size={10} />
                          </Link>
                        )}
                        {!n.lida && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--green)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            MARCAR COMO LIDA <Check size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  Nenhum alerta pendente. Operação Segura.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
}
