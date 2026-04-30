import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxW?: string;
}

export function StandardModal({ isOpen, onClose, title, children, footer, maxW = '500px' }: StandardModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 9998,
        }}
      />

      {/* Bottom-sheet container on mobile, centered on desktop */}
      <div style={{
        position: 'fixed', inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
      }}>
        <div
          className="standard-modal-inner"
          style={{
            width: '100%',
            maxWidth: maxW,
            background: 'var(--bg-surface)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 60px rgba(0,0,0,0.6)',
            maxHeight: '92dvh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Drag handle pill */}
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.15)',
            margin: '12px auto 0',
            flexShrink: 0,
          }} />

          {/* Top line glow */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)',
          }} />

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-muted)', cursor: 'pointer',
                borderRadius: 10, padding: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(0,0,0,0.2)',
              display: 'flex', flexDirection: 'column', gap: 10,
              flexShrink: 0,
            }}>
              {footer}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .standard-modal-inner {
            border-radius: 16px !important;
            margin: auto !important;
            margin-bottom: 40px !important;
          }
          .standard-modal-inner > div:first-child {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
