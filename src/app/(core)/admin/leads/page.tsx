'use client';

import { useState, useEffect, useTransition } from 'react';
import { Inbox, Mail, MailOpen, Trash2, Phone, MessageSquare, Loader2, RefreshCw, UserPlus } from 'lucide-react';
import { getLeads, marcarLeadComoLido, deleteLead } from '@/actions/leadsActions';
import { handleSupabaseError, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await getLeads();
      setLeads(data || []);
    } catch (e: any) {
      alert('Erro ao carregar leads: ' + handleSupabaseError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();

    // Realtime: escuta novos leads
    const channel = supabase
      .channel('realtime-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newLead = payload.new;
          setLeads((prev) => {
            if (prev.some((l) => l.id === newLead.id)) return prev;
            return [newLead, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new;
          setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old;
          setLeads((prev) => prev.filter((l) => l.id !== old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleMarcarLido = (id: string) => {
    startTransition(async () => {
      try {
        await marcarLeadComoLido(id);
        setLeads(prev => prev.map(l => l.id === id ? { ...l, lido: true } : l));
      } catch (e: any) {
        alert('Erro: ' + handleSupabaseError(e));
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este lead permanentemente?')) return;
    startTransition(async () => {
      try {
        await deleteLead(id);
        setLeads(prev => prev.filter(l => l.id !== id));
      } catch (e: any) {
        alert('Erro: ' + handleSupabaseError(e));
      }
    });
  };

  const naoLidos = leads.filter(l => !l.lido).length;

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 40px)', maxWidth: 1000, margin: '0 auto' }} className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Inbox className="text-accent" />
            Caixa de <span className="gradient-text">Leads</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Formulários preenchidos na landing page
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {naoLidos > 0 && (
            <div style={{
              padding: '6px 14px', borderRadius: 20,
              background: 'rgba(124,58,237,0.15)', border: '1px solid var(--accent)',
              color: 'var(--accent-light)', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <Mail size={14} />
              {naoLidos} não {naoLidos === 1 ? 'lido' : 'lidos'}
            </div>
          )}
          <button
            onClick={fetchLeads}
            disabled={loading || isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              opacity: (loading || isPending) ? 0.6 : 1
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="animate-spin text-accent" size={36} />
        </div>
      ) : leads.length === 0 ? (
        <div className="glass" style={{ padding: 'clamp(40px, 8vw, 80px) clamp(20px, 4vw, 40px)', borderRadius: 20, textAlign: 'center' }}>
          <Inbox size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Nenhum lead ainda
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Quando alguém preencher o formulário da landing page, os dados aparecem aqui.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {leads.map((lead) => {
            const tempColors: any = {
              'Hot': { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
              'Warm': { bg: 'rgba(249,115,22,0.15)', text: '#f97316', border: 'rgba(249,115,22,0.3)' },
              'Cold': { bg: 'rgba(56,189,248,0.15)', text: '#38bdf8', border: 'rgba(56,189,248,0.3)' },
            };
            const tColor = lead.temperature ? tempColors[lead.temperature] : null;

            return (
            <div
              key={lead.id}
              className="glass"
              style={{
                padding: 'clamp(16px, 3vw, 20px) clamp(16px, 3vw, 24px)', borderRadius: 16,
                border: `1px solid ${lead.lido ? 'var(--border)' : (tColor ? tColor.border : 'rgba(124,58,237,0.4)')}`,
                boxShadow: lead.lido ? 'none' : (tColor ? `0 0 20px ${tColor.bg}` : '0 0 20px rgba(124,58,237,0.08)'),
                opacity: lead.lido ? 0.7 : 1,
                transition: '0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                {/* Lead info */}
                <div style={{ flex: '1 1 250px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: lead.lido ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: lead.lido ? 'var(--text-muted)' : 'var(--accent-light)',
                    }}>
                      <UserPlus size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {lead.nome}
                        {!lead.lido && (
                          <span style={{
                            fontSize: 10, fontWeight: 800,
                            background: 'var(--accent)', color: '#fff',
                            padding: '2px 7px', borderRadius: 6, verticalAlign: 'middle'
                          }}>NOVO</span>
                        )}
                        {lead.temperature && (
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            background: tColor.bg, color: tColor.text, border: `1px solid ${tColor.border}`,
                            padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center'
                          }}>
                            {lead.temperature.toUpperCase()} • {lead.score} PTS
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {formatDate(lead.created_at)} às {new Date(lead.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: lead.mensagem ? 12 : 0 }}>
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent-light)', textDecoration: 'none' }}>
                        <Mail size={14} /> {lead.email}
                      </a>
                    )}
                    {lead.whatsapp && (
                      <a
                        href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#22c55e', textDecoration: 'none' }}
                      >
                        <Phone size={14} /> {lead.whatsapp}
                      </a>
                    )}
                  </div>

                  {lead.mensagem && (
                    <div style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '10px 14px',
                      fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                      display: 'flex', gap: 8, alignItems: 'flex-start'
                    }}>
                      <MessageSquare size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                      <span>"{lead.mensagem}"</span>
                    </div>
                  )}

                  {lead.diagnostic_data && (
                    <div style={{
                      marginTop: 12, padding: '12px 14px', borderRadius: 10,
                      background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)',
                      fontSize: 12, color: 'var(--text-muted)'
                    }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MessageSquare size={14} />
                        Diagnóstico Inicial do Bot:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                        <div><strong style={{color: 'var(--text-primary)'}}>Q1 (Arquivos):</strong> Opção {lead.diagnostic_data.q1}</div>
                        <div><strong style={{color: 'var(--text-primary)'}}>Q2 (Experiência):</strong> Opção {lead.diagnostic_data.q2}</div>
                        <div><strong style={{color: 'var(--text-primary)'}}>Q3 (Serviços):</strong> Opção {lead.diagnostic_data.q3}</div>
                        <div><strong style={{color: 'var(--text-primary)'}}>Q4 (Orçamento):</strong> Opção {lead.diagnostic_data.q4}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                  {!lead.lido && (
                    <button
                      onClick={() => handleMarcarLido(lead.id)}
                      disabled={isPending}
                      title="Marcar como lido"
                      style={{
                        background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                        color: 'var(--accent-light)', padding: '8px 12px', borderRadius: 8,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 12, fontWeight: 600, opacity: isPending ? 0.5 : 1
                      }}
                    >
                      <MailOpen size={14} /> Marcar lido
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(lead.id)}
                    disabled={isPending}
                    title="Excluir lead"
                    style={{
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                      color: '#ef4444', padding: '8px 12px', borderRadius: 8,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 600, opacity: isPending ? 0.5 : 1
                    }}
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
