'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { 
  Users, CheckCircle2, CircleDashed, Filter, Loader2, Plus, 
  Search, Terminal, AlertCircle, Link as LinkIcon, ExternalLink, 
  Pencil, Trash2, X, Phone, CreditCard, Calendar, Edit2, 
  Briefcase, PlusCircle, MinusCircle, UserPlus, Info
} from 'lucide-react';
import { StandardModal } from '@/components/StandardModal';
import { handleSupabaseError, formatCurrency, formatDate } from '@/lib/utils';
import { getClientes, getProjetos } from '@/actions/databaseActions';
import { 
  getTerceirizados, 
  saveTerceirizado, 
  deleteTerceirizado,
  getTarefas,
  saveTarefa,
  deleteTarefa,
  aprovarEtapa,
  solicitarRevisaoEtapa,
  confirmarPagamento
} from '@/actions/terceirizadosActions';

import { Terceirizado, TarefaTerceirizado, Projeto, ProjetoComCliente, TarefaComProjetoETerceiro } from '@/types';

type Tab = 'time' | 'tarefas';

export default function AdminTerceirizadosPage() {
  const [activeTab, setActiveTab] = useState<Tab>('time');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  
  // Data
  const [terceirizados, setTerceirizados] = useState<Terceirizado[]>([]);
  const [tarefas, setTarefas] = useState<TarefaComProjetoETerceiro[]>([]);
  const [projetos, setProjetos] = useState<ProjetoComCliente[]>([]);
  
  // Modals
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<{ id: string, type: 'parceiro' | 'tarefa' } | null>(null);
  const [showRevisionModal, setShowRevisionModal] = useState<{ id: string } | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');

  // Form State
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [roadmapSteps, setRoadmapSteps] = useState<string[]>(['']);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tData = await getTerceirizados();
      setTerceirizados(tData || []);
      
      const tasksData = await getTarefas();
      setTarefas(tasksData || []);

      const pData = await getProjetos();
      setProjetos(pData || []);
    } catch (error) {
      console.error('Fetch error:', error);
      alert('Erro ao carregar dados: ' + handleSupabaseError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- HANDLERS ---

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());

    startTransition(async () => {
      try {
        await saveTerceirizado(editingPartner?.id || null, data);
        setShowPartnerModal(false);
        setEditingPartner(null);
        fetchData();
      } catch (error) {
        alert('Erro ao salvar parceiro: ' + handleSupabaseError(error));
      }
    });
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data: any = Object.fromEntries(formData.entries());
    
    // Process Roadmap Steps
    const validRoadmap = roadmapSteps.filter(s => s.trim() !== '');
    data.roadmap_etapas = validRoadmap;
    data.etapa_atual_index = 0;
    data.status_etapa_atual = 'Em Execução';

    startTransition(async () => {
      try {
        await saveTarefa(editingTask?.id || null, data);
        setShowTaskModal(false);
        setEditingTask(null);
        setRoadmapSteps(['']);
        fetchData();
      } catch (error) {
        alert('Erro ao salvar tarefa: ' + handleSupabaseError(error));
      }
    });
  };

  const handleConfirmarPagamentoAction = async (id: string) => {
    if (!confirm('Deseja marcar esta tarefa como Paga?')) return;
    startTransition(async () => {
      try {
        await confirmarPagamento(id);
        fetchData();
      } catch (error) {
        alert('Erro ao confirmar pagamento: ' + handleSupabaseError(error));
      }
    });
  };

  const openApproveStage = async (id: string) => {
    if (!confirm('Deseja aprovar esta etapa do roadmap?')) return;
    startTransition(async () => {
      try {
        await aprovarEtapa(id);
        fetchData();
      } catch (error) {
        alert('Erro ao aprovar: ' + handleSupabaseError(error));
      }
    });
  };

  const handleSolicitarRevisaoAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRevisionModal || !revisionFeedback.trim()) return;
    
    startTransition(async () => {
      try {
        await solicitarRevisaoEtapa(showRevisionModal.id, revisionFeedback);
        setShowRevisionModal(null);
        setRevisionFeedback('');
        fetchData();
      } catch (error) {
        alert('Erro ao solicitar revisão: ' + handleSupabaseError(error));
      }
    });
  };

  const confirmDeleteAction = async () => {
    if (!showDeleteModal) return;
    const { id, type } = showDeleteModal;
    
    startTransition(async () => {
      try {
        if (type === 'parceiro') {
          await deleteTerceirizado(id);
        } else {
          await deleteTarefa(id);
        }
        fetchData();
        setShowDeleteModal(null);
      } catch (error) {
        alert(`Erro ao excluir: ${handleSupabaseError(error)}`);
      }
    });
  };

  const togglePartnerEdit = (partner: any) => {
    setEditingPartner(partner);
    setShowPartnerModal(true);
  };

  const toggleTaskEdit = (task: any) => {
    setEditingTask(task);
    if (task.roadmap_etapas) {
      setRoadmapSteps(task.roadmap_etapas);
    } else {
      setRoadmapSteps(['']);
    }
    setShowTaskModal(true);
  };

  // --- UI RENDER ---

  if (loading && !isPending) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500" style={{ padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 40px)', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-3xl border border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/20 shadow-lg shadow-purple-500/10">
            <Users className="w-7 h-7 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Controle de Terceiros</h1>
            <p className="text-slate-400 text-sm mt-0.5">Gestão de parceiros, custos e roadmaps de produção</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          <button
            onClick={() => { setEditingPartner(null); setShowPartnerModal(true); }}
            className="flex-1 md:flex-none justify-center items-center gap-2 flex bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-2xl transition-all font-medium shadow-lg shadow-purple-600/20 hover:-translate-y-0.5"
          >
            <UserPlus className="w-5 h-5" />
            <span>Novo Parceiro</span>
          </button>
          
          <button
            onClick={() => { setEditingTask(null); setRoadmapSteps(['']); setShowTaskModal(true); }}
            className="flex-1 md:flex-none justify-center items-center gap-2 flex bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-2xl transition-all font-medium border border-white/5 hover:border-white/10"
          >
            <PlusCircle className="w-5 h-5 text-blue-400" />
            <span>Alocar Tarefa</span>
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex p-1.5 bg-slate-900/60 rounded-2xl border border-white/5 w-fit">
        <button
          onClick={() => setActiveTab('time')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all text-sm font-medium ${
            activeTab === 'time' 
              ? 'bg-purple-600/90 text-white shadow-lg shadow-purple-600/10' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          Time de Parceiros
        </button>
        <button
          onClick={() => setActiveTab('tarefas')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all text-sm font-medium ${
            activeTab === 'tarefas' 
              ? 'bg-purple-600/90 text-white shadow-lg shadow-purple-600/10' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Tarefas & Roadmap
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="bg-slate-900/40 rounded-3xl border border-white/5 backdrop-blur-xl overflow-hidden min-h-[500px]">
        
        {activeTab === 'time' ? (
          <div className="animate-in slide-in-from-left-4 duration-300 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Nome</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Especialidade</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Contato</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Chave PIX</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {terceirizados.map((t) => (
                  <tr key={t.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-5">
                      <div className="font-medium text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight antialiased">{t.nome}</div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                        {t.especialidade}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-slate-400 text-sm font-mono">{t.telefone || '--'}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-slate-400 group-hover:text-white transition-colors text-xs font-mono">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                        {t.chave_pix || 'Não informada'}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => togglePartnerEdit(t)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setShowDeleteModal({id: t.id, type: 'parceiro'})} className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {terceirizados.length === 0 && (
              <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-4">
                <Users className="w-12 h-12 opacity-20" />
                <p>Nenhum parceiro cadastrado.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in slide-in-from-right-4 duration-300 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Tarefa / Projeto</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Parceiro</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Valor</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Prazo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Status Atual</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tarefas.map((task) => {
                  const currentStep = (task.roadmap_etapas as string[])?.[task.etapa_atual_index ?? 0] || 'Concluído';
                  const isAwaiting = task.status_etapa_atual === 'Aguardando Aprovação';
                  const isPaid = task.status_pagamento === 'Pago';

                  return (
                    <tr key={task.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-5">
                        <div className="font-medium text-white uppercase tracking-tight antialiased">{task.descricao_tarefa}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium uppercase tracking-widest">
                          <LinkIcon className="w-3 h-3 text-purple-500" />
                          {task.projetos?.clientes?.nome_artistico} - {task.projetos?.tipo_servico}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-slate-300 font-medium tracking-wide antialiased uppercase">{task.terceirizados?.nome}</div>
                        <div className="text-xs text-slate-500">{task.terceirizados?.especialidade}</div>
                      </td>
                      <td className="px-6 py-5 font-mono text-xs text-emerald-400 font-semibold">{formatCurrency(task.valor_combinado)}</td>
                      <td className="px-6 py-5">
                         <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                            {formatDate(task.prazo_entrega)}
                         </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1.5">
                          <div className={`text-xs font-semibold tracking-widest uppercase antialiased px-2 py-0.5 rounded-md w-fit ${
                            isAwaiting ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20' : 
                            task.status_etapa_atual === 'Revisão Solicitada' ? 'text-red-400 bg-red-400/10 border border-red-400/20' :
                            task.status_etapa_atual === 'Concluído' ? 'text-emerald-400 bg-emerald-400/10' : 'text-blue-400 bg-blue-400/10'
                          }`}>
                            {task.status_etapa_atual}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium italic">
                            Etapa: {currentStep}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isAwaiting && (
                            <div className="flex items-center gap-2 mr-2">
                               <button 
                                onClick={() => openApproveStage(task.id)}
                                title="Aprovar Etapa"
                                className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white p-2 rounded-xl transition-all border border-emerald-500/20"
                               >
                                 <CheckCircle2 className="w-4 h-4" />
                               </button>
                               <button 
                                onClick={() => setShowRevisionModal({id: task.id})}
                                title="Solicitar Revisão"
                                className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white p-2 rounded-xl transition-all border border-red-500/20"
                               >
                                 <CircleDashed className="w-4 h-4" />
                               </button>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isPaid && (
                              <button onClick={() => handleConfirmarPagamentoAction(task.id)} title="Pagar" className="p-2 hover:bg-emerald-500/10 rounded-lg text-slate-400 hover:text-emerald-400">
                                <CreditCard className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => toggleTaskEdit(task)} title="Editar" className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setShowDeleteModal({id: task.id, type: 'tarefa'})} title="Excluir" className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {tarefas.length === 0 && (
              <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-4">
                <Briefcase className="w-12 h-12 opacity-20" />
                <p>Nenhuma tarefa alocada.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- MODALS SECTION --- */}

      {/* 1. PARTNER MODAL */}
      <StandardModal
        isOpen={showPartnerModal}
        onClose={() => { setShowPartnerModal(false); setEditingPartner(null); }}
        title={editingPartner ? 'Editar Parceiro' : 'Novo Parceiro'}
        maxW="500px"
      >
        <form onSubmit={handleSavePartner} className="space-y-6">
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
              <input 
                name="nome" 
                defaultValue={editingPartner?.nome}
                required
                placeholder="Ex: João Silva" 
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-700 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Especialidade</label>
                <input 
                  name="especialidade" 
                  defaultValue={editingPartner?.especialidade}
                  placeholder="Ex: Edição" 
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-700 outline-none focus:border-purple-500/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Telefone</label>
                <input 
                  name="telefone" 
                  defaultValue={editingPartner?.telefone}
                  placeholder="(00) 00000-0000" 
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-700 outline-none focus:border-purple-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Chave PIX</label>
              <input 
                name="chave_pix" 
                defaultValue={editingPartner?.chave_pix}
                placeholder="Email, CPF ou Aleatória" 
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-700 outline-none focus:border-purple-500/50 transition-all font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button 
              type="submit" 
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </StandardModal>

      {/* 2. TASK MODAL */}
      <StandardModal
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setEditingTask(null); }}
        title={editingTask ? 'Editar Tarefa' : 'Nova Alocação de Tarefa'}
        maxW="700px"
      >
        <form onSubmit={handleSaveTask} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Left Column */}
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Descrição Curta</label>
                <input 
                  name="descricao_tarefa" 
                  defaultValue={editingTask?.descricao_tarefa}
                  required
                  placeholder="Ex: Edição Teaser Clip" 
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-700 focus:border-purple-500/50 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Projeto Vinculado</label>
                <select 
                  name="projeto_id" 
                  defaultValue={editingTask?.projeto_id}
                  required
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50 transition-all appearance-none"
                >
                  <option value="">Selecione um projeto...</option>
                  {projetos.map(p => (
                    <option key={p.id} value={p.id}>{p.clientes?.nome_artistico} - {p.tipo_servico}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Especialista Responsável</label>
                <select 
                  name="terceirizado_id" 
                  defaultValue={editingTask?.terceirizado_id}
                  required
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50 transition-all appearance-none"
                >
                  <option value="">Selecione um parceiro...</option>
                  {terceirizados.map(t => (
                    <option key={t.id} value={t.id}>{t.nome} ({t.especialidade})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Valor Combinado</label>
                  <input 
                    name="valor_combinado" 
                    type="number"
                    defaultValue={editingTask?.valor_combinado}
                    placeholder="0.00" 
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-700 outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Prazo de Entrega</label>
                  <input 
                    name="prazo_entrega" 
                    type="date"
                    defaultValue={editingTask?.prazo_entrega}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Roadmap Builder */}
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 space-y-4">
               <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Roadmap de Entrega</span>
                  <button 
                    type="button" 
                    onClick={() => setRoadmapSteps([...roadmapSteps, ''])}
                    className="text-purple-400 hover:text-white p-1"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
               </div>
               
               <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                  {roadmapSteps.map((step, idx) => (
                    <div key={idx} className="flex gap-2">
                       <div className="flex-1">
                          <input 
                            value={step}
                            onChange={(e) => {
                              const newSteps = [...roadmapSteps];
                              newSteps[idx] = e.target.value;
                              setRoadmapSteps(newSteps);
                            }}
                            placeholder={`Etapa ${idx + 1}...`}
                            className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 outline-none transition-all"
                          />
                       </div>
                       <button 
                        type="button"
                        onClick={() => setRoadmapSteps(roadmapSteps.filter((_, i) => i !== idx))}
                        className="text-slate-600 hover:text-red-400 p-1"
                       >
                         <X className="w-3.5 h-3.5" />
                       </button>
                    </div>
                  ))}
               </div>
               <p className="text-[10px] text-slate-600 leading-relaxed">
                 O roadmap define os checkpoints de aprovação automática via Hub de Parceiros.
               </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button 
              type="submit" 
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50"
            >
              {isPending ? 'Alocando...' : editingTask ? 'Salvar Tarefa' : 'Criar Alocação'}
            </button>
          </div>
        </form>
      </StandardModal>

      {/* 3. REVISION MODAL */}
      <StandardModal
        isOpen={!!showRevisionModal}
        onClose={() => setShowRevisionModal(null)}
        title="Solicitar Ajustes"
        maxW="500px"
      >
        <div className="space-y-4">
           <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
              <Info className="w-5 h-5 text-red-400 mt-1 flex-shrink-0" />
              <p className="text-sm text-slate-400 leading-relaxed">
                Descreva detalhadamente o que precisa ser ajustado. O parceiro receberá o feedback instantaneamente no Hub.
              </p>
           </div>
           
           <form onSubmit={handleSolicitarRevisaoAction} className="space-y-5">
              <textarea 
                required
                value={revisionFeedback}
                onChange={(e) => setRevisionFeedback(e.target.value)}
                placeholder="Ex: Aumentar o volume da trilha sonora e ajustar a cor do gradiente na introdução..."
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-700 focus:border-red-500/50 outline-none transition-all resize-none"
              />
              
              <div className="flex justify-end">
                 <button 
                  type="submit" 
                  disabled={isPending}
                  className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-red-600/20"
                 >
                   {isPending ? 'Enviando...' : 'Enviar Feedback'}
                 </button>
              </div>
           </form>
        </div>
      </StandardModal>

      {/* 4. DELETE MODAL */}
      <StandardModal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        title="Confirmar Exclusão"
        maxW="400px"
      >
        <div className="text-center space-y-6">
           <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
              <Trash2 className="w-10 h-10 text-red-500" />
           </div>
           <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Tem certeza absoluta?</h3>
              <p className="text-slate-400 text-sm">
                Esta ação é irreversível e removerá todos os dados vinculados a este registro.
              </p>
           </div>
           <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteAction}
                disabled={isPending}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
              >
                {isPending ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
           </div>
        </div>
      </StandardModal>

    </div>
  );
}