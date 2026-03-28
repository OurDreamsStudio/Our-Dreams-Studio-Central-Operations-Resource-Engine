export const SERVICOS = [
  'Captação de voz',
  'Beatmaking',
  'Mixagem e Masterização',
  'Edição de Videoclipe',
  'Lyric Video',
  'Visualizer'
] as const;

export type ServicoType = typeof SERVICOS[number];

export const ETAPAS_VENDAS = [
  'Inbound WhatsApp',
  'Áudios Primordiais Enviados',
  'Diagnóstico Preenchido',
  'Análise do Produtor',
  'Reunião de Alinhamento',
  'Orçamento Enviado',
  'Fechado',
  'Perdido'
] as const;

export type FunilStatus = typeof ETAPAS_VENDAS[number];

export const ETAPAS_PRODUCAO = [
  'Definição de Escopo',
  'Preparação Técnica',
  'Execução & Captação',
  'Pós-Produção',
  'Revisão',
  'Entregue'
] as const;

export type ProducaoStatus = typeof ETAPAS_PRODUCAO[number];

export const MIX_MASTER_CHECKLIST = [
  'Estrutura e Captação',
  'Métrica',
  'Performance',
  'Direitos'
];

export type ChecklistItem = {
  item: string;
  done: boolean;
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Brand / Default
  'Default': { bg: 'rgba(124,58,237,0.1)', text: '#a78bfa', border: 'rgba(124,58,237,0.3)' },
  
  // Vendas
  'Inbound WhatsApp':            { bg: '#064e3b', text: '#34d399', border: '#047857' },
  'Áudios Primordiais Enviados': { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  'Diagnóstico Preenchido':      { bg: 'rgba(234,179,8,0.15)', text: '#fde047', border: 'rgba(234,179,8,0.3)' },
  'Análise do Produtor':         { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d', border: 'rgba(245,158,11,0.3)' },
  'Reunião de Alinhamento':      { bg: 'rgba(217,70,239,0.15)', text: '#f0abfc', border: 'rgba(217,70,239,0.3)' },
  'Orçamento Enviado':           { bg: 'rgba(236,72,153,0.15)', text: '#f472b6', border: 'rgba(236,72,153,0.3)' },
  'Fechado':                     { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  'Perdido':                     { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },
  
  // Produção
  'Definição de Escopo':         { bg: 'rgba(100,116,139,0.15)', text: '#cbd5e1', border: 'rgba(100,116,139,0.3)' },
  'Preparação Técnica':          { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  'Execução & Captação':         { bg: 'rgba(234,179,8,0.15)', text: '#fde047', border: 'rgba(234,179,8,0.3)' },
  'Pós-Produção':                { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  'Revisão':                     { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d', border: 'rgba(245,158,11,0.3)' },
  'Entregue':                    { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  'Cancelado':                   { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' }
};

export function getStatusTheme(status: string | null | undefined) {
  if (!status) return STATUS_COLORS['Default'];
  return STATUS_COLORS[status] || STATUS_COLORS['Default'];
}
