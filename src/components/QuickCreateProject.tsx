'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Search, UserCheck, UserPlus, Music2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface ClienteSuggestion {
  id: string;
  nome_artistico: string | null;
  nome_pessoal: string | null;
  telefone: string | null;
}

export function QuickCreateProject() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const [clienteMode, setClienteMode] = useState<'search' | 'new'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ClienteSuggestion[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<ClienteSuggestion | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [newClienteData, setNewClienteData] = useState({
    nome_artistico: '',
    nome_pessoal: '',
    telefone: '',
  });

  const [servicos, setServicos] = useState([{ nome: '', valor: 0 }]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!searchQuery.trim() || clienteMode !== 'search') { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome_artistico, nome_pessoal, telefone')
        .or(`nome_artistico.ilike.%${searchQuery}%,nome_pessoal.ilike.%${searchQuery}%,telefone.ilike.%${searchQuery}%`)
        .limit(6);
      setSuggestions(data || []);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, clienteMode]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddServico = () => setServicos(prev => [...prev, { nome: '', valor: 0 }]);

  const handleServicoChange = (index: number, field: 'nome' | 'valor', value: string | number) => {
    const updated = [...servicos];
    updated[index] = { ...updated[index], [field]: value };
    setServicos(updated);
  };

  const handleRemoveServico = (index: number) =>
    setServicos(prev => prev.filter((_, i) => i !== index));

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
    setSelectedCliente(null);
    setClienteMode('search');
    setNewClienteData({ nome_artistico: '', nome_pessoal: '', telefone: '' });
    setServicos([{ nome: '', valor: 0 }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let clienteId: string;
      if (clienteMode === 'search') {
        if (!selectedCliente) throw new Error('Selecione um cliente ou cadastre um novo.');
        clienteId = selectedCliente.id;
      } else {
        const { data: newCliente, error: clienteError } = await supabase
          .from('clientes')
          .insert([{ nome_artistico: newClienteData.nome_artistico, nome_pessoal: newClienteData.nome_pessoal, telefone: newClienteData.telefone, status_funil: 'Fechado', data_entrada: new Date().toISOString() }])
          .select('id').single();
        if (clienteError) throw clienteError;
        clienteId = newCliente.id;
      }
      const valorTotal = servicos.reduce((acc, s) => acc + Number(s.valor), 0);
      const servicosNomes = servicos.map(s => s.nome).join(', ');
      const { data: newProjeto, error: projetoError } = await supabase
        .from('projetos')
        .insert([{ cliente_id: clienteId, status_funil: 'Fechado', valor_fechado: valorTotal, servicos_fechados: servicosNomes, tipo_servico: servicosNomes, status_producao: 'Definição de Escopo', created_at: new Date().toISOString() }])
        .select('id').single();
      if (projetoError) throw projetoError;
      const entregaveis = servicos.map(s => ({ projeto_id: newProjeto.id, nome_servico: s.nome, valor: Number(s.valor), status_producao: 'Definição de Escopo' }));
      const { error: entregaveisError } = await supabase.from('projeto_entregaveis').insert(entregaveis);
      if (entregaveisError) throw entregaveisError;
      handleClose();
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao criar projeto: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    background: 'var(--bg-base)', border: '1px solid var(--border)',
    color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6,
    display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  const totalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(servicos.reduce((acc, s) => acc + Number(s.valor), 0));

  const modal = isOpen ? (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, padding: '16px',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 20, width: '100%', maxWidth: 540,
        maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '24px 28px 20px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 10,
          borderRadius: '20px 20px 0 0',
        }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Criar Novo Orçamento</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Cada orçamento é um projeto independente — mesmo para clientes recorrentes.
            </p>
          </div>
          <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Toggle modo */}
          <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--bg-base)', borderRadius: 10 }}>
            {([
              { mode: 'search' as const, icon: <UserCheck size={13} />, label: 'Cliente Existente' },
              { mode: 'new' as const, icon: <UserPlus size={13} />, label: 'Novo Cliente' },
            ]).map(({ mode, icon, label }) => (
              <button key={mode} type="button"
                onClick={() => { setClienteMode(mode); setSelectedCliente(null); setSearchQuery(''); }}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s', background: clienteMode === mode ? 'var(--bg-surface)' : 'transparent', color: clienteMode === mode ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: clienteMode === mode ? '0 2px 8px rgba(0,0,0,0.3)' : 'none' }}>
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Busca de cliente existente */}
          {clienteMode === 'search' && (
            <div ref={searchRef} style={{ position: 'relative' }}>
              <label style={labelStyle}>Buscar Cliente</label>
              {selectedCliente ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.4)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedCliente.nome_artistico}</div>
                    {selectedCliente.nome_pessoal && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{selectedCliente.nome_pessoal}{selectedCliente.telefone && ` · ${selectedCliente.telefone}`}</div>}
                  </div>
                  <button type="button" onClick={() => { setSelectedCliente(null); setSearchQuery(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input type="text" placeholder="Nome artístico, real ou telefone..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }} onFocus={() => searchQuery && setShowDropdown(true)} style={{ ...inputStyle, paddingLeft: 36 }} />
                  </div>
                  {showDropdown && suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, zIndex: 100, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                      {suggestions.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setSelectedCliente(c); setSearchQuery(''); setShowDropdown(false); }}
                          style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{c.nome_artistico}</span>
                          {c.nome_pessoal && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.nome_pessoal}{c.telefone && ` · ${c.telefone}`}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {showDropdown && searchQuery && suggestions.length === 0 && (
                    <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', paddingLeft: 2 }}>
                      Nenhum cliente encontrado.{' '}
                      <button type="button" onClick={() => setClienteMode('new')} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontWeight: 700, padding: 0 }}>Cadastrar novo?</button>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Novo cliente */}
          {clienteMode === 'new' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome Artístico *</label>
                <input required type="text" value={newClienteData.nome_artistico} onChange={e => setNewClienteData({ ...newClienteData, nome_artistico: e.target.value })} style={inputStyle} placeholder="Ex: MC Fulano" />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={labelStyle}>Nome Pessoal</label>
                  <input type="text" value={newClienteData.nome_pessoal} onChange={e => setNewClienteData({ ...newClienteData, nome_pessoal: e.target.value })} style={inputStyle} placeholder="Nome completo" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={labelStyle}>Telefone / WhatsApp</label>
                  <input type="text" value={newClienteData.telefone} onChange={e => setNewClienteData({ ...newClienteData, telefone: e.target.value })} style={inputStyle} placeholder="(11) 99999-9999" />
                </div>
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)' }} />

          {/* Entregaveis */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Entregáveis</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cada item é rastreado individualmente no Kanban</p>
              </div>
              <button type="button" onClick={handleAddServico} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(124,58,237,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(124,58,237,0.3)', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
                <Plus size={13} /> Adicionar
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {servicos.map((servico, index) => (
                <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <Music2 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input required type="text" value={servico.nome} onChange={e => handleServicoChange(index, 'nome', e.target.value)} placeholder="Ex: Mixagem Música X..." style={{ ...inputStyle, flex: 2, padding: '7px 10px', minWidth: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>R$</span>
                    <input type="number" min="0" step="0.01" value={servico.valor} onChange={e => handleServicoChange(index, 'valor', e.target.value)} style={{ ...inputStyle, width: 90, padding: '7px 8px', textAlign: 'right' }} />
                  </div>
                  {servicos.length > 1 && (
                    <button type="button" onClick={() => handleRemoveServico(index)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              Total: <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>{totalFormatado}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={handleClose} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: '11px', borderRadius: 10, background: loading ? 'rgba(124,58,237,0.4)' : 'var(--accent)', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, boxShadow: loading ? 'none' : '0 0 20px var(--accent-glow)', transition: 'all 0.2s' }}>
              {loading ? 'Criando...' : 'Salvar Orçamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 14px var(--accent-glow)', transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        <Plus size={16} /> Novo Orçamento
      </button>
      {mounted && createPortal(modal, document.body)}
    </>
  );
}
