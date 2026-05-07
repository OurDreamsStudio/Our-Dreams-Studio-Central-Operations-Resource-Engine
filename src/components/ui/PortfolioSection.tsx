'use client';

import { useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type VideoSource = 'instagram' | 'youtube';

interface PortfolioItem {
  id: string;
  source: VideoSource;
  rawUrl: string;
  editor: string;
  editorUrl?: string;
  /** Optional short description shown on hover */
  description?: string;
}

interface Category {
  id: string;
  label: string;
  icon: React.ReactNode;
  accent: string;       // Tailwind border/text color
  glowColor: string;    // CSS rgba for the glow
  items: PortfolioItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInstagramEmbedUrl(rawUrl: string): string {
  // Limpa query params e converte /reel/ para /p/ (padrão de embed do Insta)
  let clean = rawUrl.split('?')[0].replace(/\/$/, '');
  clean = clean.replace('/reel/', '/p/');
  // O endpoint /embed/ nativamente já não mostra legendas. Para mostrar seria /embed/captioned/
  return `${clean}/embed/`;
}

function getInstagramAspectRatio(rawUrl: string): string {
  // Reels são verticais (9:16 ≈ 177%), posts /p/ são quadrados (1:1 = 100%)
  return rawUrl.includes('/reel/') ? '177%' : '100%';
}

function getYouTubeEmbedUrl(rawUrl: string): string {
  // Suporta watch?v=, youtu.be/, e /shorts/
  let videoId = '';
  try {
    const url = new URL(rawUrl);
    if (url.hostname === 'youtu.be') {
      videoId = url.pathname.slice(1).split('?')[0];
    } else {
      videoId = url.searchParams.get('v') || url.pathname.split('/').pop() || '';
    }
  } catch {
    videoId = rawUrl;
  }
  // rel=0 → sem vídeos relacionados no final
  // modestbranding=1 → logo YouTube menor
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    id: 'vfx',
    label: 'VFX',
    accent: 'text-violet-400 border-violet-400',
    glowColor: 'rgba(124,58,237,0.35)',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M5 3l14 9-14 9V3z" />
      </svg>
    ),
    items: [
      {
        id: 'vfx-1',
        source: 'instagram',
        rawUrl: 'https://www.instagram.com/reel/DRPv4g5ERWK/',
        editor: 'Marshvfx',
        editorUrl: 'https://www.instagram.com/marshvfx_/?utm_source=ig_embed&ig_rid=c1ad1256-f0a2-4632-b624-632e79a2bb9f',
        description: 'Composição VFX completa com motion tracking',
      },
      {
        id: 'vfx-2',
        source: 'instagram',
        rawUrl: 'https://www.instagram.com/reel/DQNLrI_CD2g/',
        editor: 'Marshvfx',
        editorUrl: 'https://www.instagram.com/marshvfx_/?utm_source=ig_embed&ig_rid=c1ad1256-f0a2-4632-b624-632e79a2bb9f',
        description: 'Efeitos visuais e grade color',
      },
      {
        id: 'vfx-3',
        source: 'instagram',
        rawUrl: 'https://www.instagram.com/p/DKnRQQ_pttr/',
        editor: 'Marshvfx',
        editorUrl: 'https://www.instagram.com/marshvfx_/?utm_source=ig_embed&ig_rid=c1ad1256-f0a2-4632-b624-632e79a2bb9f',
        description: 'Edição criativa com VFX integrado',
      },
      {
        id: 'vfx-4',
        source: 'youtube',
        rawUrl: 'https://www.youtube.com/watch?v=aWfTJ8Qo4yY',
        editor: 'Psgreco',
        description: 'VFX cinematic de alto nível',
      },
    ],
  },
  {
    id: 'performance',
    label: 'Performance',
    accent: 'text-pink-400 border-pink-400',
    glowColor: 'rgba(236,72,153,0.35)',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    items: [
      {
        id: 'perf-1',
        source: 'youtube',
        rawUrl: 'https://www.youtube.com/watch?v=NSe5j0lTTmg',
        editor: 'Matheus',
        description: 'Edição de performance ao vivo',
      },
      {
        id: 'perf-2',
        source: 'youtube',
        rawUrl: 'https://www.youtube.com/watch?v=yPO9mo4D-dg',
        editor: 'Matheus',
        description: 'Clipe de performance com cortes dinâmicos',
      },
      {
        id: 'perf-3',
        source: 'youtube',
        rawUrl: 'https://youtu.be/8RSXZCzrIVE',
        editor: 'Matheus',
        description: 'Sessão de performance editada com precisão',
      },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: VideoSource }) {
  if (source === 'instagram') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-[#460362]/8 text-[#460362] border border-[#460362]/15">
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
        Instagram
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-red-50 text-red-600 border border-red-100">
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
      YouTube
    </span>
  );
}

function VideoCard({
  item,
  isFeatured = false,
  accentGlow,
}: {
  item: PortfolioItem;
  isFeatured?: boolean;
  accentGlow: string;
}) {
  const embedUrl =
    item.source === 'instagram'
      ? getInstagramEmbedUrl(item.rawUrl)
      : getYouTubeEmbedUrl(item.rawUrl);

  // Calcula o aspect-ratio do iframe dinamicamente
  const aspectPadding =
    item.source === 'youtube'
      ? '56.25%'   // 16:9
      : getInstagramAspectRatio(item.rawUrl);

  return (
    <div
      className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'rgba(255,255,255,0.65)',
        border: '1px solid rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
      }}
    >
      {/* Glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ boxShadow: `0 0 40px ${accentGlow}` }}
      />

      {/* Video embed */}
      <div
        className="relative w-full overflow-hidden rounded-t-2xl bg-neutral-100"
        style={{ paddingBottom: aspectPadding }}
      >
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full border-none"
          scrolling="no"
          allow="encrypted-media; autoplay; clipboard-write; fullscreen; picture-in-picture"
          allowFullScreen
          title={`Portfólio - ${item.editor}`}
        />
      </div>

      {/* Footer do card */}
      <div className="px-4 py-3 flex items-center justify-between gap-2 bg-white/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#460362]/10 border border-[#460362]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-black text-[#460362]">
              {item.editor.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            {item.editorUrl ? (
              <a 
                href={item.editorUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs font-bold text-neutral-800 truncate hover:text-[#460362] transition-colors hover:underline"
              >
                Edited by {item.editor}
              </a>
            ) : (
              <p className="text-xs font-bold text-neutral-800 truncate">Edited by {item.editor}</p>
            )}
            {item.description && (
              <p className="text-[10px] text-neutral-400 truncate">{item.description}</p>
            )}
          </div>
        </div>
        <SourceBadge source={item.source} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PortfolioSection() {
  const [activeId, setActiveId] = useState<string>(CATEGORIES[0].id);

  const active = CATEGORIES.find((c) => c.id === activeId)!;
  const [featured, ...rest] = active.items;

  return (
    <section id="portfolio" className="w-full max-w-6xl mb-32 px-0">
      {/* Header */}
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 mb-3 tracking-tight">
          Nossos Editores
        </h2>
        <p className="text-neutral-500 max-w-md mx-auto leading-relaxed">
          Explore o nível dos nossos editores. Cada categoria é um mundo visual diferente.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
        {CATEGORIES.map((cat) => {
          const isActive = cat.id === activeId;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveId(cat.id)}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300
                ${isActive
                  ? 'bg-[#460362] text-white shadow-lg shadow-[#460362]/30 scale-105'
                  : 'bg-white/60 backdrop-blur text-neutral-600 border border-white/80 hover:border-[#460362]/30 hover:text-[#460362]'
                }
              `}
            >
              <span className={isActive ? 'text-white' : 'text-neutral-400'}>
                {cat.icon}
              </span>
              {cat.label}
              <span className={`
                text-[10px] px-1.5 py-0.5 rounded-full font-black
                ${isActive ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-500'}
              `}>
                {cat.items.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Glow accent bar */}
      <div
        className="w-24 h-0.5 mx-auto mb-10 rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${active.glowColor}, transparent)` }}
      />

      {/* Content Layout */}
      <div
        key={activeId}
        style={{ animation: 'fadeUpPortfolio 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {activeId === 'performance' ? (
          /* Layout Perfeito para Performance (3 itens iguais) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:row-span-2">
              <VideoCard
                item={featured}
                isFeatured={true}
                accentGlow={active.glowColor}
              />
            </div>
            {rest.map((item) => (
              <VideoCard
                key={item.id}
                item={item}
                isFeatured={false}
                accentGlow={active.glowColor}
              />
            ))}
          </div>
        ) : (
          /* Layout Masonry perfeito para VFX (Itens de tamanhos diferentes) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="flex flex-col gap-6">
              {active.items.filter((_, i) => i % 2 === 0).map((item) => (
                <VideoCard
                  key={item.id}
                  item={item}
                  isFeatured={false}
                  accentGlow={active.glowColor}
                />
              ))}
            </div>
            <div className="flex flex-col gap-6">
              {active.items.filter((_, i) => i % 2 === 1).map((item) => (
                <VideoCard
                  key={item.id}
                  item={item}
                  isFeatured={false}
                  accentGlow={active.glowColor}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fade-in animation keyframes via inline style tag */}
      <style>{`
        @keyframes fadeUpPortfolio {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
