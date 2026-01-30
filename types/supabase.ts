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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          branch_id: string | null
          city: string | null
          city_code_ibge: string | null
          company_id: string
          complement: string | null
          country: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_default: boolean | null
          label: string | null
          neighborhood: string | null
          number: string | null
          organization_id: string
          state: string | null
          street: string | null
          type: string
          zip: string | null
        }
        Insert: {
          branch_id?: string | null
          city?: string | null
          city_code_ibge?: string | null
          company_id: string
          complement?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          neighborhood?: string | null
          number?: string | null
          organization_id: string
          state?: string | null
          street?: string | null
          type?: string
          zip?: string | null
        }
        Update: {
          branch_id?: string | null
          city?: string | null
          city_code_ibge?: string | null
          company_id?: string
          complement?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          neighborhood?: string | null
          number?: string | null
          organization_id?: string
          state?: string | null
          street?: string | null
          type?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "organization_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_installments: {
        Row: {
          account_id: string | null
          amount_open: number
          amount_original: number
          amount_paid: number
          ap_title_id: string
          company_id: string
          cost_center_id: string | null
          created_at: string | null
          discount_amount: number
          due_date: string
          financial_account_id: string | null
          id: string
          installment_number: number
          interest_amount: number
          penalty_amount: number
          status: string
        }
        Insert: {
          account_id?: string | null
          amount_open?: number
          amount_original: number
          amount_paid?: number
          ap_title_id: string
          company_id: string
          cost_center_id?: string | null
          created_at?: string | null
          discount_amount?: number
          due_date: string
          financial_account_id?: string | null
          id?: string
          installment_number: number
          interest_amount?: number
          penalty_amount?: number
          status?: string
        }
        Update: {
          account_id?: string | null
          amount_open?: number
          amount_original?: number
          amount_paid?: number
          ap_title_id?: string
          company_id?: string
          cost_center_id?: string | null
          created_at?: string | null
          discount_amount?: number
          due_date?: string
          financial_account_id?: string | null
          id?: string
          installment_number?: number
          interest_amount?: number
          penalty_amount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_installments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_installments_ap_title_id_fkey"
            columns: ["ap_title_id"]
            isOneToOne: false
            referencedRelation: "ap_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_installments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_installments_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_installments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_payment_allocations: {
        Row: {
          amount_allocated: number
          created_at: string | null
          id: string
          installment_id: string
          payment_id: string
        }
        Insert: {
          amount_allocated: number
          created_at?: string | null
          id?: string
          installment_id: string
          payment_id: string
        }
        Update: {
          amount_allocated?: number
          created_at?: string | null
          id?: string
          installment_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_payment_allocations_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "ap_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "ap_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          method: string | null
          notes: string | null
          original_payment_id: string | null
          paid_at: string
          reference: string | null
          reversal_reason: string | null
          status: string
          supplier_id: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          original_payment_id?: string | null
          paid_at: string
          reference?: string | null
          reversal_reason?: string | null
          status?: string
          supplier_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          original_payment_id?: string | null
          paid_at?: string
          reference?: string | null
          reversal_reason?: string | null
          status?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ap_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payments_original_payment_id_fkey"
            columns: ["original_payment_id"]
            isOneToOne: false
            referencedRelation: "ap_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_titles: {
        Row: {
          amount_open: number
          amount_paid: number
          amount_total: number
          approved_at: string | null
          approved_by: string | null
          attention_reason: string | null
          attention_status: string | null
          company_id: string
          created_at: string | null
          date_issued: string | null
          description: string | null
          document_number: string | null
          due_date: string | null
          id: string
          payment_method_snapshot: string | null
          payment_terms_snapshot: string | null
          purchase_order_id: string | null
          source_event_id: string | null
          status: string
          supplier_id: string
        }
        Insert: {
          amount_open?: number
          amount_paid?: number
          amount_total: number
          approved_at?: string | null
          approved_by?: string | null
          attention_reason?: string | null
          attention_status?: string | null
          company_id: string
          created_at?: string | null
          date_issued?: string | null
          description?: string | null
          document_number?: string | null
          due_date?: string | null
          id?: string
          payment_method_snapshot?: string | null
          payment_terms_snapshot?: string | null
          purchase_order_id?: string | null
          source_event_id?: string | null
          status?: string
          supplier_id: string
        }
        Update: {
          amount_open?: number
          amount_paid?: number
          amount_total?: number
          approved_at?: string | null
          approved_by?: string | null
          attention_reason?: string | null
          attention_status?: string | null
          company_id?: string
          created_at?: string | null
          date_issued?: string | null
          description?: string | null
          document_number?: string | null
          due_date?: string | null
          id?: string
          payment_method_snapshot?: string | null
          payment_terms_snapshot?: string | null
          purchase_order_id?: string | null
          source_event_id?: string | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_titles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_titles_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: true
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_titles_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "financial_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_titles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_installments: {
        Row: {
          account_id: string | null
          amount_open: number
          amount_original: number
          amount_paid: number
          ar_title_id: string
          company_id: string
          cost_center_id: string | null
          created_at: string | null
          discount_amount: number
          due_date: string
          financial_account_id: string | null
          id: string
          installment_number: number
          interest_amount: number
          payment_method: string | null
          penalty_amount: number
          status: string
        }
        Insert: {
          account_id?: string | null
          amount_open?: number
          amount_original: number
          amount_paid?: number
          ar_title_id: string
          company_id: string
          cost_center_id?: string | null
          created_at?: string | null
          discount_amount?: number
          due_date: string
          financial_account_id?: string | null
          id?: string
          installment_number: number
          interest_amount?: number
          payment_method?: string | null
          penalty_amount?: number
          status?: string
        }
        Update: {
          account_id?: string | null
          amount_open?: number
          amount_original?: number
          amount_paid?: number
          ar_title_id?: string
          company_id?: string
          cost_center_id?: string | null
          created_at?: string | null
          discount_amount?: number
          due_date?: string
          financial_account_id?: string | null
          id?: string
          installment_number?: number
          interest_amount?: number
          payment_method?: string | null
          penalty_amount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_installments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_installments_ar_title_id_fkey"
            columns: ["ar_title_id"]
            isOneToOne: false
            referencedRelation: "ar_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_installments_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_installments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_payment_allocations: {
        Row: {
          amount_allocated: number
          created_at: string | null
          id: string
          installment_id: string
          payment_id: string
        }
        Insert: {
          amount_allocated: number
          created_at?: string | null
          id?: string
          installment_id: string
          payment_id: string
        }
        Update: {
          amount_allocated?: number
          created_at?: string | null
          id?: string
          installment_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_payment_allocations_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "ar_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "ar_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          id: string
          method: string | null
          notes: string | null
          original_payment_id: string | null
          paid_at: string
          reference: string | null
          reversal_reason: string | null
          status: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          original_payment_id?: string | null
          paid_at: string
          reference?: string | null
          reversal_reason?: string | null
          status?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          original_payment_id?: string | null
          paid_at?: string
          reference?: string | null
          reversal_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_payments_original_payment_id_fkey"
            columns: ["original_payment_id"]
            isOneToOne: false
            referencedRelation: "ar_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_titles: {
        Row: {
          amount_open: number
          amount_paid: number
          amount_total: number
          approved_at: string | null
          approved_by: string | null
          attention_at: string | null
          attention_reason: string | null
          attention_status: string | null
          company_id: string
          created_at: string | null
          customer_id: string
          date_issued: string | null
          document_number: string | null
          id: string
          payment_method_snapshot: string | null
          payment_terms_snapshot: string | null
          sales_document_id: string
          source_event_id: string | null
          status: string
        }
        Insert: {
          amount_open?: number
          amount_paid?: number
          amount_total: number
          approved_at?: string | null
          approved_by?: string | null
          attention_at?: string | null
          attention_reason?: string | null
          attention_status?: string | null
          company_id: string
          created_at?: string | null
          customer_id: string
          date_issued?: string | null
          document_number?: string | null
          id?: string
          payment_method_snapshot?: string | null
          payment_terms_snapshot?: string | null
          sales_document_id: string
          source_event_id?: string | null
          status?: string
        }
        Update: {
          amount_open?: number
          amount_paid?: number
          amount_total?: number
          approved_at?: string | null
          approved_by?: string | null
          attention_at?: string | null
          attention_reason?: string | null
          attention_status?: string | null
          company_id?: string
          created_at?: string | null
          customer_id?: string
          date_issued?: string | null
          document_number?: string | null
          id?: string
          payment_method_snapshot?: string | null
          payment_terms_snapshot?: string | null
          sales_document_id?: string
          source_event_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_titles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_titles_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: true
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_titles_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "financial_events"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          details: Json | null
          entity: string
          entity_id: string | null
          entity_type: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      bom_byproduct_outputs: {
        Row: {
          basis: string
          bom_id: string
          company_id: string
          created_at: string
          id: string
          item_id: string
          notes: string | null
          qty: number
          updated_at: string
        }
        Insert: {
          basis: string
          bom_id: string
          company_id: string
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          qty: number
          updated_at?: string
        }
        Update: {
          basis?: string
          bom_id?: string
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_byproduct_outputs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_headers: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          item_id: string
          updated_at: string
          version: number
          yield_qty: number
          yield_uom: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          item_id: string
          updated_at?: string
          version?: number
          yield_qty?: number
          yield_uom: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          item_id?: string
          updated_at?: string
          version?: number
          yield_qty?: number
          yield_uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_headers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_headers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_lines: {
        Row: {
          bom_id: string
          company_id: string
          component_item_id: string
          id: string
          notes: string | null
          qty: number
          sort_order: number
          uom: string
        }
        Insert: {
          bom_id: string
          company_id: string
          component_item_id: string
          id?: string
          notes?: string | null
          qty: number
          sort_order?: number
          uom: string
        }
        Update: {
          bom_id?: string
          company_id?: string
          component_item_id?: string
          id?: string
          notes?: string | null
          qty?: number
          sort_order?: number
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_lines_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      cfop: {
        Row: {
          ambito: string
          ativo: boolean | null
          codigo: string
          created_at: string | null
          descricao: string
          id: string
          tipo_operacao: string
          updated_at: string | null
        }
        Insert: {
          ambito: string
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
          tipo_operacao: string
          updated_at?: string | null
        }
        Update: {
          ambito?: string
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
          tipo_operacao?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cfops: {
        Row: {
          code: string
          created_at: string | null
          description: string
          is_active: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description: string
          is_active?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          is_branch: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_branch?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_branch?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      company_bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string | null
          agency: string | null
          bank_code: string | null
          bank_name: string
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          pix_key: string | null
          pix_type: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          bank_code?: string | null
          bank_name: string
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          pix_key?: string | null
          pix_type?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          bank_code?: string | null
          bank_name?: string
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          pix_key?: string | null
          pix_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          auth_user_id: string
          company_id: string
          created_at: string
          role: string
        }
        Insert: {
          auth_user_id: string
          company_id: string
          created_at?: string
          role?: string
        }
        Update: {
          auth_user_id?: string
          company_id?: string
          created_at?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_printer_settings: {
        Row: {
          company_id: string
          label_size: string | null
          updated_at: string | null
          zebra_printer_name: string | null
        }
        Insert: {
          company_id: string
          label_size?: string | null
          updated_at?: string | null
          zebra_printer_name?: string | null
        }
        Update: {
          company_id?: string
          label_size?: string | null
          updated_at?: string | null
          zebra_printer_name?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_country: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          cert_a1_expires_at: string | null
          cert_a1_storage_path: string | null
          cert_a1_uploaded_at: string | null
          cert_password_encrypted: string | null
          city_code_ibge: string | null
          cnae_code: string | null
          cnae_description: string | null
          cnpj: string | null
          company_id: string
          created_at: string
          default_interest_percent: number | null
          default_penalty_percent: number | null
          email: string | null
          fiscal_doc_model: number | null
          ie: string | null
          im: string | null
          instagram: string | null
          is_cert_password_saved: boolean | null
          legal_name: string | null
          logo_path: string | null
          nfe_environment: string | null
          nfe_next_number: number | null
          nfe_series: string | null
          phone: string | null
          tax_regime: string | null
          trade_name: string | null
          updated_at: string
          use_deliveries_model: boolean | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          cert_a1_expires_at?: string | null
          cert_a1_storage_path?: string | null
          cert_a1_uploaded_at?: string | null
          cert_password_encrypted?: string | null
          city_code_ibge?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string | null
          company_id: string
          created_at?: string
          default_interest_percent?: number | null
          default_penalty_percent?: number | null
          email?: string | null
          fiscal_doc_model?: number | null
          ie?: string | null
          im?: string | null
          instagram?: string | null
          is_cert_password_saved?: boolean | null
          legal_name?: string | null
          logo_path?: string | null
          nfe_environment?: string | null
          nfe_next_number?: number | null
          nfe_series?: string | null
          phone?: string | null
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
          use_deliveries_model?: boolean | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          cert_a1_expires_at?: string | null
          cert_a1_storage_path?: string | null
          cert_a1_uploaded_at?: string | null
          cert_password_encrypted?: string | null
          city_code_ibge?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string | null
          company_id?: string
          created_at?: string
          default_interest_percent?: number | null
          default_penalty_percent?: number | null
          email?: string | null
          fiscal_doc_model?: number | null
          ie?: string | null
          im?: string | null
          instagram?: string | null
          is_cert_password_saved?: boolean | null
          legal_name?: string | null
          logo_path?: string | null
          nfe_environment?: string | null
          nfe_next_number?: number | null
          nfe_series?: string | null
          phone?: string | null
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
          use_deliveries_model?: boolean | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string | null
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_deals: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          next_followup_at: string | null
          notes: string | null
          organization_id: string
          owner_user_id: string | null
          source: string | null
          stage: string
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          next_followup_at?: string | null
          notes?: string | null
          organization_id: string
          owner_user_id?: string | null
          source?: string | null
          stage?: string
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          next_followup_at?: string | null
          notes?: string | null
          organization_id?: string
          owner_user_id?: string | null
          source?: string | null
          stage?: string
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          number: number
          route_id: string | null
          sales_document_id: string
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          number: number
          route_id?: string | null
          sales_document_id: string
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          number?: number
          route_id?: string | null
          sales_document_id?: string
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          company_id: string
          created_at: string | null
          delivery_id: string
          id: string
          qty_delivered: number
          qty_loaded: number
          qty_planned: number
          qty_returned: number
          sales_document_item_id: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          delivery_id: string
          id?: string
          qty_delivered?: number
          qty_loaded?: number
          qty_planned?: number
          qty_returned?: number
          sales_document_item_id: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          delivery_id?: string
          id?: string
          qty_delivered?: number
          qty_loaded?: number
          qty_planned?: number
          qty_returned?: number
          sales_document_item_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_price_source_mismatch_v1"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_stock_mismatch_v1"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "dre_refusals_logistics_v1"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v1"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "dre_revenue_realized_v1"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "dre_revenue_realized_v2"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v_audit_delivery_sem_saida_estoque"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v_audit_devolucao_sem_entrada_estoque"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_reasons: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          reason_group: string
          require_note: boolean | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          reason_group: string
          require_note?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          reason_group?: string
          require_note?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_reasons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_route_orders: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          company_id: string
          id: string
          loading_status: string | null
          partial_payload: Json | null
          position: number
          return_outcome: string | null
          return_outcome_type: string | null
          return_payload: Json | null
          return_updated_at: string | null
          route_id: string
          sales_document_id: string
          volumes: number | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          company_id: string
          id?: string
          loading_status?: string | null
          partial_payload?: Json | null
          position?: number
          return_outcome?: string | null
          return_outcome_type?: string | null
          return_payload?: Json | null
          return_updated_at?: string | null
          route_id: string
          sales_document_id: string
          volumes?: number | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          company_id?: string
          id?: string
          loading_status?: string | null
          partial_payload?: Json | null
          position?: number
          return_outcome?: string | null
          return_outcome_type?: string | null
          return_payload?: Json | null
          return_updated_at?: string | null
          route_id?: string
          sales_document_id?: string
          volumes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_route_orders_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_route_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_route_orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_route_orders_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_routes: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          route_date: string
          scheduled_date: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          route_date?: string
          scheduled_date?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          route_date?: string
          scheduled_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_routes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_routes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_event_allocations: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          source_event_id: string
          target_title_id: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          source_event_id: string
          target_title_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          source_event_id?: string
          target_title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_event_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_event_allocations_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "financial_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_event_allocations_target_title_id_fkey"
            columns: ["target_title_id"]
            isOneToOne: false
            referencedRelation: "ar_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_event_installments: {
        Row: {
          amount: number
          category_id: string | null
          cost_center_id: string | null
          created_at: string | null
          due_date: string
          event_id: string
          financial_account_id: string | null
          id: string
          installment_number: number
          notes: string | null
          payment_condition: string | null
          payment_method: string | null
          suggested_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          due_date: string
          event_id: string
          financial_account_id?: string | null
          id?: string
          installment_number: number
          notes?: string | null
          payment_condition?: string | null
          payment_method?: string | null
          suggested_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          due_date?: string
          event_id?: string
          financial_account_id?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          payment_condition?: string | null
          payment_method?: string | null
          suggested_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_event_installments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "financial_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_event_installments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_installment_account"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_events: {
        Row: {
          approval_snapshot: Json | null
          approved_at: string | null
          approved_by: string | null
          attention_marked_at: string | null
          attention_marked_by: string | null
          attention_reason: string | null
          company_id: string
          created_at: string | null
          direction: string
          id: string
          issue_date: string
          notes: string | null
          operational_status: string | null
          origin_id: string | null
          origin_reference: string | null
          origin_type: string
          partner_id: string | null
          partner_name: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          approval_snapshot?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          attention_marked_at?: string | null
          attention_marked_by?: string | null
          attention_reason?: string | null
          company_id: string
          created_at?: string | null
          direction: string
          id?: string
          issue_date: string
          notes?: string | null
          operational_status?: string | null
          origin_id?: string | null
          origin_reference?: string | null
          origin_type: string
          partner_id?: string | null
          partner_name?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          approval_snapshot?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          attention_marked_at?: string | null
          attention_marked_by?: string | null
          attention_reason?: string | null
          company_id?: string
          created_at?: string | null
          direction?: string
          id?: string
          issue_date?: string
          notes?: string | null
          operational_status?: string | null
          origin_id?: string | null
          origin_reference?: string | null
          origin_type?: string
          partner_id?: string | null
          partner_name?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_settlements: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          settlement_date: string
          total_amount: number
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          settlement_date?: string
          total_amount?: number
          type: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          settlement_date?: string
          total_amount?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_settlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_operations: {
        Row: {
          cfop: string
          cofins_applies: boolean | null
          cofins_cst: string | null
          cofins_rate_percent: number | null
          company_id: string
          created_at: string | null
          customer_ie_indicator: string
          customer_is_final_consumer: boolean
          deleted_at: string | null
          destination_state: string
          icms_csosn: string | null
          icms_cst: string | null
          icms_modal_bc: string | null
          icms_rate_percent: number
          icms_reduction_bc_percent: number | null
          icms_show_in_xml: boolean | null
          id: string
          ipi_applies: boolean | null
          ipi_cst: string | null
          ipi_rate_percent: number | null
          is_active: boolean | null
          operation_type: string
          pis_applies: boolean | null
          pis_cst: string | null
          pis_rate_percent: number | null
          st_applies: boolean | null
          st_fcp_percent: number | null
          st_modal_bc: string | null
          st_mva_percent: number | null
          st_rate_percent: number | null
          st_reduction_bc_percent: number | null
          tax_group_id: string
          uf_origem: string
          updated_at: string | null
        }
        Insert: {
          cfop: string
          cofins_applies?: boolean | null
          cofins_cst?: string | null
          cofins_rate_percent?: number | null
          company_id: string
          created_at?: string | null
          customer_ie_indicator: string
          customer_is_final_consumer?: boolean
          deleted_at?: string | null
          destination_state: string
          icms_csosn?: string | null
          icms_cst?: string | null
          icms_modal_bc?: string | null
          icms_rate_percent?: number
          icms_reduction_bc_percent?: number | null
          icms_show_in_xml?: boolean | null
          id?: string
          ipi_applies?: boolean | null
          ipi_cst?: string | null
          ipi_rate_percent?: number | null
          is_active?: boolean | null
          operation_type?: string
          pis_applies?: boolean | null
          pis_cst?: string | null
          pis_rate_percent?: number | null
          st_applies?: boolean | null
          st_fcp_percent?: number | null
          st_modal_bc?: string | null
          st_mva_percent?: number | null
          st_rate_percent?: number | null
          st_reduction_bc_percent?: number | null
          tax_group_id: string
          uf_origem?: string
          updated_at?: string | null
        }
        Update: {
          cfop?: string
          cofins_applies?: boolean | null
          cofins_cst?: string | null
          cofins_rate_percent?: number | null
          company_id?: string
          created_at?: string | null
          customer_ie_indicator?: string
          customer_is_final_consumer?: boolean
          deleted_at?: string | null
          destination_state?: string
          icms_csosn?: string | null
          icms_cst?: string | null
          icms_modal_bc?: string | null
          icms_rate_percent?: number
          icms_reduction_bc_percent?: number | null
          icms_show_in_xml?: boolean | null
          id?: string
          ipi_applies?: boolean | null
          ipi_cst?: string | null
          ipi_rate_percent?: number | null
          is_active?: boolean | null
          operation_type?: string
          pis_applies?: boolean | null
          pis_cst?: string | null
          pis_rate_percent?: number | null
          st_applies?: boolean | null
          st_fcp_percent?: number | null
          st_modal_bc?: string | null
          st_mva_percent?: number | null
          st_rate_percent?: number | null
          st_reduction_bc_percent?: number | null
          tax_group_id?: string
          uf_origem?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_operations_tax_group_id_fkey"
            columns: ["tax_group_id"]
            isOneToOne: false
            referencedRelation: "tax_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_accounts: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          company_id: string
          conversion_factor: number | null
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          movement_type: string | null
          notes: string | null
          occurred_at: string
          qty_base: number
          qty_display: number | null
          qty_in: number | null
          qty_out: number | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          source_ref: string | null
          total_cost: number
          unit_cost: number
          uom_label: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          movement_type?: string | null
          notes?: string | null
          occurred_at?: string
          qty_base?: number
          qty_display?: number | null
          qty_in?: number | null
          qty_out?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source_ref?: string | null
          total_cost?: number
          unit_cost?: number
          uom_label?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          movement_type?: string | null
          notes?: string | null
          occurred_at?: string
          qty_base?: number
          qty_display?: number | null
          qty_in?: number | null
          qty_out?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source_ref?: string | null
          total_cost?: number
          unit_cost?: number
          uom_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_fiscal_profiles: {
        Row: {
          cest: string | null
          cfop_code: string | null
          cfop_default: string | null
          cofins_rate: number | null
          company_id: string
          created_at: string
          has_fiscal_output: boolean
          icms_rate: number | null
          id: string
          ipi_rate: number | null
          item_id: string
          ncm: string | null
          origin: number | null
          pis_rate: number | null
          tax_group_id: string | null
          updated_at: string
        }
        Insert: {
          cest?: string | null
          cfop_code?: string | null
          cfop_default?: string | null
          cofins_rate?: number | null
          company_id: string
          created_at?: string
          has_fiscal_output?: boolean
          icms_rate?: number | null
          id?: string
          ipi_rate?: number | null
          item_id: string
          ncm?: string | null
          origin?: number | null
          pis_rate?: number | null
          tax_group_id?: string | null
          updated_at?: string
        }
        Update: {
          cest?: string | null
          cfop_code?: string | null
          cfop_default?: string | null
          cofins_rate?: number | null
          company_id?: string
          created_at?: string
          has_fiscal_output?: boolean
          icms_rate?: number | null
          id?: string
          ipi_rate?: number | null
          item_id?: string
          ncm?: string | null
          origin?: number | null
          pis_rate?: number | null
          tax_group_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_fiscal_profiles_cfop_code_fkey"
            columns: ["cfop_code"]
            isOneToOne: false
            referencedRelation: "cfops"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "item_fiscal_profiles_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_inventory_profiles: {
        Row: {
          company_id: string
          control_batch: boolean
          control_expiry: boolean
          control_stock: boolean
          created_at: string
          default_location: string | null
          id: string
          item_id: string
          max_stock: number | null
          min_stock: number | null
          reorder_point: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          control_batch?: boolean
          control_expiry?: boolean
          control_stock?: boolean
          created_at?: string
          default_location?: string | null
          id?: string
          item_id: string
          max_stock?: number | null
          min_stock?: number | null
          reorder_point?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          control_batch?: boolean
          control_expiry?: boolean
          control_stock?: boolean
          created_at?: string
          default_location?: string | null
          id?: string
          item_id?: string
          max_stock?: number | null
          min_stock?: number | null
          reorder_point?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      item_packaging: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          gross_weight_kg: number | null
          gtin_ean: string | null
          height_cm: number | null
          id: string
          is_active: boolean
          is_default_sales_unit: boolean
          item_id: string
          label: string
          length_cm: number | null
          net_weight_kg: number | null
          qty_in_base: number
          sell_uom_id: string | null
          type: string
          uom_id: string | null
          updated_at: string
          width_cm: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          gross_weight_kg?: number | null
          gtin_ean?: string | null
          height_cm?: number | null
          id?: string
          is_active?: boolean
          is_default_sales_unit?: boolean
          item_id: string
          label: string
          length_cm?: number | null
          net_weight_kg?: number | null
          qty_in_base: number
          sell_uom_id?: string | null
          type: string
          uom_id?: string | null
          updated_at?: string
          width_cm?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          gross_weight_kg?: number | null
          gtin_ean?: string | null
          height_cm?: number | null
          id?: string
          is_active?: boolean
          is_default_sales_unit?: boolean
          item_id?: string
          label?: string
          length_cm?: number | null
          net_weight_kg?: number | null
          qty_in_base?: number
          sell_uom_id?: string | null
          type?: string
          uom_id?: string | null
          updated_at?: string
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_packaging_sell_uom_id_fkey"
            columns: ["sell_uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_packaging_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
        ]
      }
      item_production_profiles: {
        Row: {
          batch_size: number | null
          company_id: string
          created_at: string
          default_bom_id: string | null
          id: string
          is_produced: boolean
          item_id: string
          loss_percent: number | null
          notes: string | null
          production_uom: string | null
          production_uom_id: string | null
          updated_at: string
        }
        Insert: {
          batch_size?: number | null
          company_id: string
          created_at?: string
          default_bom_id?: string | null
          id?: string
          is_produced?: boolean
          item_id: string
          loss_percent?: number | null
          notes?: string | null
          production_uom?: string | null
          production_uom_id?: string | null
          updated_at?: string
        }
        Update: {
          batch_size?: number | null
          company_id?: string
          created_at?: string
          default_bom_id?: string | null
          id?: string
          is_produced?: boolean
          item_id?: string
          loss_percent?: number | null
          notes?: string | null
          production_uom?: string | null
          production_uom_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_production_profiles_production_uom_id_fkey"
            columns: ["production_uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
        ]
      }
      item_purchase_profiles: {
        Row: {
          company_id: string
          conversion_factor: number | null
          created_at: string
          default_purchase_packaging_id: string | null
          id: string
          item_id: string
          lead_time_days: number | null
          notes: string | null
          preferred_supplier_id: string | null
          purchase_uom: string | null
          purchase_uom_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          conversion_factor?: number | null
          created_at?: string
          default_purchase_packaging_id?: string | null
          id?: string
          item_id: string
          lead_time_days?: number | null
          notes?: string | null
          preferred_supplier_id?: string | null
          purchase_uom?: string | null
          purchase_uom_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          conversion_factor?: number | null
          created_at?: string
          default_purchase_packaging_id?: string | null
          id?: string
          item_id?: string
          lead_time_days?: number | null
          notes?: string | null
          preferred_supplier_id?: string | null
          purchase_uom?: string | null
          purchase_uom_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_purchase_profiles_default_purchase_packaging_id_fkey"
            columns: ["default_purchase_packaging_id"]
            isOneToOne: false
            referencedRelation: "item_packaging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_purchase_profiles_purchase_uom_id_fkey"
            columns: ["purchase_uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
        ]
      }
      item_sales_profiles: {
        Row: {
          company_id: string
          created_at: string
          default_commission_percent: number | null
          default_price_list_id: string | null
          id: string
          is_sellable: boolean
          item_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_commission_percent?: number | null
          default_price_list_id?: string | null
          id?: string
          is_sellable?: boolean
          item_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_commission_percent?: number | null
          default_price_list_id?: string | null
          id?: string
          is_sellable?: boolean
          item_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          avg_cost: number
          brand: string | null
          category_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          gross_weight_g_base: number | null
          gross_weight_kg_base: number | null
          gtin_ean_base: string | null
          height_base: number | null
          id: string
          image_url: string | null
          is_active: boolean
          length_base: number | null
          line: string | null
          name: string
          net_weight_g_base: number | null
          net_weight_kg_base: number | null
          packaging_id: string | null
          sku: string | null
          type: string
          uom: string
          uom_id: string | null
          updated_at: string
          width_base: number | null
        }
        Insert: {
          avg_cost?: number
          brand?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          gross_weight_g_base?: number | null
          gross_weight_kg_base?: number | null
          gtin_ean_base?: string | null
          height_base?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          length_base?: number | null
          line?: string | null
          name: string
          net_weight_g_base?: number | null
          net_weight_kg_base?: number | null
          packaging_id?: string | null
          sku?: string | null
          type: string
          uom: string
          uom_id?: string | null
          updated_at?: string
          width_base?: number | null
        }
        Update: {
          avg_cost?: number
          brand?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          gross_weight_g_base?: number | null
          gross_weight_kg_base?: number | null
          gtin_ean_base?: string | null
          height_base?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          length_base?: number | null
          line?: string | null
          name?: string
          net_weight_g_base?: number | null
          net_weight_kg_base?: number | null
          packaging_id?: string | null
          sku?: string | null
          type?: string
          uom?: string
          uom_id?: string | null
          updated_at?: string
          width_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "item_packaging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "uoms"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number
          payload: Json
          scheduled_for: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: []
      }
      nfe_emissions: {
        Row: {
          access_key: string
          attempts: number | null
          authorized_at: string | null
          c_stat: string | null
          company_id: string
          created_at: string | null
          dh_recbto: string | null
          digest_value: string | null
          error_message: string | null
          id: string
          id_lote: string | null
          ind_sinc: string | null
          last_attempt_at: string | null
          modelo: string | null
          n_prot: string | null
          n_recibo: string | null
          numero: string
          sales_document_id: string | null
          serie: string
          status: string
          tp_amb: string
          uf: string | null
          updated_at: string | null
          x_motivo: string | null
          xml_nfe_proc: string | null
          xml_sent: string | null
          xml_signed: string
          xml_unsigned: string | null
        }
        Insert: {
          access_key: string
          attempts?: number | null
          authorized_at?: string | null
          c_stat?: string | null
          company_id: string
          created_at?: string | null
          dh_recbto?: string | null
          digest_value?: string | null
          error_message?: string | null
          id?: string
          id_lote?: string | null
          ind_sinc?: string | null
          last_attempt_at?: string | null
          modelo?: string | null
          n_prot?: string | null
          n_recibo?: string | null
          numero: string
          sales_document_id?: string | null
          serie: string
          status?: string
          tp_amb: string
          uf?: string | null
          updated_at?: string | null
          x_motivo?: string | null
          xml_nfe_proc?: string | null
          xml_sent?: string | null
          xml_signed: string
          xml_unsigned?: string | null
        }
        Update: {
          access_key?: string
          attempts?: number | null
          authorized_at?: string | null
          c_stat?: string | null
          company_id?: string
          created_at?: string | null
          dh_recbto?: string | null
          digest_value?: string | null
          error_message?: string | null
          id?: string
          id_lote?: string | null
          ind_sinc?: string | null
          last_attempt_at?: string | null
          modelo?: string | null
          n_prot?: string | null
          n_recibo?: string | null
          numero?: string
          sales_document_id?: string | null
          serie?: string
          status?: string
          tp_amb?: string
          uf?: string | null
          updated_at?: string | null
          x_motivo?: string | null
          xml_nfe_proc?: string | null
          xml_sent?: string | null
          xml_signed?: string
          xml_unsigned?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_emissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_emissions_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      order_delivery_events: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          event_type: string
          id: string
          note: string | null
          order_id: string
          payload: Json | null
          processed_at: string | null
          processed_by: string | null
          processing_result: Json | null
          reason_id: string | null
          route_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          event_type: string
          id?: string
          note?: string | null
          order_id: string
          payload?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          processing_result?: Json | null
          reason_id?: string | null
          route_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          note?: string | null
          order_id?: string
          payload?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          processing_result?: Json | null
          reason_id?: string | null
          route_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_delivery_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delivery_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delivery_events_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "delivery_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delivery_events_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_pending_balances: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          order_id: string
          order_item_id: string
          qty_pending: number
          status: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          order_id: string
          order_item_id: string
          qty_pending?: number
          status: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          order_id?: string
          order_item_id?: string
          qty_pending?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_pending_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_pending_balances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_pending_balances_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "order_item_pending_balances_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "order_item_pending_balances_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "order_item_pending_balances_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_occurrence_logs: {
        Row: {
          actions_applied: Json | null
          created_at: string | null
          created_by_user_id: string | null
          id: string
          note: string | null
          order_id: string
          reason_id: string | null
          reason_label_snapshot: string | null
          route_id: string | null
          type_code: string
        }
        Insert: {
          actions_applied?: Json | null
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          note?: string | null
          order_id: string
          reason_id?: string | null
          reason_label_snapshot?: string | null
          route_id?: string | null
          type_code: string
        }
        Update: {
          actions_applied?: Json | null
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          note?: string | null
          order_id?: string
          reason_id?: string | null
          reason_label_snapshot?: string | null
          route_id?: string | null
          type_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_occurrence_logs_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "system_occurrence_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_branches: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          default_payment_terms_days: number | null
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          default_payment_terms_days?: number | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          default_payment_terms_days?: number | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_roles: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          organization_id: string
          role: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          organization_id: string
          role: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_organization_roles_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_organization_roles_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          company_id: string
          country_code: string
          created_at: string | null
          credit_limit: number | null
          default_account_id: string | null
          default_cfop: string | null
          default_cost_center_id: string | null
          default_discount: number | null
          default_operation_nature: string | null
          default_payment_terms_days: number | null
          deleted_at: string | null
          delivery_terms: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          email_nfe: string | null
          final_consumer: boolean | null
          freight_terms: string | null
          icms_contributor: boolean | null
          id: string
          ie: string | null
          ie_indicator: string
          ie_last_checked_at: string | null
          ie_sefaz_status: string | null
          ie_source: string | null
          is_final_consumer: boolean | null
          is_ie_exempt: boolean | null
          is_public_agency: boolean | null
          is_simple_national: boolean | null
          lead_time_days: number | null
          legal_name: string | null
          minimum_order_value: number | null
          municipal_registration: string | null
          notes: string | null
          notes_commercial: string | null
          notes_fiscal: string | null
          payment_mode_id: string | null
          payment_terms_id: string | null
          phone: string | null
          preferred_carrier_id: string | null
          price_table_id: string | null
          public_agency_code: string | null
          public_agency_sphere: string | null
          purchase_payment_terms_id: string | null
          region_route: string | null
          sales_channel: string | null
          sales_rep_user_id: string | null
          state_registration: string | null
          status: string
          suframa: string | null
          tax_regime: string | null
          trade_name: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          country_code?: string
          created_at?: string | null
          credit_limit?: number | null
          default_account_id?: string | null
          default_cfop?: string | null
          default_cost_center_id?: string | null
          default_discount?: number | null
          default_operation_nature?: string | null
          default_payment_terms_days?: number | null
          deleted_at?: string | null
          delivery_terms?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          email_nfe?: string | null
          final_consumer?: boolean | null
          freight_terms?: string | null
          icms_contributor?: boolean | null
          id?: string
          ie?: string | null
          ie_indicator?: string
          ie_last_checked_at?: string | null
          ie_sefaz_status?: string | null
          ie_source?: string | null
          is_final_consumer?: boolean | null
          is_ie_exempt?: boolean | null
          is_public_agency?: boolean | null
          is_simple_national?: boolean | null
          lead_time_days?: number | null
          legal_name?: string | null
          minimum_order_value?: number | null
          municipal_registration?: string | null
          notes?: string | null
          notes_commercial?: string | null
          notes_fiscal?: string | null
          payment_mode_id?: string | null
          payment_terms_id?: string | null
          phone?: string | null
          preferred_carrier_id?: string | null
          price_table_id?: string | null
          public_agency_code?: string | null
          public_agency_sphere?: string | null
          purchase_payment_terms_id?: string | null
          region_route?: string | null
          sales_channel?: string | null
          sales_rep_user_id?: string | null
          state_registration?: string | null
          status?: string
          suframa?: string | null
          tax_regime?: string | null
          trade_name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          country_code?: string
          created_at?: string | null
          credit_limit?: number | null
          default_account_id?: string | null
          default_cfop?: string | null
          default_cost_center_id?: string | null
          default_discount?: number | null
          default_operation_nature?: string | null
          default_payment_terms_days?: number | null
          deleted_at?: string | null
          delivery_terms?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          email_nfe?: string | null
          final_consumer?: boolean | null
          freight_terms?: string | null
          icms_contributor?: boolean | null
          id?: string
          ie?: string | null
          ie_indicator?: string
          ie_last_checked_at?: string | null
          ie_sefaz_status?: string | null
          ie_source?: string | null
          is_final_consumer?: boolean | null
          is_ie_exempt?: boolean | null
          is_public_agency?: boolean | null
          is_simple_national?: boolean | null
          lead_time_days?: number | null
          legal_name?: string | null
          minimum_order_value?: number | null
          municipal_registration?: string | null
          notes?: string | null
          notes_commercial?: string | null
          notes_fiscal?: string | null
          payment_mode_id?: string | null
          payment_terms_id?: string | null
          phone?: string | null
          preferred_carrier_id?: string | null
          price_table_id?: string | null
          public_agency_code?: string | null
          public_agency_sphere?: string | null
          purchase_payment_terms_id?: string | null
          region_route?: string | null
          sales_channel?: string | null
          sales_rep_user_id?: string | null
          state_registration?: string | null
          status?: string
          suframa?: string | null
          tax_regime?: string | null
          trade_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_default_cost_center_id_fkey"
            columns: ["default_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_payment_mode_id_fkey"
            columns: ["payment_mode_id"]
            isOneToOne: false
            referencedRelation: "payment_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_payment_terms_id_fkey"
            columns: ["payment_terms_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_preferred_carrier_id_fkey"
            columns: ["preferred_carrier_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_purchase_payment_terms_id_fkey"
            columns: ["purchase_payment_terms_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      packaging_types: {
        Row: {
          code: string
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packaging_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_modes: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      payment_terms: {
        Row: {
          cadence_days: number | null
          company_id: string
          created_at: string | null
          deleted_at: string | null
          first_due_days: number
          id: string
          installments_count: number
          is_active: boolean
          is_custom_name: boolean
          min_installment_amount: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          cadence_days?: number | null
          company_id: string
          created_at?: string | null
          deleted_at?: string | null
          first_due_days?: number
          id?: string
          installments_count?: number
          is_active?: boolean
          is_custom_name?: boolean
          min_installment_amount?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          cadence_days?: number | null
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          first_due_days?: number
          id?: string
          installments_count?: number
          is_active?: boolean
          is_custom_name?: boolean
          min_installment_amount?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string | null
          deleted_at: string | null
          departments: string[] | null
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          notes: string | null
          organization_id: string
          phone: string | null
          role_title: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string | null
          deleted_at?: string | null
          departments?: string[] | null
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          organization_id: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          departments?: string[] | null
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          organization_id?: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "organization_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      price_table_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          price: number | null
          price_table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          price?: number | null
          price_table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          price?: number | null
          price_table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_table_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_table_items_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      price_tables: {
        Row: {
          active: boolean
          commission_pct: number | null
          company_id: string
          created_at: string
          customer_profiles: string[] | null
          effective_date: string
          freight_included: boolean
          id: string
          internal_notes: string | null
          is_active: boolean
          min_order_value: number | null
          name: string
          states: string[] | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          commission_pct?: number | null
          company_id: string
          created_at?: string
          customer_profiles?: string[] | null
          effective_date?: string
          freight_included?: boolean
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          min_order_value?: number | null
          name: string
          states?: string[] | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          commission_pct?: number | null
          company_id?: string
          created_at?: string
          customer_profiles?: string[] | null
          effective_date?: string
          freight_included?: boolean
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          min_order_value?: number | null
          name?: string
          states?: string[] | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_tables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          company_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          labels_count: number | null
          order_id: string | null
          route_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          labels_count?: number | null
          order_id?: string | null
          route_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          labels_count?: number | null
          order_id?: string | null
          route_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          name: string
          normalized_name: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          normalized_name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          normalized_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          company_id: string
          conversion_factor: number
          created_at: string
          discount_amount: number | null
          id: string
          item_id: string
          notes: string | null
          packaging_id: string | null
          purchase_order_id: string
          qty_base: number
          qty_display: number
          total_cost: number | null
          unit_cost: number | null
          uom_label: string
          updated_at: string
        }
        Insert: {
          company_id: string
          conversion_factor?: number
          created_at?: string
          discount_amount?: number | null
          id?: string
          item_id: string
          notes?: string | null
          packaging_id?: string | null
          purchase_order_id: string
          qty_base: number
          qty_display: number
          total_cost?: number | null
          unit_cost?: number | null
          uom_label: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          conversion_factor?: number
          created_at?: string
          discount_amount?: number | null
          id?: string
          item_id?: string
          notes?: string | null
          packaging_id?: string | null
          purchase_order_id?: string
          qty_base?: number
          qty_display?: number
          total_cost?: number | null
          unit_cost?: number | null
          uom_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "item_packaging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          delivery_address_json: Json | null
          discount_amount: number | null
          document_number: number | null
          expected_at: string | null
          freight_amount: number | null
          id: string
          notes: string | null
          ordered_at: string
          payment_mode_id: string | null
          payment_terms_id: string | null
          price_table_id: string | null
          receipt_notes: string | null
          received_at: string | null
          received_by: string | null
          receiving_blocked: boolean
          receiving_blocked_at: string | null
          receiving_blocked_by: string | null
          receiving_blocked_reason: string | null
          status: string
          subtotal_amount: number | null
          supplier_id: string | null
          supplier_invoice_date: string | null
          supplier_invoice_number: string | null
          supplier_invoice_series: string | null
          total_amount: number | null
          total_gross_weight_kg: number | null
          total_weight_kg: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_address_json?: Json | null
          discount_amount?: number | null
          document_number?: number | null
          expected_at?: string | null
          freight_amount?: number | null
          id?: string
          notes?: string | null
          ordered_at?: string
          payment_mode_id?: string | null
          payment_terms_id?: string | null
          price_table_id?: string | null
          receipt_notes?: string | null
          received_at?: string | null
          received_by?: string | null
          receiving_blocked?: boolean
          receiving_blocked_at?: string | null
          receiving_blocked_by?: string | null
          receiving_blocked_reason?: string | null
          status?: string
          subtotal_amount?: number | null
          supplier_id?: string | null
          supplier_invoice_date?: string | null
          supplier_invoice_number?: string | null
          supplier_invoice_series?: string | null
          total_amount?: number | null
          total_gross_weight_kg?: number | null
          total_weight_kg?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivery_address_json?: Json | null
          discount_amount?: number | null
          document_number?: number | null
          expected_at?: string | null
          freight_amount?: number | null
          id?: string
          notes?: string | null
          ordered_at?: string
          payment_mode_id?: string | null
          payment_terms_id?: string | null
          price_table_id?: string | null
          receipt_notes?: string | null
          received_at?: string | null
          received_by?: string | null
          receiving_blocked?: boolean
          receiving_blocked_at?: string | null
          receiving_blocked_by?: string | null
          receiving_blocked_reason?: string | null
          status?: string
          subtotal_amount?: number | null
          supplier_id?: string | null
          supplier_invoice_date?: string | null
          supplier_invoice_number?: string | null
          supplier_invoice_series?: string | null
          total_amount?: number | null
          total_gross_weight_kg?: number | null
          total_weight_kg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_payment_mode_id_fkey"
            columns: ["payment_mode_id"]
            isOneToOne: false
            referencedRelation: "payment_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_payment_terms_id_fkey"
            columns: ["payment_terms_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_sequences: {
        Row: {
          company_id: string
          last_number: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          last_number?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          last_number?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      route_event_logs: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          event_code: string
          id: string
          payload: Json | null
          route_id: string
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          event_code: string
          id?: string
          payload?: Json | null
          route_id: string
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          event_code?: string
          id?: string
          payload?: Json | null
          route_id?: string
        }
        Relationships: []
      }
      sales_document_adjustments: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          reason: string | null
          sales_document_id: string
          type: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string | null
          sales_document_id: string
          type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string | null
          sales_document_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_document_adjustments_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_document_events: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          document_id: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          document_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          document_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      sales_document_finance_events: {
        Row: {
          changed_by: string | null
          company_id: string
          created_at: string | null
          from_status: string
          id: string
          reason: string | null
          sales_document_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          company_id: string
          created_at?: string | null
          from_status: string
          id?: string
          reason?: string | null
          sales_document_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          company_id?: string
          created_at?: string | null
          from_status?: string
          id?: string
          reason?: string | null
          sales_document_id?: string
          to_status?: string
        }
        Relationships: []
      }
      sales_document_issues: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          issue_type: string
          payload: Json | null
          resolved_at: string | null
          resolved_by: string | null
          sales_document_id: string
          severity: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          issue_type: string
          payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          sales_document_id: string
          severity: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          issue_type?: string
          payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          sales_document_id?: string
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_document_issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_issues_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_document_item_cuts: {
        Row: {
          client_request_id: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          discount_snapshot: number | null
          id: string
          note: string | null
          qty_cut: number
          reason_id: string | null
          sales_document_id: string
          sales_document_item_id: string
          total_cut_snapshot: number | null
          unit_price_snapshot: number | null
        }
        Insert: {
          client_request_id?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          discount_snapshot?: number | null
          id?: string
          note?: string | null
          qty_cut: number
          reason_id?: string | null
          sales_document_id: string
          sales_document_item_id: string
          total_cut_snapshot?: number | null
          unit_price_snapshot?: number | null
        }
        Update: {
          client_request_id?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          discount_snapshot?: number | null
          id?: string
          note?: string | null
          qty_cut?: number
          reason_id?: string | null
          sales_document_id?: string
          sales_document_item_id?: string
          total_cut_snapshot?: number | null
          unit_price_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_document_item_cuts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_item_cuts_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_item_cuts_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "sales_document_item_cuts_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "sales_document_item_cuts_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "sales_document_item_cuts_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_document_items: {
        Row: {
          base_uom_abbrev_snapshot: string | null
          cest_snapshot: string | null
          cfop_code: string | null
          cofins_aliquot: number | null
          cofins_cst: string | null
          cofins_value: number | null
          company_id: string
          conversion_factor_snapshot: number | null
          created_at: string | null
          csosn: string | null
          cst_icms: string | null
          discount_amount: number | null
          document_id: string
          fiscal_notes: string | null
          fiscal_operation_id: string | null
          fiscal_status: string | null
          id: string
          ipi_aliquot: number | null
          ipi_applies: boolean | null
          ipi_cst: string | null
          ipi_value: number | null
          item_id: string
          ncm_snapshot: string | null
          notes: string | null
          origin_snapshot: number | null
          packaging_id: string | null
          pis_aliquot: number | null
          pis_cst: string | null
          pis_value: number | null
          qty_base: number | null
          quantity: number
          sales_unit_label_snapshot: string | null
          sales_unit_snapshot: Json | null
          sales_uom_abbrev_snapshot: string | null
          st_aliquot: number | null
          st_applies: boolean | null
          st_value: number | null
          total_amount: number | null
          total_weight_kg: number | null
          unit_price: number
          unit_weight_kg: number | null
          weight_snapshot: Json | null
          weight_source: string | null
        }
        Insert: {
          base_uom_abbrev_snapshot?: string | null
          cest_snapshot?: string | null
          cfop_code?: string | null
          cofins_aliquot?: number | null
          cofins_cst?: string | null
          cofins_value?: number | null
          company_id: string
          conversion_factor_snapshot?: number | null
          created_at?: string | null
          csosn?: string | null
          cst_icms?: string | null
          discount_amount?: number | null
          document_id: string
          fiscal_notes?: string | null
          fiscal_operation_id?: string | null
          fiscal_status?: string | null
          id?: string
          ipi_aliquot?: number | null
          ipi_applies?: boolean | null
          ipi_cst?: string | null
          ipi_value?: number | null
          item_id: string
          ncm_snapshot?: string | null
          notes?: string | null
          origin_snapshot?: number | null
          packaging_id?: string | null
          pis_aliquot?: number | null
          pis_cst?: string | null
          pis_value?: number | null
          qty_base?: number | null
          quantity: number
          sales_unit_label_snapshot?: string | null
          sales_unit_snapshot?: Json | null
          sales_uom_abbrev_snapshot?: string | null
          st_aliquot?: number | null
          st_applies?: boolean | null
          st_value?: number | null
          total_amount?: number | null
          total_weight_kg?: number | null
          unit_price: number
          unit_weight_kg?: number | null
          weight_snapshot?: Json | null
          weight_source?: string | null
        }
        Update: {
          base_uom_abbrev_snapshot?: string | null
          cest_snapshot?: string | null
          cfop_code?: string | null
          cofins_aliquot?: number | null
          cofins_cst?: string | null
          cofins_value?: number | null
          company_id?: string
          conversion_factor_snapshot?: number | null
          created_at?: string | null
          csosn?: string | null
          cst_icms?: string | null
          discount_amount?: number | null
          document_id?: string
          fiscal_notes?: string | null
          fiscal_operation_id?: string | null
          fiscal_status?: string | null
          id?: string
          ipi_aliquot?: number | null
          ipi_applies?: boolean | null
          ipi_cst?: string | null
          ipi_value?: number | null
          item_id?: string
          ncm_snapshot?: string | null
          notes?: string | null
          origin_snapshot?: number | null
          packaging_id?: string | null
          pis_aliquot?: number | null
          pis_cst?: string | null
          pis_value?: number | null
          qty_base?: number | null
          quantity?: number
          sales_unit_label_snapshot?: string | null
          sales_unit_snapshot?: Json | null
          sales_uom_abbrev_snapshot?: string | null
          st_aliquot?: number | null
          st_applies?: boolean | null
          st_value?: number | null
          total_amount?: number | null
          total_weight_kg?: number | null
          unit_price?: number
          unit_weight_kg?: number | null
          weight_snapshot?: Json | null
          weight_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_item_product"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "item_packaging"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_document_nfes: {
        Row: {
          created_at: string | null
          details: Json | null
          document_id: string
          draft_snapshot: Json | null
          id: string
          is_antecipada: boolean | null
          issued_at: string | null
          nfe_key: string | null
          nfe_number: number | null
          nfe_series: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          document_id: string
          draft_snapshot?: Json | null
          id?: string
          is_antecipada?: boolean | null
          issued_at?: string | null
          nfe_key?: string | null
          nfe_number?: number | null
          nfe_series?: number | null
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          document_id?: string
          draft_snapshot?: Json | null
          id?: string
          is_antecipada?: boolean | null
          issued_at?: string | null
          nfe_key?: string | null
          nfe_number?: number | null
          nfe_series?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_document_nfes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_document_payments: {
        Row: {
          amount: number
          created_at: string | null
          document_id: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          document_id: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          document_id?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_document_payments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_documents: {
        Row: {
          carrier_id: string | null
          client_id: string
          client_notes: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          date_issue: string
          date_issued: string | null
          deleted_at: string | null
          delivery_address_json: Json | null
          delivery_date: string | null
          discount_amount: number | null
          dispatch_blocked: boolean
          dispatch_blocked_at: string | null
          dispatch_blocked_by: string | null
          dispatch_blocked_reason: string | null
          doc_type: string
          document_number: number | null
          financial_status: Database["public"]["Enums"]["financial_status_enum"]
          freight_amount: number | null
          freight_mode: string | null
          id: string
          internal_notes: string | null
          is_antecipada: boolean | null
          loading_checked: boolean | null
          loading_checked_at: string | null
          loading_checked_by: string | null
          payment_mode_id: string | null
          payment_terms_id: string | null
          price_table_id: string | null
          route_tag: string | null
          sales_rep_id: string | null
          scheduled_delivery_date: string | null
          status_commercial: Database["public"]["Enums"]["sales_commercial_status"]
          status_finance: string
          status_fiscal: string
          status_logistic: Database["public"]["Enums"]["sales_logistic_status"]
          subtotal_amount: number | null
          total_amount: number | null
          total_gross_weight_kg: number | null
          total_weight_kg: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          carrier_id?: string | null
          client_id: string
          client_notes?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          date_issue?: string
          date_issued?: string | null
          deleted_at?: string | null
          delivery_address_json?: Json | null
          delivery_date?: string | null
          discount_amount?: number | null
          dispatch_blocked?: boolean
          dispatch_blocked_at?: string | null
          dispatch_blocked_by?: string | null
          dispatch_blocked_reason?: string | null
          doc_type: string
          document_number?: number | null
          financial_status: Database["public"]["Enums"]["financial_status_enum"]
          freight_amount?: number | null
          freight_mode?: string | null
          id?: string
          internal_notes?: string | null
          is_antecipada?: boolean | null
          loading_checked?: boolean | null
          loading_checked_at?: string | null
          loading_checked_by?: string | null
          payment_mode_id?: string | null
          payment_terms_id?: string | null
          price_table_id?: string | null
          route_tag?: string | null
          sales_rep_id?: string | null
          scheduled_delivery_date?: string | null
          status_commercial: Database["public"]["Enums"]["sales_commercial_status"]
          status_finance?: string
          status_fiscal?: string
          status_logistic: Database["public"]["Enums"]["sales_logistic_status"]
          subtotal_amount?: number | null
          total_amount?: number | null
          total_gross_weight_kg?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          carrier_id?: string | null
          client_id?: string
          client_notes?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          date_issue?: string
          date_issued?: string | null
          deleted_at?: string | null
          delivery_address_json?: Json | null
          delivery_date?: string | null
          discount_amount?: number | null
          dispatch_blocked?: boolean
          dispatch_blocked_at?: string | null
          dispatch_blocked_by?: string | null
          dispatch_blocked_reason?: string | null
          doc_type?: string
          document_number?: number | null
          financial_status?: Database["public"]["Enums"]["financial_status_enum"]
          freight_amount?: number | null
          freight_mode?: string | null
          id?: string
          internal_notes?: string | null
          is_antecipada?: boolean | null
          loading_checked?: boolean | null
          loading_checked_at?: string | null
          loading_checked_by?: string | null
          payment_mode_id?: string | null
          payment_terms_id?: string | null
          price_table_id?: string | null
          route_tag?: string | null
          sales_rep_id?: string | null
          scheduled_delivery_date?: string | null
          status_commercial?: Database["public"]["Enums"]["sales_commercial_status"]
          status_finance?: string
          status_fiscal?: string
          status_logistic?: Database["public"]["Enums"]["sales_logistic_status"]
          subtotal_amount?: number | null
          total_amount?: number | null
          total_gross_weight_kg?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_doc_payment_terms"
            columns: ["payment_terms_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sales_doc_price_table"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_payment_terms_id_fkey"
            columns: ["payment_terms_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_sequences: {
        Row: {
          company_id: string
          last_number: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          last_number?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          last_number?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_occurrence_reason_defaults: {
        Row: {
          allow_override: boolean | null
          create_complement_order: boolean | null
          create_devolution: boolean | null
          create_new_order_for_pending: boolean | null
          created_at: string | null
          default_actions: Json | null
          id: string
          reason_id: string
          register_attempt_note: boolean | null
          require_note: boolean | null
          return_to_sandbox_pending: boolean | null
          reverse_stock_and_finance: boolean | null
          updated_at: string | null
          write_internal_notes: boolean | null
        }
        Insert: {
          allow_override?: boolean | null
          create_complement_order?: boolean | null
          create_devolution?: boolean | null
          create_new_order_for_pending?: boolean | null
          created_at?: string | null
          default_actions?: Json | null
          id?: string
          reason_id: string
          register_attempt_note?: boolean | null
          require_note?: boolean | null
          return_to_sandbox_pending?: boolean | null
          reverse_stock_and_finance?: boolean | null
          updated_at?: string | null
          write_internal_notes?: boolean | null
        }
        Update: {
          allow_override?: boolean | null
          create_complement_order?: boolean | null
          create_devolution?: boolean | null
          create_new_order_for_pending?: boolean | null
          created_at?: string | null
          default_actions?: Json | null
          id?: string
          reason_id?: string
          register_attempt_note?: boolean | null
          require_note?: boolean | null
          return_to_sandbox_pending?: boolean | null
          reverse_stock_and_finance?: boolean | null
          updated_at?: string | null
          write_internal_notes?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "system_occurrence_reason_defaults_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "system_occurrence_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      system_occurrence_reasons: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          label: string
          sort_order: number | null
          type_code: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          label: string
          sort_order?: number | null
          type_code: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          label?: string
          sort_order?: number | null
          type_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_occurrence_reasons_type_code_fkey"
            columns: ["type_code"]
            isOneToOne: false
            referencedRelation: "system_occurrence_types"
            referencedColumns: ["code"]
          },
        ]
      }
      system_occurrence_types: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          id: string
          label: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          id?: string
          label: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          id?: string
          label?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tax_groups: {
        Row: {
          cest: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          ncm: string | null
          observation: string | null
          origin_default: number | null
          updated_at: string
        }
        Insert: {
          cest?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          ncm?: string | null
          observation?: string | null
          origin_default?: number | null
          updated_at?: string
        }
        Update: {
          cest?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          ncm?: string | null
          observation?: string | null
          origin_default?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      title_settlements: {
        Row: {
          amount: number
          created_at: string | null
          discount_amount: number | null
          id: string
          interest_amount: number | null
          penalty_amount: number | null
          settlement_id: string
          title_id: string
          title_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          interest_amount?: number | null
          penalty_amount?: number | null
          settlement_id: string
          title_id: string
          title_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          interest_amount?: number | null
          penalty_amount?: number | null
          settlement_id?: string
          title_id?: string
          title_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "title_settlements_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "financial_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      uoms: {
        Row: {
          abbrev: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          abbrev: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          abbrev?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          auth_user_id: string
          created_at: string
          full_name: string | null
          job_title: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          full_name?: string | null
          job_title?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          full_name?: string | null
          job_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          company_id: string
          created_at: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          role: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          deleted_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_consumptions: {
        Row: {
          company_id: string
          component_item_id: string
          id: string
          qty: number
          uom: string
          work_order_id: string
        }
        Insert: {
          company_id: string
          component_item_id: string
          id?: string
          qty: number
          uom: string
          work_order_id: string
        }
        Update: {
          company_id?: string
          component_item_id?: string
          id?: string
          qty?: number
          uom?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_consumptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_consumptions_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_consumptions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          bom_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          document_number: number | null
          finished_at: string | null
          id: string
          item_id: string
          notes: string | null
          planned_qty: number
          produced_qty: number
          route_id: string | null
          scheduled_date: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bom_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          document_number?: number | null
          finished_at?: string | null
          id?: string
          item_id: string
          notes?: string | null
          planned_qty: number
          produced_qty?: number
          route_id?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bom_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          document_number?: number | null
          finished_at?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          planned_qty?: number
          produced_qty?: number
          route_id?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      audit_dre_cost_zero_v1: {
        Row: {
          company_id: string | null
          id: string | null
          item_id: string | null
          reason: string | null
          total_cost: number | null
        }
        Insert: {
          company_id?: string | null
          id?: string | null
          item_id?: string | null
          reason?: string | null
          total_cost?: number | null
        }
        Update: {
          company_id?: string | null
          id?: string | null
          item_id?: string | null
          reason?: string | null
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_dre_double_count_delivery_v1: {
        Row: {
          company_id: string | null
          excess_qty: number | null
          order_id: string | null
          ordered_qty: number | null
          sales_item_id: string | null
          total_revenue_qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_dre_net_vs_gross_gap_v1: {
        Row: {
          company_id: string | null
          order_id: string | null
          total_discount_gap: number | null
          total_gross_revenue: number | null
          total_net_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_dre_price_source_mismatch_v1: {
        Row: {
          company_id: string | null
          delivery_id: string | null
          discrepancy: number | null
          item_ref_id: string | null
          source_truth_price: number | null
          used_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_dre_return_qty_exceeds_delivered_v1: {
        Row: {
          company_id: string | null
          delivered_qty: number | null
          discrepancy: number | null
          order_id: string | null
          returned_qty: number | null
          sales_item_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_dre_return_stock_mismatch_v1: {
        Row: {
          company_id: string | null
          delivery_id: string | null
          qty_returned: number | null
          sales_document_item_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_price_source_mismatch_v1"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_stock_mismatch_v1"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "dre_refusals_logistics_v1"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v1"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "dre_revenue_realized_v1"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "dre_revenue_realized_v2"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v_audit_delivery_sem_saida_estoque"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "v_audit_devolucao_sem_entrada_estoque"
            referencedColumns: ["delivery_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_dre_return_without_prior_revenue_v1: {
        Row: {
          company_id: string | null
          delivery_id: string | null
          inventory_movement_id: string | null
          occurred_at: string | null
          product_id: string | null
          returned_qty: number | null
          total_delivered_in_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_dre_stock_mismatch_v1: {
        Row: {
          created_at: string | null
          delivery_id: string | null
          discrepancy: number | null
          qty_delivered: number | null
          sales_document_id: string | null
          sales_document_item_id: string | null
          stock_qty_out: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_dre_stock_return_orphan_v1: {
        Row: {
          company_id: string | null
          delivery_id: string | null
          movement_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_cogs_v1: {
        Row: {
          company_id: string | null
          occurrence_date: string | null
          product_id: string | null
          quantity: number | null
          ref_id: string | null
          total_cost: number | null
          type: string | null
        }
        Insert: {
          company_id?: string | null
          occurrence_date?: never
          product_id?: string | null
          quantity?: number | null
          ref_id?: string | null
          total_cost?: number | null
          type?: never
        }
        Update: {
          company_id?: string | null
          occurrence_date?: never
          product_id?: string | null
          quantity?: number | null
          ref_id?: string | null
          total_cost?: number | null
          type?: never
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_item_prices_v1: {
        Row: {
          document_id: string | null
          gross_unit_price: number | null
          header_discount: number | null
          item_base_total: number | null
          item_id: string | null
          net_unit_price: number | null
          order_subtotal: number | null
          product_id: string | null
          quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_item_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_item_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_refusals_logistics_v1: {
        Row: {
          company_id: string | null
          delivery_id: string | null
          occurrence_date: string | null
          order_id: string | null
          qty_returned: number | null
          sales_document_item_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["sales_document_item_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_returns_v1: {
        Row: {
          company_id: string | null
          delivery_id: string | null
          item_ref_id: string | null
          occurrence_date: string | null
          order_id: string | null
          product_id: string | null
          qty_returned: number | null
          return_amount: number | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sales_item_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_item_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_returns_v2: {
        Row: {
          company_id: string | null
          delivery_id: string | null
          item_ref_id: string | null
          occurrence_date: string | null
          order_id: string | null
          product_id: string | null
          qty_returned: number | null
          return_amount: number | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sales_item_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_item_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_revenue_gross_v1: {
        Row: {
          company_id: string | null
          gross_revenue_amount: number | null
          gross_unit_price: number | null
          occurrence_date: string | null
          order_id: string | null
          qty_delivered: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_revenue_realized_v1: {
        Row: {
          company_id: string | null
          delivery_id: string | null
          item_ref_id: string | null
          occurrence_date: string | null
          order_id: string | null
          product_id: string | null
          qty_delivered: number | null
          revenue_amount: number | null
          route_id: string | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sales_item_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_item_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_revenue_realized_v2: {
        Row: {
          _info_gross_price: number | null
          company_id: string | null
          delivery_id: string | null
          item_ref_id: string | null
          occurrence_date: string | null
          order_id: string | null
          product_id: string | null
          qty_delivered: number | null
          revenue_amount: number | null
          route_id: string | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "delivery_items_sales_document_item_id_fkey"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "audit_dre_return_qty_exceeds_delivered_v1"
            referencedColumns: ["sales_item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_item_prices_v1"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "dre_returns_v2"
            referencedColumns: ["item_ref_id"]
          },
          {
            foreignKeyName: "fk_delivery_item_sales_item"
            columns: ["item_ref_id"]
            isOneToOne: false
            referencedRelation: "sales_document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sales_item_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_item_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_summary_v1: {
        Row: {
          cogs: number | null
          company_id: string | null
          date: string | null
          deductions: number | null
          gross_profit: number | null
          gross_revenue: number | null
          net_revenue: number | null
        }
        Relationships: []
      }
      dre_summary_v2: {
        Row: {
          cogs: number | null
          company_id: string | null
          date: string | null
          deductions: number | null
          gross_profit: number | null
          gross_revenue: number | null
          net_revenue: number | null
        }
        Relationships: []
      }
      v_audit_delivery_sem_saida_estoque: {
        Row: {
          delivery_date: string | null
          delivery_id: string | null
          document_number: number | null
          missing_stock_movement: boolean | null
          sales_document_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      v_audit_devolucao_sem_entrada_estoque: {
        Row: {
          delivery_id: string | null
          document_number: number | null
          item_id: string | null
          qty_returned: number | null
          return_date: string | null
          sales_document_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sales_item_product"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      v_audit_movimento_sem_referencia: {
        Row: {
          company_id: string | null
          conversion_factor: number | null
          created_at: string | null
          created_by: string | null
          id: string | null
          item_id: string | null
          movement_type: string | null
          notes: string | null
          occurred_at: string | null
          qty_base: number | null
          qty_display: number | null
          qty_in: number | null
          qty_out: number | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          source_ref: string | null
          total_cost: number | null
          unit_cost: number | null
          uom_label: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          conversion_factor?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          item_id?: string | null
          movement_type?: string | null
          notes?: string | null
          occurred_at?: string | null
          qty_base?: number | null
          qty_display?: number | null
          qty_in?: number | null
          qty_out?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source_ref?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          uom_label?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          conversion_factor?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          item_id?: string | null
          movement_type?: string | null
          notes?: string | null
          occurred_at?: string | null
          qty_base?: number | null
          qty_display?: number | null
          qty_in?: number | null
          qty_out?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source_ref?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          uom_label?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dre_cmv_entregue: {
        Row: {
          cogs_amount: number | null
          company_id: string | null
          date_ref: string | null
          item_id: string | null
          qty_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dre_devolucoes_mercadorias_recebidas: {
        Row: {
          client_id: string | null
          company_id: string | null
          date_ref: string | null
          item_id: string | null
          item_name: string | null
          qty_returned: number | null
          revenue_reversal: number | null
          sales_document_id: string | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sales_item_product"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dre_receita_mercadorias_entregue: {
        Row: {
          client_id: string | null
          client_name: string | null
          company_id: string | null
          date_ref: string | null
          gross_revenue: number | null
          item_id: string | null
          item_name: string | null
          qty_delivered: number | null
          sales_document_id: string | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sales_item_product"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_dre_resumo: {
        Row: {
          cmv_estimado: number | null
          company_id: string | null
          date_ref: string | null
          devolucoes: number | null
          receita_bruta: number | null
          receita_liquida: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_finished_good_cost: {
        Args: { p_item_id: string }
        Returns: number
      }
      cleanup_user_drafts: {
        Args: { p_company_id: string; p_exclude_id?: string; p_user_id: string }
        Returns: undefined
      }
      deduct_stock_from_route: {
        Args: { p_route_id: string; p_user_id: string }
        Returns: undefined
      }
      fetch_next_job: {
        Args: { p_job_type: string }
        Returns: {
          attempts: number
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number
          payload: Json
          scheduled_for: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_default_packaging_uom_abbrev: {
        Args: { p_type: string }
        Returns: string
      }
      get_next_purchase_number: {
        Args: { p_company_id: string }
        Returns: number
      }
      get_next_sales_number: { Args: { p_company_id: string }; Returns: number }
      get_next_sku: { Args: { p_company_id: string }; Returns: string }
      get_route_product_aggregation: {
        Args: { p_route_id: string }
        Returns: {
          product_id: string
          product_name: string
          sku: string
          total_quantity: number
          unit: string
        }[]
      }
      get_test_user_id: { Args: never; Returns: string }
      has_company_role: {
        Args: { _company_id: string; _required_roles: string[] }
        Returns: boolean
      }
      is_company_member_for_path: {
        Args: { storage_path: string }
        Returns: boolean
      }
      is_member_of: { Args: { _company_id: string }; Returns: boolean }
      next_sales_document_number: {
        Args: { p_company_id: string }
        Returns: number
      }
      process_financial_compensation: {
        Args: {
          p_credit_title_id: string
          p_event_id: string
          p_user_id: string
        }
        Returns: Json
      }
      process_sales_return: {
        Args: { p_order_id: string; p_payload: Json; p_user_id: string }
        Returns: Json
      }
      recalculate_dependent_costs: {
        Args: { p_component_id: string }
        Returns: undefined
      }
      reconcile_fiscal_records: {
        Args: never
        Returns: {
          ghost_count: number
          migrated_count: number
          processed_count: number
        }[]
      }
      register_production_entry: {
        Args: {
          p_notes: string
          p_occurred_at: string
          p_qty_produced: number
          p_work_order_id: string
        }
        Returns: undefined
      }
      seed_default_uoms: {
        Args: { target_company_id: string }
        Returns: undefined
      }
      seed_test_data: { Args: never; Returns: Json }
      set_default_packaging: {
        Args: {
          p_company_id: string
          p_item_id: string
          p_packaging_id: string
        }
        Returns: undefined
      }
      sync_order_logistic_status: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      title_case: { Args: { input_text: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
      update_item_cost: {
        Args: { p_item_id: string; p_new_cost: number }
        Returns: undefined
      }
    }
    Enums: {
      delivery_status:
        | "draft"
        | "in_preparation"
        | "in_route"
        | "delivered"
        | "delivered_partial"
        | "returned_partial"
        | "returned_total"
        | "cancelled"
      financial_status_enum:
        | "pendente"
        | "pre_lancado"
        | "aprovado"
        | "em_revisao"
        | "cancelado"
        | "pago"
        | "atrasado"
        | "parcial"
      job_status: "pending" | "processing" | "completed" | "failed"
      logistics_status:
        | "pendente"
        | "roteirizado"
        | "agendado"
        | "em_rota"
        | "entregue"
        | "parcial"
        | "devolvido"
      sales_commercial_status:
        | "draft"
        | "sent"
        | "approved"
        | "confirmed"
        | "rejected"
        | "cancelled"
        | "lost"
      sales_logistic_status:
        | "pendente"
        | "roteirizado"
        | "agendado"
        | "expedition"
        | "em_rota"
        | "entregue"
        | "nao_entregue"
        | "devolvido"
        | "parcial"
        | "cancelado"
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
    Enums: {
      delivery_status: [
        "draft",
        "in_preparation",
        "in_route",
        "delivered",
        "delivered_partial",
        "returned_partial",
        "returned_total",
        "cancelled",
      ],
      financial_status_enum: [
        "pendente",
        "pre_lancado",
        "aprovado",
        "em_revisao",
        "cancelado",
        "pago",
        "atrasado",
        "parcial",
      ],
      job_status: ["pending", "processing", "completed", "failed"],
      logistics_status: [
        "pendente",
        "roteirizado",
        "agendado",
        "em_rota",
        "entregue",
        "parcial",
        "devolvido",
      ],
      sales_commercial_status: [
        "draft",
        "sent",
        "approved",
        "confirmed",
        "rejected",
        "cancelled",
        "lost",
      ],
      sales_logistic_status: [
        "pendente",
        "roteirizado",
        "agendado",
        "expedition",
        "em_rota",
        "entregue",
        "nao_entregue",
        "devolvido",
        "parcial",
        "cancelado",
      ],
    },
  },
} as const
