import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Utilitários unificados do Core Antigravity
 */

// --- FORMATAÇÃO MONETÁRIA ---
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'R$ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// --- FORMATAÇÃO DE DATA ---
export function formatDate(dateString: string | Date | null | undefined, formatStr = 'dd/MM/yyyy'): string {
  if (!dateString) return '--';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '--';
    return format(date, formatStr, { locale: ptBR });
  } catch (e) {
    return '--';
  }
}

export function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return '--';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '--';
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  } catch (e) {
    return '--';
  }
}

// --- EXTRAÇÃO DE RELAÇÕES JSON ---
/**
 * Extrai o nome de uma relação que pode ter retornado como Array ou Objeto 
 * devido aos joins implícitos do PostgREST.
 */
export function getRelationName(relationEntity: any, fallback = 'Desconhecido'): string {
  if (!relationEntity) return fallback;
  
  // Se for array (O PostgREST retornou múltiplos)
  if (Array.isArray(relationEntity)) {
     if (relationEntity.length === 0) return fallback;
     relationEntity = relationEntity[0];
  }
  
  // Nomes possíveis a depender da tabela
  return (
    relationEntity.nome_artistico || 
    relationEntity.nome_pessoal || 
    relationEntity.nome || 
    relationEntity.descricao || 
    relationEntity.tipo_servico || 
    fallback
  );
}

// --- TRATAMENTO NATIVO DE EXCEÇÕES ---
/**
 * Traduz erros brutos (ex: Supabase, HTTP) para mensagens amigáveis ao usuário.
 */
export function handleSupabaseError(error: any): string {
  if (!error) return 'Ocorreu um erro desconhecido.';
  
  const msg = error.message || error.error_description || error.toString();
  const code = error.code;
  
  // Códigos PostgreSQL comuns
  if (code === '23505') return 'Este registro já existe no sistema.';
  if (code === '23503') return 'Não é possível excluir, pois este item possui vínculos ativos.';
  if (code === '42501') return 'Você não tem permissão para realizar esta ação.';
  if (code === 'PGRST301') return 'Autenticação JWT expirada ou inválida. Atualize a página.';
  
  // Outros erros
  if (msg.includes('network') || msg.includes('Failed to fetch')) return 'Sem conexão com a internet ou servidor fora do ar.';
  if (msg.includes('violates row-level security')) return 'Acesso negado pela política de segurança (RLS).';
  
  return msg;
}
