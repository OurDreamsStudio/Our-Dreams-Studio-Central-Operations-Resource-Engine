'use client';

interface InstagramEmbedProps {
  url: string;
  className?: string;
}

export function InstagramEmbed({ url, className = '' }: InstagramEmbedProps) {
  // Limpa a URL de qualquer query string (como ?igsh=...)
  const cleanUrl = url.split('?')[0].replace(/\/$/, '');
  
  // Adiciona o /embed para puxar o player nativo do Instagram sem carregar o site todo
  const embedUrl = `${cleanUrl}/embed/`;

  return (
    <div className={`relative overflow-hidden bg-neutral-100 dark:bg-neutral-800 ${className}`}>
      <iframe
        src={embedUrl}
        className="absolute top-0 left-0 w-full h-full border-none"
        scrolling="no"
        allowTransparency={true}
        allow="encrypted-media"
        title="Instagram Video Embed"
      />
    </div>
  );
}
