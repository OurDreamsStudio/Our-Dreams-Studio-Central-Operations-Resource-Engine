'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const BADGE_MAP: Record<string, string> = {
  Prospectado:            'badge-prospectado',
  'Diagnóstico Pendente': 'badge-diagnostico',
  'Orçamento Enviado':    'badge-orcamento',
  Fechado:                'badge-fechado',
  Perdido:                'badge-perdido',
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [n8nEstados, setN8nEstados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [ cRes, pRes, nRes ] = await Promise.all([
          supabase.from('clientes').select('*').order('nome_artistico', { ascending: true }),
          supabase.from('projetos').select('*'),
          supabase.from('n8n_estado').select('*')
        ]);

        if (cRes.error) throw cRes.error;
        if (pRes.error) throw pRes.error;
        if (nRes.error) throw nRes.error;

        setClientes(cRes.data || []);
        setProjetos(pRes.data || []);
        setN8nEstados(nRes.data || []);
      } catch (err: any) {
        console.error('Erro ao buscar dados:', err);
        setError(err.message || 'Erro desconhecido ao carregar clientes');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Carregando clientes...</div>;

  if (error) {
    return (
      <div style={{ padding: '32px 36px', maxWidth: 1100 }} className="fade-up">
        <div style={{ padding: 24, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 16 }}>
          <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
            Erro de Carregamento
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }} className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
          <span className="gradient-text">Clientes</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Todos os artistas cadastrados no CRM
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
        {clientes.map((c) => {
          const clientProjs = projetos.filter((p) => p.cliente_id === c.id);
          const n8n = n8nEstados.find((n) => n.cliente_id === c.id);
          const lastProj = clientProjs[clientProjs.length - 1];
          const displayName = c.nome_artistico || c.nome_pessoal || 'N/A';
          const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
          
          return (
            <Link key={c.id} href={`/clientes/${c.id}`} style={{ textDecoration: 'none' }}>
              <div className="glass glass-hover" style={{ padding: '20px 20px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #7c3aed, #c084fc)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 16, color: '#fff',
                  }}>
                    {initials}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {displayName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {c.instagram || c.email}
                    </div>
                  </div>
                </div>
                {lastProj && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lastProj.tipo_servico || 'Não informado'}
                    </span>
                    <span className={`badge ${BADGE_MAP[lastProj.status_funil] ?? ''}`}>
                      {lastProj.status_funil}
                    </span>
                  </div>
                )}
                {n8n && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    🤖 {n8n.status_fluxo}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
        {clientes.length === 0 && (
          <div style={{ color: 'var(--text-muted)' }}>Nenhum cliente encontrado.</div>
        )}
      </div>
    </div>
  );
}
