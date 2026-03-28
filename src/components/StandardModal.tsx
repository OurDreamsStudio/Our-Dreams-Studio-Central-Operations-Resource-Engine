import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode; // Optional footer block with actions
  maxW?: string;
}

export function StandardModal({ isOpen, onClose, title, children, footer, maxW = '400px' }: StandardModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay: Fixed teletransport */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity z-[9998]"
        onClick={onClose}
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-[9999] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div 
            className="w-full bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl relative overflow-hidden ring-1 ring-white/10"
            style={{ maxWidth: maxW, margin: 'auto' }}
          >
            {/* Ambient Base Glow */}
            <div className="absolute inset-x-0 -top-px h-px w-full bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
            <div className="absolute top-0 right-[-20%] w-[100px] h-[100px] bg-purple-500/20 blur-[80px] rounded-full" />
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800 relative z-10">
              <h2 className="text-xl font-medium text-white tracking-wide">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition-all duration-300 group"
              >
                <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>
            
            {/* Content Body */}
            <div className="p-6 relative z-10">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row gap-3 items-center justify-end">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
