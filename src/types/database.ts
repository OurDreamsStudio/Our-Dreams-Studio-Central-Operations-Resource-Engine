export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ativos_hardware: {
        Row: {
          created_at: string | null
          data_compra: string
          id: string
          item: string
          valor_compra: number
          vida_util_meses: number
        }
        Insert: {
          created_at?: string | null
          data_compra?: string
          id?: string
          item: string
          valor_compra?: number
          vida_util_meses?: number
        }
        Update: {
          created_at?: string | null
          data_compra?: string
          id?: string
          item?: string
          valor_compra?: number
          vida_util_meses?: number
        }
        Relationships: []
      }
      clientes: {
        Row: {
          anotacoes: string | null
          data_entrada: string
          data_nascimento: string | null
          diag_capacidade_investimento: string | null
          diag_nivel_experiencia: string | null
          diag_servico_interesse: string | null
          diag_status_arquivos: string | null
          email: string | null
          id: string
          instagram: string | null
          nome_artistico: string | null
          nome_pessoal: string | null
          status_funil: string | null
          telefone: string | null
          whatsapp_id: string | null
        }
        Insert: {
          anotacoes?: string | null
          data_entrada?: string
          data_nascimento?: string | null
          diag_capacidade_investimento?: string | null
          diag_nivel_experiencia?: string | null
          diag_servico_interesse?: string | null
          diag_status_arquivos?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          nome_artistico?: string | null
          nome_pessoal?: string | null
          status_funil?: string | null
          telefone?: string | null
          whatsapp_id?: string | null
        }
        Update: {
          anotacoes?: string | null
          data_entrada?: string
          data_nascimento?: string | null
          diag_capacidade_investimento?: string | null
          diag_nivel_experiencia?: string | null
          diag_servico_interesse?: string | null
          diag_status_arquivos?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          nome_artistico?: string | null
          nome_pessoal?: string | null
          status_funil?: string | null
          telefone?: string | null
          whatsapp_id?: string | null
        }
        Relationships: []
      }
      custos_fixos: {
        Row: {
          categoria: string
          created_at: string | null
          descricao: string
          id: string
          valor: number
          vencimento_dia: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          descricao: string
          id?: string
          valor?: number
          vencimento_dia: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          descricao?: string
          id?: string
          valor?: number
          vencimento_dia?: number
        }
        Relationships: []
      }
      n8n_estado: {
        Row: {
          cliente_id: string
          id: string
          status_fluxo: string
          ultima_interacao: string
          whatsapp_id: string
        }
        Insert: {
          cliente_id: string
          id?: string
          status_fluxo?: string
          ultima_interacao?: string
          whatsapp_id: string
        }
        Update: {
          cliente_id?: string
          id?: string
          status_fluxo?: string
          ultima_interacao?: string
          whatsapp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "n8n_estado_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string | null
          id: string
          lida: boolean | null
          link: string | null
          mensagem: string
          projeto_id: string | null
          titulo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem: string
          projeto_id?: string | null
          titulo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string
          projeto_id?: string | null
          titulo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          checklist_preparacao: Json | null
          cliente_id: string
          contador_revisoes: number | null
          created_at: string
          cupom_usado: string | null
          data_aprovacao: string | null
          entrega_paga: boolean | null
          historico_revisoes: Json | null
          id: string
          link_arquivos: string | null
          motivo_revisao: string | null
          nome: string | null
          orcamento_arquivado: boolean | null
          orcamento_pdf_url: string | null
          prazo_entrega: string | null
          public_token: string | null
          referencias: Json | null
          servicos_fechados: string | null
          sinal_pago: boolean | null
          status_funil: string
          status_producao: string | null
          terceirizados: string | null
          tipo_servico: string | null
          token_expires_at: string | null
          updated_at: string | null
          valor_fechado: number | null
          valores_servicos: Json | null
        }
        Insert: {
          checklist_preparacao?: Json | null
          cliente_id: string
          contador_revisoes?: number | null
          created_at?: string
          cupom_usado?: string | null
          data_aprovacao?: string | null
          entrega_paga?: boolean | null
          historico_revisoes?: Json | null
          id?: string
          link_arquivos?: string | null
          motivo_revisao?: string | null
          nome?: string | null
          orcamento_arquivado?: boolean | null
          orcamento_pdf_url?: string | null
          prazo_entrega?: string | null
          public_token?: string | null
          referencias?: Json | null
          servicos_fechados?: string | null
          sinal_pago?: boolean | null
          status_funil?: string
          status_producao?: string | null
          terceirizados?: string | null
          tipo_servico?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          valor_fechado?: number | null
          valores_servicos?: Json | null
        }
        Update: {
          checklist_preparacao?: Json | null
          cliente_id?: string
          contador_revisoes?: number | null
          created_at?: string
          cupom_usado?: string | null
          data_aprovacao?: string | null
          entrega_paga?: boolean | null
          historico_revisoes?: Json | null
          id?: string
          link_arquivos?: string | null
          motivo_revisao?: string | null
          nome?: string | null
          orcamento_arquivado?: boolean | null
          orcamento_pdf_url?: string | null
          prazo_entrega?: string | null
          public_token?: string | null
          referencias?: Json | null
          servicos_fechados?: string | null
          sinal_pago?: boolean | null
          status_funil?: string
          status_producao?: string | null
          terceirizados?: string | null
          tipo_servico?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          valor_fechado?: number | null
          valores_servicos?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_terceirizados: {
        Row: {
          created_at: string | null
          descricao_tarefa: string
          etapa_atual_index: number | null
          id: string
          link_entrega: string | null
          motivo_revisao_etapa: string | null
          prazo_entrega: string | null
          projeto_id: string | null
          public_token: string | null
          roadmap_etapas: Json | null
          status_entrega: string | null
          status_etapa_atual: string | null
          status_pagamento: string | null
          terceirizado_id: string | null
          updated_at: string | null
          valor_combinado: number | null
        }
        Insert: {
          created_at?: string | null
          descricao_tarefa: string
          etapa_atual_index?: number | null
          id?: string
          link_entrega?: string | null
          motivo_revisao_etapa?: string | null
          prazo_entrega?: string | null
          projeto_id?: string | null
          public_token?: string | null
          roadmap_etapas?: Json | null
          status_entrega?: string | null
          status_etapa_atual?: string | null
          status_pagamento?: string | null
          terceirizado_id?: string | null
          updated_at?: string | null
          valor_combinado?: number | null
        }
        Update: {
          created_at?: string | null
          descricao_tarefa?: string
          etapa_atual_index?: number | null
          id?: string
          link_entrega?: string | null
          motivo_revisao_etapa?: string | null
          prazo_entrega?: string | null
          projeto_id?: string | null
          public_token?: string | null
          roadmap_etapas?: Json | null
          status_entrega?: string | null
          status_etapa_atual?: string | null
          status_pagamento?: string | null
          terceirizado_id?: string | null
          updated_at?: string | null
          valor_combinado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_terceirizados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_terceirizados_terceirizado_id_fkey"
            columns: ["terceirizado_id"]
            isOneToOne: false
            referencedRelation: "terceirizados"
            referencedColumns: ["id"]
          },
        ]
      }
      terceirizados: {
        Row: {
          chave_pix: string | null
          created_at: string | null
          especialidade: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          chave_pix?: string | null
          created_at?: string | null
          especialidade?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          chave_pix?: string | null
          created_at?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
