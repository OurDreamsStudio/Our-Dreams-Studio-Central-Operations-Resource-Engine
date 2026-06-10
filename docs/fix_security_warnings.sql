-- ============================================================
-- MIGRATION: Correções de Segurança e Performance do Supabase
-- Data: 2026-05-23
-- ============================================================


-- ------------------------------------------------------------
-- 1. FUNÇÕES: search_path mutável + SECURITY DEFINER exposta
-- ------------------------------------------------------------

-- Fix: update_updated_at_column sem search_path definido
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Fix: rls_auto_enable acessível por anon/authenticated como SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.rls_auto_enable() SET search_path = '';


-- ------------------------------------------------------------
-- 2. POLÍTICAS RLS: "always true" + initplan + redundância
--    Usa (select auth.uid()) para avaliação única por query
-- ------------------------------------------------------------

-- Tabela: ativos_hardware
DROP POLICY IF EXISTS auth_all_ativos_hardware ON public.ativos_hardware;
CREATE POLICY auth_all_ativos_hardware ON public.ativos_hardware
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Tabela: clientes
DROP POLICY IF EXISTS auth_read_clientes ON public.clientes;  -- redundante (ALL já cobre SELECT)
DROP POLICY IF EXISTS auth_write_clientes ON public.clientes;
CREATE POLICY auth_write_clientes ON public.clientes
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Tabela: clientes (remover política insegura para anon — webhook usa service_role)
DROP POLICY IF EXISTS anon_insert_clientes_webhook ON public.clientes;

-- Tabela: custos_fixos
DROP POLICY IF EXISTS auth_all_custos_fixos ON public.custos_fixos;
CREATE POLICY auth_all_custos_fixos ON public.custos_fixos
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Tabela: leads (delete)
DROP POLICY IF EXISTS leads_auth_delete ON public.leads;
CREATE POLICY leads_auth_delete ON public.leads
  FOR DELETE TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- Tabela: leads (update)
DROP POLICY IF EXISTS leads_auth_update ON public.leads;
CREATE POLICY leads_auth_update ON public.leads
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Tabela: leads (inserção pública com validação mínima)
DROP POLICY IF EXISTS leads_public_insert ON public.leads;
CREATE POLICY leads_public_insert ON public.leads
  FOR INSERT TO anon
  WITH CHECK (nome IS NOT NULL AND length(nome) > 0);

-- Tabela: n8n_estado
DROP POLICY IF EXISTS auth_read_n8n_estado ON public.n8n_estado;  -- redundante
DROP POLICY IF EXISTS auth_write_n8n_estado ON public.n8n_estado;
CREATE POLICY auth_write_n8n_estado ON public.n8n_estado
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Tabela: notificacoes
DROP POLICY IF EXISTS auth_all_notificacoes ON public.notificacoes;
CREATE POLICY auth_all_notificacoes ON public.notificacoes
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Tabela: projetos
DROP POLICY IF EXISTS auth_read_projetos ON public.projetos;  -- redundante
DROP POLICY IF EXISTS auth_write_projetos ON public.projetos;
CREATE POLICY auth_write_projetos ON public.projetos
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Tabela: tarefas_terceirizados
DROP POLICY IF EXISTS auth_all_tarefas ON public.tarefas_terceirizados;
CREATE POLICY auth_all_tarefas ON public.tarefas_terceirizados
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Tabela: terceirizados
DROP POLICY IF EXISTS auth_all_terceirizados ON public.terceirizados;
CREATE POLICY auth_all_terceirizados ON public.terceirizados
  FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);


-- ------------------------------------------------------------
-- 3. PERFORMANCE: Remoção de índices realmente não utilizados
--    (Mantendo os índices de Foreign Keys para evitar bloqueios)
-- ------------------------------------------------------------

DROP INDEX IF EXISTS public.idx_n8n_estado_whatsapp_id;
DROP INDEX IF EXISTS public.idx_projetos_status_funil;
DROP INDEX IF EXISTS public.idx_notificacoes_lida;
