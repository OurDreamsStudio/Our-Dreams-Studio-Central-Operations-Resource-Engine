'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return { isMobile, mounted };
}

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const { isMobile, mounted } = useIsMobile();

  return (
    <div
      style={{
        display: 'flex',
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        background: '#0f172a',
        color: '#fff',
      }}
    >
      {/* Sidebar — desktop only. Before mount, show sidebar by default (SSR-safe) */}
      {(!mounted || !isMobile) && <Sidebar />}

      {/* Main area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Header isMobile={mounted && isMobile} />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingBottom: mounted && isMobile
              ? 'calc(64px + env(safe-area-inset-bottom, 0px))'
              : '40px',
          }}
        >
          {children}
        </main>
      </div>

      {/* MobileNav — mobile only */}
      {mounted && isMobile && <MobileNav />}
    </div>
  );
}
