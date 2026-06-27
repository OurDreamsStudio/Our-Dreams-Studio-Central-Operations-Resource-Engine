'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, ShieldAlert, Edit3, Trash2, Calendar, DollarSign, 
  Link as LinkIcon, CheckCircle, Clock, Check, X, Undo2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ETAPAS_PRODUCAO, getStatusTheme } from '@/constants/workflow';
import { saveProjeto, deleteProjeto, desfazerEntregaProjeto } from '@/actions/databaseActions';

export default function ProjetosManagerClient({ inicialProjetos }: { inicialProjetos: any[] }) {
  const router = useRouter();
  const [projetos, setProjetos] = useState(inicialProjetos);
  const [search, setSearch] = useState('');
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Filtragem
  const filteredProjetos = projetos.filter(p => {
    const artistico = p.clientes?.nome_artistico?.toLowerCase() || '';
    const pessoal = p.clientes?.nome_pessoal?.toLowerCase() || '';
    const nomeProj = p.nome?.toLowerCase() || '';
    const servicos = p.servicos_fechados?.toLowerCase() || '';
    const term = search.toLowerCase();
    return artistico.includes(term) || pessoal.includes(term) || nomeProj.includes(term) || servicos.includes(term);
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este projeto permanentemente? Essa ação não pode ser desfeita.')) return;
    try {
      setLoadingId(id);
      await deleteProjeto(id);
      setProjetos(prev => prev.filter(p => p.id !== id));
      router.refresh();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleOpenEdit = (proj: any) => {
    setEditingProject({
      ...proj,
      prazo_entrega: proj.prazo_entrega ? proj.prazo_entrega.substring(0, 10) : ''
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    try {
      setLoadingId(editingProject.id);
      
      const payload = {
        cliente_id: editingProject.cliente_id,
        nome: editingProject.nome,
        tipo_servico: editingProject.tipo_servico,
        status_funil: editingProject.status_funil || 'Fechado',
        valor_fechado: editingProject.valor_fechado,
        status_producao: editingProject.status_producao,
        prazo_entrega: editingProject.prazo_entrega || null,
        link_arquivos: editingProject.link_arquivos || null,
        servicos_fechados: editingProject.servicos_fechados,
        sinal_pago: editingProject.sinal_pago,
        entrega_paga: editingProject.entrega_paga,
        // Preserva link_tipo_pagamento para não quebrar o webhook de pagamento
        link_tipo_pagamento: editingProject.link_tipo_pagamento || null,
      };

      await saveProjeto(editingProject.id, payload);
      
      // Atualizar localmente
      setProjetos(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...payload } : p));
      setEditingProject(null);
      router.refresh();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Busca */}
      <div style={{ display: 'flex', gap: 12, maxWidth: 400, position: 'relative' }}>
        <input
          type="text"
          placeholder="Buscar por cliente, projeto ou serviço..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '12px 16px 12px 42px', borderRadius: 8,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: '#fff', outline: 'none', fontSize: 14
          }}
        />
        <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      </div>

      {/* Listagem */}
      <div className="glass" style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '16px', fontSize: 12, color: 'var(--text-secondary)' }}>Cliente / Projeto</th>
              <th style={{ padding: '16px', fontSize: 12, color: 'var(--text-secondary)' }}>Etapa Produção</th>
              <th style={{ padding: '16px', fontSize: 12, color: 'var(--text-secondary)' }}>Aprovação Cliente</th>
              <th style={{ padding: '16px', fontSize: 12, color: 'var(--text-secondary)' }}>Financeiro</th>
              <th style={{ padding: '16px', fontSize: 12, color: 'var(--text-secondary)' }}>Previsão</th>
              <th style={{ padding: '16px', fontSize: 12, color: 'var(--text-secondary)' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjetos.map((proj: any) => {
              const artistico = proj.clientes?.nome_artistico || proj.clientes?.nome_pessoal || 'Desconhecido';
              const theme = getStatusTheme(proj.status_producao);
              return (
                <tr key={proj.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover:bg-white/[0.01]">
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{artistico}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{proj.nome || proj.servicos_fechados || proj.tipo_servico}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {proj.status_producao ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                        background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`
                      }}>
                        {proj.status_producao}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Funil de Vendas</span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {proj.cliente_aprovado ? (
                      <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={14} /> Aprovado pelo Cliente
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={14} /> Pendente
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Sinal: {proj.sinal_pago ? <span style={{ color: '#4ade80', fontWeight: 600 }}>Pago</span> : <span>Pendente</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Entrega: {proj.entrega_paga ? <span style={{ color: '#4ade80', fontWeight: 600 }}>Pago</span> : <span>Pendente</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {proj.prazo_entrega ? new Date(proj.prazo_entrega).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem Prazo'}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleOpenEdit(proj)}
                        style={{
                          background: 'rgba(124,58,237,0.1)', color: 'var(--accent-light)',
                          border: '1px solid rgba(124,58,237,0.2)', padding: '6px 10px',
                          borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <Edit3 size={13} /> Editar
                      </button>
                      <button
                        onClick={() => handleDelete(proj.id)}
                        disabled={loadingId === proj.id}
                        style={{
                          background: 'rgba(239,68,68,0.1)', color: '#f87171',
                          border: '1px solid rgba(239,68,68,0.2)', padding: '6px 10px',
                          borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <Trash2 size={13} /> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Edição */}
      {editingProject && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '500px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Editar Projeto</h2>
              <button 
                onClick={() => setEditingProject(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nome do Projeto</label>
                <input
                  type="text"
                  value={editingProject.nome || ''}
                  onChange={e => setEditingProject({...editingProject, nome: e.target.value})}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: '#fff', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Etapa de Produção</label>
                  <select
                    value={editingProject.status_producao || ''}
                    onChange={e => setEditingProject({...editingProject, status_producao: e.target.value || null})}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      background: 'var(--bg-base)', border: '1px solid var(--border)',
                      color: '#fff', outline: 'none'
                    }}
                  >
                    <option value="">(Nenhuma / Fora da Produção)</option>
                    {ETAPAS_PRODUCAO.map(etapa => (
                      <option key={etapa} value={etapa}>{etapa}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Prazo Entrega</label>
                  <input
                    type="date"
                    value={editingProject.prazo_entrega || ''}
                    onChange={e => setEditingProject({...editingProject, prazo_entrega: e.target.value})}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      background: 'var(--bg-base)', border: '1px solid var(--border)',
                      color: '#fff', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Link de Entregáveis</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={editingProject.link_arquivos || ''}
                  onChange={e => setEditingProject({...editingProject, link_arquivos: e.target.value})}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: '#fff', outline: 'none'
                  }}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Status e Pagamentos</h3>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingProject.sinal_pago}
                    onChange={e => setEditingProject({...editingProject, sinal_pago: e.target.checked})}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: 13 }}>Sinal Pago (50% Inicial)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingProject.entrega_paga}
                    onChange={e => setEditingProject({...editingProject, entrega_paga: e.target.checked})}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: 13 }}>Entrega Paga (50% Final)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingProject.cliente_aprovado}
                    onChange={e => setEditingProject({...editingProject, cliente_aprovado: e.target.checked})}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: 13 }}>Aprovado pelo Cliente</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8,
                    background: 'var(--bg-base)', color: 'var(--text-primary)', fontWeight: 600,
                    border: '1px solid var(--border)', cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8,
                    background: 'var(--accent)', color: '#fff', fontWeight: 700,
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
