'use client';

import { useState, useEffect, useTransition } from 'react';
import { 
  ArrowLeft, 
  ExternalLink, 
  Layers, 
  Users, 
  DollarSign, 
  History, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileCode,
  Link as LinkIcon,
  Loader2,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getProjetoCompleto } from '@/actions/databaseActions';
import { Projeto, Cliente, Terceirizado, TarefaTerceirizado, Notificacao } from '@/types';
import { handleSupabaseError } from '@/lib/utils';

export default function WarRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projeto, setProjeto] = useState<any>(null);

  const fetchData = async () => {
    try {
      const data = await getProjetoCompleto(id as string);
      setProjeto(data);
    } catch (e: any) {
      alert('Erro ao carregar dossiê: ' + handleSupabaseError(e));
      router.push('/admin/agenda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (loading || !projeto) {
    return (
      <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  // Calculate Studio Profit
  const totalSplits = projeto.tarefas_terceirizados?.reduce((acc: number, t: any) => acc + Number(t.valor_combinado || 0), 0) || 0;
  const lucroEstudio = Number(projeto.valor_fechado || 0) - totalSplits;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }} className="fade-up">
      {/* Back & Title */}
      <div style={{ marginBottom: 40 }}>
        <button 
          onClick={() => router.back()} 
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 20, fontSize: 13, fontWeight: 600 }}
        >
          <ArrowLeft size={16} /> Voltar para Agenda
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Dossiê Operacional do Projeto
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 800 }}>{projeto.nome || projeto.servicos_fechados || projeto.tipo_servico || 'Sem Nome'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} /> Cliente: <strong>{projeto.clientes?.nome_artistico || projeto.clientes?.nome_pessoal}</strong>
              </span>
              <span style={{ height: 4, width: 4, borderRadius: '50%', background: 'var(--border)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Status: <strong>{projeto.status_producao || 'Pendente'}</strong></span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
             <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Prazo de Entrega</div>
             <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
               {new Date(projeto.prazo_entrega).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
             </div>
          </div>
        </div>
      </div>

      {/* War Room Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32 }}>
        
        {/* Left Column: Dossier Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* Section: Produção & Assets */}
          <div className="glass" style={{ padding: 24, borderRadius: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={20} className="text-accent" /> Produção & Assets
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>Asset Vault (Link de Ouro)</div>
                {projeto.link_entrega_final ? (
                   <a href={projeto.link_entrega_final} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>
                     <FileCode size={18} /> Abrir Pasta de Master <ExternalLink size={14} />
                   </a>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum link de entrega final cadastrado.</div>
                )}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20 }}>
                 <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>Portal do Cliente</div>
                 <Link href={`/p/${projeto.public_token}`} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
                    <LinkIcon size={18} /> Abrir Visualização Pública <ExternalLink size={14} />
                 </Link>
              </div>
            </div>
          </div>

          {/* Section: Parceiros (Terceirizados) */}
          <div className="glass" style={{ padding: 24, borderRadius: 20 }}>
             <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
               <Users size={20} className="text-accent" /> Time de Terceiros Alocados
             </h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {projeto.tarefas_terceirizados?.length > 0 ? projeto.tarefas_terceirizados.map((t: any) => (
                  <div key={t.id} style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.terceirizados?.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Tarefa: {t.descricao_tarefa}</div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 20 }}>
                       <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>STATUS ROADMAP</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.status_entrega === 'Entregue' ? 'var(--green)' : 'var(--accent-light)' }}>
                            {t.status_etapa_atual || t.status_entrega}
                          </div>
                       </div>
                       <Link href={`/t/${t.public_token}`} target="_blank" className="icon-btn-small" title="Abrir Portal do Parceiro">
                         <ExternalLink size={16} />
                       </Link>
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                    Nenhum terceiro alocado para este projeto.
                  </div>
                )}
             </div>
          </div>

          {/* Section: Activity Feed (Log) */}
          <div className="glass" style={{ padding: 24, borderRadius: 20 }}>
             <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
               <History size={20} className="text-accent" /> Log de Atividades & Feedback
             </h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {projeto.data_aprovacao && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ color: 'var(--green)', marginTop: 3 }}><CheckCircle2 size={16} /></div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Aprovado pelo Cliente</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(projeto.data_aprovacao).toLocaleString()}</div>
                    </div>
                  </div>
                )}
                {/* Histórico Dinâmico de Revisões */}
                 {projeto.historico_revisoes && projeto.historico_revisoes.length > 0 ? (
                   projeto.historico_revisoes.map((rev: any, idx: number) => (
                     <div key={idx} style={{ display: 'flex', gap: 12 }}>
                        <div style={{ color: '#f59e0b', marginTop: 3 }}><Clock size={16} /></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Solicitação de Revisão #{idx + 1}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(rev.data).toLocaleString()}</div>
                          </div>
                          <div style={{ 
                            fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', 
                            padding: '10px 14px', borderRadius: 10, marginTop: 6, border: '1px solid var(--border)',
                            lineHeight: 1.5
                          }}>
                            "{rev.motivo}"
                          </div>
                        </div>
                     </div>
                   ))
                 ) : !projeto.data_aprovacao && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhuma atividade registrada no portal do cliente ainda.</div>
                 )}

                 {/* Fallback para motivo_revisao legado (se não houver histórico) */}
                 {projeto.motivo_revisao && (!projeto.historico_revisoes || projeto.historico_revisoes.length === 0) && (
                    <div style={{ display: 'flex', gap: 12 }}>
                     <div style={{ color: '#f59e0b', marginTop: 3 }}><Clock size={16} /></div>
                     <div>
                       <div style={{ fontSize: 13, fontWeight: 700 }}>Pedido de Revisão (Legado)</div>
                       <div style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '8px 12px', borderRadius: 8, marginTop: 6, border: '1px solid rgba(245,158,11,0.2)' }}>
                         "{projeto.motivo_revisao}"
                       </div>
                     </div>
                   </div>
                 )}
             </div>
          </div>
        </div>

        {/* Right Column: Financial Intelligence (Admin Only) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
           <div className="glass" style={{ padding: 24, borderRadius: 20, border: '1px solid var(--accent)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                 <DollarSign size={14} /> Resumo Financeiro
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>VALOR DA VENDA</div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>R$ {Number(projeto.valor_fechado || 0).toLocaleString('pt-BR')}</div>
                 </div>
                 
                 <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                       <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status Pagamento</span>
                       <span style={{ fontSize: 12, fontWeight: 700, color: projeto.entrega_paga ? 'var(--green)' : '#f59e0b' }}>
                         {projeto.entrega_paga ? 'Totalizado' : projeto.sinal_pago ? 'Sinal Pago' : 'Pendente'}
                       </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                       <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Repasse Terceiros</span>
                       <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>- R$ {totalSplits.toLocaleString('pt-BR')}</span>
                    </div>
                 </div>

                 <div style={{ background: 'rgba(124,58,237,0.1)', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 10, color: 'var(--accent-light)', fontWeight: 800, marginBottom: 4 }}>LUCRO DO ESTÚDIO</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: lucroEstudio > 0 ? 'var(--green)' : '#ef4444' }}>
                      R$ {lucroEstudio.toLocaleString('pt-BR')}
                    </div>
                 </div>
              </div>
           </div>

           <div className="glass" style={{ padding: 20, borderRadius: 16, background: 'rgba(0,0,15,0.3)', border: '1px dashed var(--border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                 Este dossiê é exclusivo para o PO. As informações financeiras e dados de contato de parceiros são sigilosos.
              </p>
           </div>
        </div>
      </div>

      <style jsx>{`
        .icon-btn-small { background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: var(--text-muted); padding: 8px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .icon-btn-small:hover { border-color: var(--accent); color: #fff; transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
