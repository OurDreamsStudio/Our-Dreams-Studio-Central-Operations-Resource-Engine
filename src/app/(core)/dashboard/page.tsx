import Link from 'next/link';
import { Users, TrendingUp, Briefcase, DollarSign, Activity, FileText, Clock } from 'lucide-react';
import { supabaseServer } from '@/lib/supabaseServer';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let clientes: any[] = [];
  let projetos: any[] = [];
  let error: string | null = null;

  try {
    await requireAuth();
    const [ cRes, pRes ] = await Promise.all([
      supabaseServer.from('clientes').select('*').order('data_entrada', { ascending: false }),
      supabaseServer.from('projetos').select('*, clientes(nome_artistico, nome_pessoal)')
    ]);

    if (cRes.error) throw cRes.error;
    if (pRes.error) throw pRes.error;

    clientes = cRes.data || [];
    projetos = pRes.data || [];
  } catch (err: any) {
    console.error('Erro ao buscar dados:', err);
    error = err.message || 'Erro desconhecido ao carregar dashboard';
  }

  const receitaTotal = () => projetos
    .filter((p) => p.valor_fechado)
    .reduce((acc, p) => acc + Number(p.valor_fechado || 0), 0);

  const aReceber = () => projetos
    .filter((p) => p.valor_fechado && p.sinal_pago && p.status_producao !== 'Entregue' && p.status_producao !== 'Cancelado')
    .reduce((acc, p) => acc + (Number(p.valor_fechado) / 2), 0);

  const emProducao = () => projetos
    .filter((p) => p.status_producao && p.status_producao !== 'Entregue' && p.status_producao !== 'Cancelado')
    .length;

  const leadsAtivos = () => projetos
    .filter((p) => p.status_funil && p.status_funil !== 'Fechado' && p.status_funil !== 'Perdido')
    .length;

  const stats = [
    { label: 'Receita Total', value: `R$ ${receitaTotal().toLocaleString('pt-BR')}`, sub: `Valor bruto (all time)`, color: '#22c55e', icon: <DollarSign size={16} /> },
    { label: 'A Receber',     value: `R$ ${aReceber().toLocaleString('pt-BR')}`,     sub: '2ª parcela pendente', color: '#eab308', icon: <Activity size={16} /> },
    { label: 'Em Produção',   value: emProducao(),                                   sub: 'Projetos ativos no estúdio', color: '#3b82f6', icon: <Briefcase size={16} /> },
    { label: 'Leads Ativos',  value: leadsAtivos(),                                  sub: 'Negociações no CRM', color: '#9d61ff', icon: <Users size={16} /> },
  ];

  const revenueByService: Record<string, number> = {};
  projetos.filter(p => p.valor_fechado && p.servicos_fechados).forEach(p => {
    const servs = p.servicos_fechados.split(',').map((s: string) => s.trim()).filter(Boolean);
    
    if (p.valores_servicos && typeof p.valores_servicos === 'object') {
      Object.entries(p.valores_servicos).forEach(([s, v]) => {
        revenueByService[s] = (revenueByService[s] || 0) + Number(v);
      });
    } else {
      const val = Number(p.valor_fechado) / (servs.length || 1);
      servs.forEach((s: string) => {
        revenueByService[s] = (revenueByService[s] || 0) + val;
      });
    }
  });
  
  const chartData = Object.entries(revenueByService).map(([label, val]) => ({ label, val })).sort((a,b) => b.val - a.val);
  const maxChartVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.val)) : 1;

  const proximosPrazos = projetos
    .filter(p => p.prazo_entrega && p.status_producao && p.status_producao !== 'Entregue' && p.status_producao !== 'Cancelado')
    .sort((a, b) => new Date(a.prazo_entrega).getTime() - new Date(b.prazo_entrega).getTime())
    .slice(0, 3);

  if (error) {
    return (
      <div style={{ padding: 'var(--page-padding-y, 32px) var(--page-padding-x, 36px)', maxWidth: 1200 }} className="fade-up">
        <div style={{ padding: 24, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 16 }}>
          <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={20} />
            Erro ao carregar dashboard
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--page-padding-y, 32px) var(--page-padding-x, 36px)', maxWidth: 1200 }} className="fade-up">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
          <span className="gradient-text">Dashboard</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Visão geral do funil de clientes • Our Dreams Studio
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 24 }} className="stats-grid">
        {stats.map((s) => (
          <div
            key={s.label}
            className="glass glass-hover"
            style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {s.label}
              </div>
              <div style={{ color: s.color, opacity: 0.8 }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: 'clamp(20px, 4vw, 32px)', fontWeight: 800, color: s.color, lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, marginBottom: 24 }} className="dashboard-grid">
        {/* Receita por Serviço Bar Chart */}
        <div className="glass" style={{ padding: '24px 26px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Distribuição de Receita por Serviço
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {chartData.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>Nenhuma receita registrada.</div>
            ) : chartData.map((d, i) => {
              const colors = ['#7c3aed', '#ec4899', '#3b82f6', '#22c55e', '#eab308'];
              const c = colors[i % colors.length];
              return (
                <div key={d.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                    <span style={{ fontWeight: 600, color: c }}>
                      R$ {d.val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(d.val / maxChartVal) * 100}%`,
                        background: c,
                        borderRadius: 4,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Widget de Urgência - Próximos Prazos */}
        <div className="glass" style={{ padding: '24px 26px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: 'var(--text-primary)' }}>
            Próximos 3 Prazos de Entrega
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {proximosPrazos.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>Nenhum prazo urgente.</div>
            ) : proximosPrazos.map((p, i) => {
              const date = new Date(p.prazo_entrega);
              const today = new Date();
              today.setHours(0,0,0,0);
              const isLate = date <= today;
                const color = isLate ? '#ef4444' : '#eab308';
                const cliente = p.clientes;
                const title = cliente?.nome_artistico || cliente?.nome_pessoal || 'Projeto sem Cliente';
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: `${color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0, color
                  }}>
                    <Clock size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{title}</div>
                    <div style={{ fontSize: 11, color: color, marginTop: 2, fontWeight: 500 }}>
                      {date.toLocaleDateString('pt-BR')} {isLate ? '(Urgente)' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="glass" style={{ padding: '24px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Clientes Recentes</h2>
          <Link href="/clientes">
            <button style={{
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 0 14px var(--accent-glow)',
            }}>
              Ver Todos →
            </button>
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Artista', 'Nome Pessoal', 'Instagram', 'Entrada'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '0 12px 12px 0', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.slice(0, 6).map((c) => {
                return (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    className="hover:bg-[rgba(124,58,237,0.06)]"
                  >
                    <td style={{ padding: '12px 12px 12px 0' }}>
                      <Link href={`/clientes/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'linear-gradient(135deg,#7c3aed,#c084fc)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                          }}>
                            {(c.nome_artistico || c.nome_pessoal || '?').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.nome_artistico || 'N/A'}</span>
                        </div>
                      </Link>
                    </td>
                    <td style={{ padding: '12px 12px 12px 0', color: 'var(--text-secondary)' }}>{c.nome_pessoal || 'N/A'}</td>
                    <td style={{ padding: '12px 12px 12px 0', color: '#9d61ff' }}>{c.instagram}</td>
                    <td style={{ padding: '12px 12px 12px 0', color: 'var(--text-muted)' }}>
                      {new Date(c.data_entrada).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum cliente cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
