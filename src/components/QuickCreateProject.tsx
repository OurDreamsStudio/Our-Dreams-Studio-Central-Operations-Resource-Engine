'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function QuickCreateProject() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    nome_artistico: '',
    nome_pessoal: '',
    telefone: '',
    servicos: [{ nome: '', valor: 0 }]
  });

  const handleAddServico = () => {
    setFormData(prev => ({
      ...prev,
      servicos: [...prev.servicos, { nome: '', valor: 0 }]
    }));
  };

  const handleServicoChange = (index: number, field: 'nome' | 'valor', value: string | number) => {
    const newServicos = [...formData.servicos];
    newServicos[index] = { ...newServicos[index], [field]: value };
    setFormData(prev => ({ ...prev, servicos: newServicos }));
  };

  const handleRemoveServico = (index: number) => {
    setFormData(prev => ({
      ...prev,
      servicos: prev.servicos.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Criar ou encontrar cliente (simplificado pelo telefone ou nome)
      let clienteId = null;
      
      const { data: existingCliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome_artistico', formData.nome_artistico)
        .limit(1)
        .single();

      if (existingCliente) {
        clienteId = existingCliente.id;
      } else {
        const { data: newCliente, error: clienteError } = await supabase
          .from('clientes')
          .insert([{ 
            nome_artistico: formData.nome_artistico, 
            nome_pessoal: formData.nome_pessoal, 
            telefone: formData.telefone,
            status_funil: 'Fechado',
            data_entrada: new Date().toISOString()
          }])
          .select('id')
          .single();
          
        if (clienteError) throw clienteError;
        clienteId = newCliente.id;
      }

      // 2. Criar o Projeto (Orçamento)
      const valorTotal = formData.servicos.reduce((acc, s) => acc + Number(s.valor), 0);
      const servicosNomes = formData.servicos.map(s => s.nome).join(', ');

      const { data: newProjeto, error: projetoError } = await supabase
        .from('projetos')
        .insert([{
          cliente_id: clienteId,
          status_funil: 'Fechado',
          valor_fechado: valorTotal,
          servicos_fechados: servicosNomes,
          tipo_servico: servicosNomes,
          status_producao: 'Definição de Escopo',
          created_at: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (projetoError) throw projetoError;

      // 3. Criar os Entregáveis
      if (formData.servicos.length > 0) {
        const entregaveis = formData.servicos.map(s => ({
          projeto_id: newProjeto.id,
          nome_servico: s.nome,
          valor: Number(s.valor),
          status_producao: 'Definição de Escopo'
        }));

        const { error: entregaveisError } = await supabase
          .from('projeto_entregaveis')
          .insert(entregaveis);

        if (entregaveisError) throw entregaveisError;
      }

      setIsOpen(false);
      router.refresh();
      setFormData({ nome_artistico: '', nome_pessoal: '', telefone: '', servicos: [{ nome: '', valor: 0 }] });
      alert('Orçamento e entregáveis criados com sucesso!');
      
    } catch (err: any) {
      console.error(err);
      alert('Erro ao criar projeto: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--accent)', color: '#fff', border: 'none',
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 0 14px var(--accent-glow)',
          transition: 'all 0.2s'
        }}
        className="hover:scale-105"
      >
        <Plus size={16} /> Novo Orçamento
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 20
        }}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '500px',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Criar Novo Orçamento</h2>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>Nome Artístico</label>
                <input required type="text" value={formData.nome_artistico} onChange={e => setFormData({...formData, nome_artistico: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff' }} />
              </div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>Nome Pessoal</label>
                  <input type="text" value={formData.nome_pessoal} onChange={e => setFormData({...formData, nome_pessoal: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>Telefone</label>
                  <input type="text" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff' }} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>Entregáveis (Músicas / Serviços)</h3>
                <button type="button" onClick={handleAddServico} style={{ background: 'rgba(124,58,237,0.15)', color: 'var(--accent)', border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ Adicionar Serviço</button>
              </div>

              {formData.servicos.map((servico, index) => (
                <div key={index} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nome (ex: Mixagem Música X)</label>
                    <input required type="text" value={servico.nome} onChange={e => handleServicoChange(index, 'nome', e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Valor (R$)</label>
                    <input required type="number" min="0" step="0.01" value={servico.valor} onChange={e => handleServicoChange(index, 'valor', Number(e.target.value))} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border)', color: '#fff', fontSize: 13 }} />
                  </div>
                  {formData.servicos.length > 1 && (
                    <button type="button" onClick={() => handleRemoveServico(index)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', width: 36, height: 36, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                <button type="button" onClick={() => setIsOpen(false)} style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--bg-base)', color: '#fff', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                <button type="submit" disabled={loading} style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Criando...' : 'Salvar Orçamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
