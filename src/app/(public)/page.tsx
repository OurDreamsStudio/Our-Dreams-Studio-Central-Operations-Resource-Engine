'use client';

import Link from 'next/link';
import { useState } from 'react';
import { submitLead } from '@/actions/leadsActions';

export default function LandingPage() {
  const glassClasses = "bg-white/60 backdrop-blur-lg border border-white/80 shadow-lg";
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormState('loading');
    const fd = new FormData(e.currentTarget);
    try {
      await submitLead({
        nome: fd.get('name') as string,
        email: fd.get('email') as string,
        whatsapp: fd.get('whatsapp') as string,
        mensagem: fd.get('message') as string,
      });
      setFormState('success');
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar. Tente novamente.');
      setFormState('error');
    }
  };

  return (
    <div className="relative z-[9999] isolate min-h-screen bg-[#F9F9FB] text-neutral-800 font-sans selection:bg-[#460362] selection:text-white">
      {/* Floating Navbar */}
      <nav className={`fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl z-[100] pointer-events-auto rounded-2xl flex items-center justify-between px-6 py-4 ${glassClasses}`}>
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo Our Dreams Studio"
            className="h-10 w-auto object-contain"
          />
        </div>
        <div>
          <Link
            href="/login"
            className="relative z-[999] cursor-pointer pointer-events-auto text-sm font-semibold px-5 py-2 rounded-xl bg-[#460362] text-white hover:bg-purple-900 transition-colors shadow-lg shadow-[#460362]/30"
          >
            Login
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-4 sm:px-6 flex flex-col items-center">
        {/* Hero Section */}
        <section className="w-full max-w-5xl text-center mt-12 mb-24 px-4">
          <div className="inline-block mb-4 px-4 py-1.5 rounded-full text-sm font-medium text-[#460362] bg-[#460362]/10 border border-[#460362]/20">
            Feita por Artistas, para Artistas.
          </div>
          <h1 className="text-5xl sm:text-7xl font-extrabold text-neutral-700 tracking-tight leading-[1.1] mb-6">
            Foque na <span className="text-[#460362]">Liberdade</span> <br />
            e na <span className="text-[#460362]">Criatividade</span> de ser um <span className="text-[#460362]">artista</span>.
          </h1>
          <p className="text-lg sm:text-xl text-neutral-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Deixe que nós cuidamos do resto!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="#contact" className="px-24 py-4 rounded-full bg-[#460362] text-white font-bold text-lg hover:bg-purple-900 transition-all shadow-xl shadow-[#460362]/25 hover:-translate-y-0.5">
              Realizar um Orçamento
            </Link>
          </div>
        </section>

        {/* The Producers */}
        <section id="producers" className="w-full max-w-6xl mb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-neutral-900 mb-4">Nossos Produtores</h2>
            <p className="text-neutral-500 max-w-lg mx-auto">A mente por trás de tudo. Conheça os produtores responsáveis pela qualidade do estúdio.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Producer Card 1: Maq */}
            <a
              href="https://open.spotify.com/playlist/7yKZXUeUSOUvbmvnAsEu2Z?si=0wGSZB4XT5Sxa8Jv3pLZBg"
              target="_blank"
              rel="noopener noreferrer"
              className={`group rounded-[2rem] p-8 ${glassClasses} flex flex-col items-center text-center gap-6 transition-all hover:-translate-y-2 duration-300 hover:shadow-2xl hover:shadow-[#460362]/5`}
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-2 border-white shadow-md overflow-hidden ring-4 ring-[#460362]/5 group-hover:ring-[#460362]/10 transition-all">
                  <img src="equipe/maq.jpg" alt="Foto Maq" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[#1DB954] p-1.5 rounded-full shadow-sm">
                  <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zM20.16 9.6C15.84 7.08 9.24 6.9 5.4 8.04c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.32-1.32 11.52-1.14 16.32 1.68.54.3 0.72 1.02.42 1.56-.3.54-1.02.66-1.5.42z" /></svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 group-hover:text-[#460362] transition-colors">Maq</h3>
                <p className="text-sm text-neutral-500 font-medium">Produtor Musical / Beatmaker</p>
              </div>
              <div className="w-full py-3 rounded-xl bg-[#460362]/5 text-[#460362] font-bold text-sm tracking-wide group-hover:bg-[#460362] group-hover:text-white transition-all flex items-center justify-center gap-2">
                Ouvir Portfólio
              </div>
            </a>

            {/* Producer Card 2: Matheus */}
            <a
              href="https://open.spotify.com/playlist/6cPwdOnqVtzrFXzwYmfOsK?si=KdwbWDr3QsmTQ4hRkQmNww&pi=fFrHxJhnQze8h"
              target="_blank"
              rel="noopener noreferrer"
              className={`group rounded-[2rem] p-8 ${glassClasses} flex flex-col items-center text-center gap-6 transition-all hover:-translate-y-2 duration-300 hover:shadow-2xl hover:shadow-[#460362]/5`}
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-2 border-white shadow-md overflow-hidden ring-4 ring-[#460362]/5 group-hover:ring-[#460362]/10 transition-all">
                  <img src="equipe/matheus.JPEG" alt="Foto Matheus" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[#1DB954] p-1.5 rounded-full shadow-sm">
                  <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zM20.16 9.6C15.84 7.08 9.24 6.9 5.4 8.04c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.32-1.32 11.52-1.14 16.32 1.68.54.3 0.72 1.02.42 1.56-.3.54-1.02.66-1.5.42z" /></svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 group-hover:text-[#460362] transition-colors">Matheus</h3>
                <p className="text-sm text-neutral-500 font-medium">Engenheiro de Áudio / Produtor</p>
              </div>
              <div className="w-full py-3 rounded-xl bg-[#460362]/5 text-[#460362] font-bold text-sm tracking-wide group-hover:bg-[#460362] group-hover:text-white transition-all flex items-center justify-center gap-2">
                Ouvir Portfólio
              </div>
            </a>

            {/* Producer Card 3: S7ven */}
            <a
              href="https://open.spotify.com/playlist/5gByD4m5I10mym8jNIDT6B?si=Q7LGoreZR7KHPHhs2zqiTQ"
              target="_blank"
              rel="noopener noreferrer"
              className={`group rounded-[2rem] p-8 ${glassClasses} flex flex-col items-center text-center gap-6 transition-all hover:-translate-y-2 duration-300 hover:shadow-2xl hover:shadow-[#460362]/5 md:col-span-2 lg:col-span-1`}
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-2 border-white shadow-md overflow-hidden ring-4 ring-[#460362]/5 group-hover:ring-[#460362]/10 transition-all">
                  <img src="equipe/seven.jpg" alt="Foto S7ven" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[#1DB954] p-1.5 rounded-full shadow-sm">
                  <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.54.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zM20.16 9.6C15.84 7.08 9.24 6.9 5.4 8.04c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.32-1.32 11.52-1.14 16.32 1.68.54.3 0.72 1.02.42 1.56-.3.54-1.02.66-1.5.42z" /></svg>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 group-hover:text-[#460362] transition-colors">S7ven</h3>
                <p className="text-sm text-neutral-500 font-medium">Produtor Musical</p>
              </div>
              <div className="w-full py-3 rounded-xl bg-[#460362]/5 text-[#460362] font-bold text-sm tracking-wide group-hover:bg-[#460362] group-hover:text-white transition-all flex items-center justify-center gap-2">
                Ouvir Portfólio
              </div>
            </a>
          </div>
        </section>

        {/* The Vision (Portfolios) */}
        <section id="vision" className="w-full max-w-6xl mb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-neutral-900 mb-4">The Vision</h2>
            <p className="text-neutral-500 max-w-lg mx-auto">Explore os mundos visuais que criamos. Uma vitrine de nossos melhores trabalhos de edição e design.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[250px]">
            {/* Masonry Layout Blocks */}
            <div className={`md:col-span-2 md:row-span-2 rounded-3xl p-3 ${glassClasses}`}>
              <div className="w-full h-full rounded-2xl bg-neutral-100/50 flex flex-col items-center justify-center text-neutral-400 group overflow-hidden relative">
                <div className="absolute inset-0 bg-neutral-200/50 flex items-center justify-center">
                  <span className="font-medium text-lg">Vídeo Reel (Em Breve)</span>
                </div>
              </div>
            </div>

            <div className={`rounded-3xl p-3 ${glassClasses}`}>
              <div className="w-full h-full rounded-2xl bg-neutral-100/50 flex items-center justify-center text-neutral-400">
                <span className="font-medium">Design Project</span>
              </div>
            </div>

            <div className={`rounded-3xl p-3 ${glassClasses}`}>
              <div className="w-full h-full rounded-2xl bg-neutral-100/50 flex items-center justify-center text-neutral-400">
                <span className="font-medium">Campaign</span>
              </div>
            </div>

            <div className={`rounded-3xl p-3 ${glassClasses}`}>
              <div className="w-full h-full rounded-2xl bg-neutral-100/50 flex items-center justify-center text-neutral-400">
                <span className="font-medium">VFX Breakdown</span>
              </div>
            </div>

            <div className={`md:col-span-2 rounded-3xl p-3 ${glassClasses}`}>
              <div className="w-full h-full rounded-2xl bg-neutral-100/50 flex items-center justify-center text-neutral-400">
                <span className="font-medium">Editorial Series</span>
              </div>
            </div>
          </div>
        </section>

        {/* Capture Funnel */}
        <section id="contact" className="w-full max-w-2xl mb-16">
          <div className={`rounded-[2rem] p-8 sm:p-12 ${glassClasses} relative overflow-hidden`}>
            {/* Glow Effect behind form */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#460362]/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10 text-center mb-10">
              <h2 className="text-3xl font-bold text-neutral-900 mb-3">Pronto para dar o próximo passo?</h2>
              <p className="text-neutral-500">Conte-nos sobre o seu projeto e retornaremos com uma proposta exclusiva.</p>
            </div>

            {formState === 'success' ? (
              <div className="relative z-10 text-center py-12">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-neutral-900 mb-2">Proposta Recebida!</h3>
                <p className="text-neutral-500">Entraremos em contato em breve pelo WhatsApp ou e-mail informado.</p>
                <button
                  onClick={() => setFormState('idle')}
                  className="mt-6 px-6 py-2 rounded-xl border border-[#460362]/30 text-[#460362] font-semibold text-sm hover:bg-[#460362]/5 transition-all"
                >
                  Enviar outro
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="relative z-10 flex flex-col gap-5" autoComplete="off">
                <div className="flex flex-col gap-5 sm:flex-row">
                  <div className="flex-1">
                    <label htmlFor="name" className="block text-sm font-semibold text-neutral-700 mb-1.5 ml-1">Nome</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="Seu nome completo"
                      required
                      disabled={formState === 'loading'}
                      className="w-full px-5 py-3.5 rounded-xl bg-transparent border border-neutral-200 hover:border-neutral-300 focus:border-[#460362] focus:ring-1 focus:ring-[#460362] outline-none transition-all duration-200 placeholder-neutral-400 text-neutral-900"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="email" className="block text-sm font-semibold text-neutral-700 mb-1.5 ml-1">E-mail</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="contato@empresa.com"
                      disabled={formState === 'loading'}
                      className="w-full px-5 py-3.5 rounded-xl bg-transparent border border-neutral-200 hover:border-neutral-300 focus:border-[#460362] focus:ring-1 focus:ring-[#460362] outline-none transition-all duration-200 placeholder-neutral-400 text-neutral-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="whatsapp" className="block text-sm font-semibold text-neutral-700 mb-1.5 ml-1">WhatsApp</label>
                  <input
                    type="text"
                    id="whatsapp"
                    name="whatsapp"
                    placeholder="(11) 99999-9999"
                    required
                    disabled={formState === 'loading'}
                    className="w-full px-5 py-3.5 rounded-xl bg-transparent border border-neutral-200 hover:border-neutral-300 focus:border-[#460362] focus:ring-1 focus:ring-[#460362] outline-none transition-all duration-200 placeholder-neutral-400 text-neutral-900"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-neutral-700 mb-1.5 ml-1">Mensagem</label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Nos conte um pouco sobre o que você precisa..."
                    disabled={formState === 'loading'}
                    className="w-full px-5 py-3.5 rounded-xl bg-transparent border border-neutral-200 hover:border-neutral-300 focus:border-[#460362] focus:ring-1 focus:ring-[#460362] outline-none transition-all duration-200 placeholder-neutral-400 text-neutral-900 resize-none"
                  />
                </div>

                {formState === 'error' && (
                  <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                    ⚠️ {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={formState === 'loading'}
                  className="w-full mt-4 py-4 rounded-xl bg-[#460362] text-white font-bold text-lg hover:bg-purple-900 transition-all shadow-xl shadow-[#460362]/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {formState === 'loading' ? 'Enviando...' : 'Solicitar Proposta'}
                </button>
              </form>
            )}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200/50 py-8 text-center text-neutral-400 text-sm">
        <p>&copy; {new Date().getFullYear()} Our Dreams Studio. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
