'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function NavigationWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f172a] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-auto pb-10">{children}</main>
      </div>
    </div>
  );
}
