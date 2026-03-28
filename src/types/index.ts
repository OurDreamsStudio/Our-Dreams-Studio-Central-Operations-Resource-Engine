import { Database } from './database';

export type Cliente = Database['public']['Tables']['clientes']['Row'];
export type Projeto = Database['public']['Tables']['projetos']['Row'];
export type Terceirizado = Database['public']['Tables']['terceirizados']['Row'];
export type TarefaTerceirizado = Database['public']['Tables']['tarefas_terceirizados']['Row'];
export type Notificacao = Database['public']['Tables']['notificacoes']['Row'];

// Tipos com Relações (para quando fazemos select('*, clientes(...)'))
export type ProjetoComCliente = Projeto & {
  clientes: Pick<Cliente, 'nome_artistico' | 'nome_pessoal'> | null;
};

export type TarefaComProjetoETerceiro = TarefaTerceirizado & {
  projetos: Pick<Projeto, 'nome' | 'servicos_fechados' | 'tipo_servico'> | null;
  terceirizados: Pick<Terceirizado, 'nome'> | null;
};

export type NotificacaoComProjeto = Notificacao & {
  projetos: Pick<Projeto, 'id'> | null;
};
