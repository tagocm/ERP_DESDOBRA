export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
          country: string
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
          is_main: boolean
          label: string | null
          neighborhood: string | null
          number: string | null
          organization_id: string
          state: string | null
          street: string | null
          type: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          branch_id?: string | null
          city?: string | null
          city_code_ibge?: string | null
          company_id: string
          complement?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          is_main?: boolean
          label?: string | null
          neighborhood?: string | null
          number?: string | null
          organization_id: string
          state?: string | null
          street?: string | null
          type?: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          branch_id?: string | null
          city?: string | null
          city_code_ibge?: string | null
          company_id?: string
          complement?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          is_main?: boolean
          label?: string | null
          neighborhood?: string | null
          number?: string | null
          organization_id?: string
          state?: string | null
          street?: string | null
          type?: string
          updated_at?: string
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
            foreignKeyName: "addresses_branch_integrity_fkey"
            columns: ["branch_id", "company_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_branches"
            referencedColumns: ["id", "company_id", "organization_id"]
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
      ap_installment_allocations: {
        Row: {
          amount: number
          ap_installment_id: string
          company_id: string
          cost_center_id: string | null
          created_at: string
          gl_account_id: string
          id: string
          updated_at: string
        }
        Insert: {
          amount: number
          ap_installment_id: string
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          gl_account_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          ap_installment_id?: string
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          gl_account_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_installment_allocations_ap_installment_id_fkey"
            columns: ["ap_installment_id"]
            isOneToOne: false
            referencedRelation: "ap_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_installment_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_installment_allocations_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_installment_allocations_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
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
      ar_installment_allocations: {
        Row: {
          amount: number
          ar_installment_id: string
          company_id: string
          cost_center_id: string | null
          created_at: string
          gl_account_id: string
          id: string
          updated_at: string
        }
        Insert: {
          amount: number
          ar_installment_id: string
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          gl_account_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          ar_installment_id?: string
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          gl_account_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_installment_allocations_ar_installment_id_fkey"
            columns: ["ar_installment_id"]
            isOneToOne: false
            referencedRelation: "ar_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_installment_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_installment_allocations_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_installment_allocations_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
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
          factor_assigned_at: string | null
          factor_custody_status: Database["public"]["Enums"]["factor_custody_status_en"]
          factor_id: string | null
          factor_operation_item_id: string | null
          factor_released_at: string | null
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
          factor_assigned_at?: string | null
          factor_custody_status?: Database["public"]["Enums"]["factor_custody_status_en"]
          factor_id?: string | null
          factor_operation_item_id?: string | null
          factor_released_at?: string | null
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
          factor_assigned_at?: string | null
          factor_custody_status?: Database["public"]["Enums"]["factor_custody_status_en"]
          factor_id?: string | null
          factor_operation_item_id?: string | null
          factor_released_at?: string | null
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
            foreignKeyName: "ar_installments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
            foreignKeyName: "ar_installments_factor_id_fkey"
            columns: ["factor_id"]
            isOneToOne: false
            referencedRelation: "factors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_installments_factor_operation_item_id_fkey"
            columns: ["factor_operation_item_id"]
            isOneToOne: false
            referencedRelation: "factor_operation_items"
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
            foreignKeyName: "ar_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "ar_titles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          entity: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          resource: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          resource?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          resource?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "bom_byproduct_outputs_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_byproduct_outputs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          loss_percent: number | null
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
          loss_percent?: number | null
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
          loss_percent?: number | null
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
      commission_closings: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          commission_rate: number | null
          company_id: string
          created_at: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          commission_rate?: number | null
          company_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          commission_rate?: number | null
          company_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_closings_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_closings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_closings_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_entitlements: {
        Row: {
          base_delivered_amount: number
          commission_rate: number
          commission_total: number
          company_id: string
          created_at: string
          delivery_id: string
          id: string
          order_id: string
          origin_key: string
          rep_id: string
          settlement_id: string | null
          updated_at: string
        }
        Insert: {
          base_delivered_amount: number
          commission_rate: number
          commission_total: number
          company_id: string
          created_at?: string
          delivery_id: string
          id?: string
          order_id: string
          origin_key: string
          rep_id: string
          settlement_id?: string | null
          updated_at?: string
        }
        Update: {
          base_delivered_amount?: number
          commission_rate?: number
          commission_total?: number
          company_id?: string
          created_at?: string
          delivery_id?: string
          id?: string
          order_id?: string
          origin_key?: string
          rep_id?: string
          settlement_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_entitlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entitlements_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "delivery_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entitlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entitlements_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entitlements_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "commission_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_lines: {
        Row: {
          allocated_amount: number
          ar_payment_allocation_id: string | null
          ar_payment_id: string
          closing_id: string
          commission_amount: number
          commission_rate: number
          company_id: string
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          document_number: number | null
          id: string
          is_reversal: boolean | null
          payment_date: string
          sales_document_id: string
          sales_rep_id: string
          sales_rep_name: string
        }
        Insert: {
          allocated_amount: number
          ar_payment_allocation_id?: string | null
          ar_payment_id: string
          closing_id: string
          commission_amount: number
          commission_rate: number
          company_id: string
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          document_number?: number | null
          id?: string
          is_reversal?: boolean | null
          payment_date: string
          sales_document_id: string
          sales_rep_id: string
          sales_rep_name: string
        }
        Update: {
          allocated_amount?: number
          ar_payment_allocation_id?: string | null
          ar_payment_id?: string
          closing_id?: string
          commission_amount?: number
          commission_rate?: number
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          document_number?: number | null
          id?: string
          is_reversal?: boolean | null
          payment_date?: string
          sales_document_id?: string
          sales_rep_id?: string
          sales_rep_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_lines_ar_payment_id_fkey"
            columns: ["ar_payment_id"]
            isOneToOne: false
            referencedRelation: "ar_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_lines_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "commission_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_lines_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_lines_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commission_lines_allocation"
            columns: ["ar_payment_allocation_id"]
            isOneToOne: false
            referencedRelation: "ar_payment_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_releases: {
        Row: {
          base_paid_amount: number
          commission_released_amount: number
          company_id: string
          created_at: string
          entitlement_id: string
          id: string
          order_id: string
          origin_key: string
          payment_id: string
          rep_id: string
          settlement_id: string | null
          updated_at: string
        }
        Insert: {
          base_paid_amount: number
          commission_released_amount: number
          company_id: string
          created_at?: string
          entitlement_id: string
          id?: string
          order_id: string
          origin_key: string
          payment_id: string
          rep_id: string
          settlement_id?: string | null
          updated_at?: string
        }
        Update: {
          base_paid_amount?: number
          commission_released_amount?: number
          company_id?: string
          created_at?: string
          entitlement_id?: string
          id?: string
          order_id?: string
          origin_key?: string
          payment_id?: string
          rep_id?: string
          settlement_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_releases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_releases_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "commission_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_releases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_releases_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "ar_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_releases_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_releases_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "commission_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settlement_items: {
        Row: {
          amount: number
          created_at: string
          item_id: string
          item_type: string
          settlement_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          item_id: string
          item_type: string
          settlement_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          item_id?: string
          item_type?: string
          settlement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_settlement_items_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "commission_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settlement_sequences: {
        Row: {
          company_id: string
          next_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          next_number: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          next_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_settlement_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settlements: {
        Row: {
          allow_advance: boolean
          company_id: string
          created_at: string
          created_by: string
          cutoff_date: string
          document_number: number | null
          id: string
          rep_id: string
          request_key: string | null
          status: string
          total_paid: number
          updated_at: string
        }
        Insert: {
          allow_advance?: boolean
          company_id: string
          created_at?: string
          created_by: string
          cutoff_date: string
          document_number?: number | null
          id?: string
          rep_id: string
          request_key?: string | null
          status?: string
          total_paid?: number
          updated_at?: string
        }
        Update: {
          allow_advance?: boolean
          company_id?: string
          created_at?: string
          created_by?: string
          cutoff_date?: string
          document_number?: number | null
          id?: string
          rep_id?: string
          request_key?: string | null
          status?: string
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_settlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_settlements_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_branch: boolean | null
          name: string
          parent_company_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_branch?: boolean | null
          name: string
          parent_company_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_branch?: boolean | null
          name?: string
          parent_company_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "company_bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      company_payment_terms_settings: {
        Row: {
          cadence_days: number | null
          company_id: string
          created_at: string | null
          days_first_installment: number | null
          id: string
          installments: number | null
          is_active: boolean | null
          name: string
          term_type: string | null
          updated_at: string | null
        }
        Insert: {
          cadence_days?: number | null
          company_id: string
          created_at?: string | null
          days_first_installment?: number | null
          id?: string
          installments?: number | null
          is_active?: boolean | null
          name: string
          term_type?: string | null
          updated_at?: string | null
        }
        Update: {
          cadence_days?: number | null
          company_id?: string
          created_at?: string | null
          days_first_installment?: number | null
          id?: string
          installments?: number | null
          is_active?: boolean | null
          name?: string
          term_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_payment_terms_settings_company_id_fkey"
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
        Relationships: [
          {
            foreignKeyName: "company_printer_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          cnae: string | null
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
          nfe_flags: Json | null
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
          cnae?: string | null
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
          nfe_flags?: Json | null
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
          cnae?: string | null
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
          nfe_flags?: Json | null
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
        Relationships: [
          {
            foreignKeyName: "crm_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
          logistics_status:
            | Database["public"]["Enums"]["logistics_status"]
            | null
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
          logistics_status?:
            | Database["public"]["Enums"]["logistics_status"]
            | null
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
          logistics_status?:
            | Database["public"]["Enums"]["logistics_status"]
            | null
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
        ]
      }
      factor_operation_attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["factor_attachment_type_en"]
          company_id: string
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string
          operation_id: string
          storage_path: string
          uploaded_by: string | null
          version_id: string | null
        }
        Insert: {
          attachment_type: Database["public"]["Enums"]["factor_attachment_type_en"]
          company_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type: string
          operation_id: string
          storage_path: string
          uploaded_by?: string | null
          version_id?: string | null
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["factor_attachment_type_en"]
          company_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string
          operation_id?: string
          storage_path?: string
          uploaded_by?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factor_operation_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_attachments_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "factor_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_attachments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "factor_operation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      factor_operation_items: {
        Row: {
          action_type: Database["public"]["Enums"]["factor_item_action_en"]
          amount_snapshot: number
          ar_installment_id: string
          ar_title_id: string
          buyback_settle_now: boolean
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          due_date_snapshot: string
          final_amount: number | null
          final_due_date: string | null
          id: string
          installment_number_snapshot: number
          line_no: number
          notes: string | null
          operation_id: string
          proposed_due_date: string | null
          sales_document_id: string | null
          status: Database["public"]["Enums"]["factor_response_status_en"]
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["factor_item_action_en"]
          amount_snapshot: number
          ar_installment_id: string
          ar_title_id: string
          buyback_settle_now?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          due_date_snapshot: string
          final_amount?: number | null
          final_due_date?: string | null
          id?: string
          installment_number_snapshot: number
          line_no: number
          notes?: string | null
          operation_id: string
          proposed_due_date?: string | null
          sales_document_id?: string | null
          status?: Database["public"]["Enums"]["factor_response_status_en"]
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["factor_item_action_en"]
          amount_snapshot?: number
          ar_installment_id?: string
          ar_title_id?: string
          buyback_settle_now?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          due_date_snapshot?: string
          final_amount?: number | null
          final_due_date?: string | null
          id?: string
          installment_number_snapshot?: number
          line_no?: number
          notes?: string | null
          operation_id?: string
          proposed_due_date?: string | null
          sales_document_id?: string | null
          status?: Database["public"]["Enums"]["factor_response_status_en"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factor_operation_items_ar_installment_id_fkey"
            columns: ["ar_installment_id"]
            isOneToOne: false
            referencedRelation: "ar_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_items_ar_title_id_fkey"
            columns: ["ar_title_id"]
            isOneToOne: false
            referencedRelation: "ar_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_items_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "factor_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_items_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      factor_operation_postings: {
        Row: {
          amount: number
          ap_payment_id: string | null
          ap_title_id: string | null
          ar_payment_id: string | null
          ar_title_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          operation_id: string
          posting_key: string
          posting_type: Database["public"]["Enums"]["factor_posting_type_en"]
          settlement_id: string | null
        }
        Insert: {
          amount: number
          ap_payment_id?: string | null
          ap_title_id?: string | null
          ar_payment_id?: string | null
          ar_title_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          operation_id: string
          posting_key: string
          posting_type: Database["public"]["Enums"]["factor_posting_type_en"]
          settlement_id?: string | null
        }
        Update: {
          amount?: number
          ap_payment_id?: string | null
          ap_title_id?: string | null
          ar_payment_id?: string | null
          ar_title_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          operation_id?: string
          posting_key?: string
          posting_type?: Database["public"]["Enums"]["factor_posting_type_en"]
          settlement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factor_operation_postings_ap_payment_id_fkey"
            columns: ["ap_payment_id"]
            isOneToOne: false
            referencedRelation: "ap_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_postings_ap_title_id_fkey"
            columns: ["ap_title_id"]
            isOneToOne: false
            referencedRelation: "ap_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_postings_ar_payment_id_fkey"
            columns: ["ar_payment_id"]
            isOneToOne: false
            referencedRelation: "ar_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_postings_ar_title_id_fkey"
            columns: ["ar_title_id"]
            isOneToOne: false
            referencedRelation: "ar_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_postings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_postings_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "factor_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_postings_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "financial_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      factor_operation_responses: {
        Row: {
          accepted_amount: number | null
          adjusted_amount: number | null
          adjusted_due_date: string | null
          company_id: string
          created_at: string
          fee_amount: number
          id: string
          imported_at: string
          interest_amount: number
          iof_amount: number
          operation_id: string
          operation_item_id: string
          other_cost_amount: number
          processed_by: string | null
          response_code: string | null
          response_message: string | null
          response_status: Database["public"]["Enums"]["factor_response_status_en"]
          total_cost_amount: number
          updated_at: string
          version_id: string
        }
        Insert: {
          accepted_amount?: number | null
          adjusted_amount?: number | null
          adjusted_due_date?: string | null
          company_id: string
          created_at?: string
          fee_amount?: number
          id?: string
          imported_at?: string
          interest_amount?: number
          iof_amount?: number
          operation_id: string
          operation_item_id: string
          other_cost_amount?: number
          processed_by?: string | null
          response_code?: string | null
          response_message?: string | null
          response_status?: Database["public"]["Enums"]["factor_response_status_en"]
          total_cost_amount?: number
          updated_at?: string
          version_id: string
        }
        Update: {
          accepted_amount?: number | null
          adjusted_amount?: number | null
          adjusted_due_date?: string | null
          company_id?: string
          created_at?: string
          fee_amount?: number
          id?: string
          imported_at?: string
          interest_amount?: number
          iof_amount?: number
          operation_id?: string
          operation_item_id?: string
          other_cost_amount?: number
          processed_by?: string | null
          response_code?: string | null
          response_message?: string | null
          response_status?: Database["public"]["Enums"]["factor_response_status_en"]
          total_cost_amount?: number
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factor_operation_responses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_responses_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "factor_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_responses_operation_item_id_fkey"
            columns: ["operation_item_id"]
            isOneToOne: false
            referencedRelation: "factor_operation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_responses_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "factor_operation_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      factor_operation_versions: {
        Row: {
          company_id: string
          costs_amount: number
          created_at: string
          created_by: string | null
          gross_amount: number
          id: string
          net_amount: number
          operation_id: string
          package_csv_path: string | null
          package_report_path: string | null
          package_zip_path: string | null
          sent_at: string | null
          sent_by: string | null
          snapshot_json: Json
          source_status: Database["public"]["Enums"]["factor_operation_status_en"]
          total_items: number
          version_number: number
        }
        Insert: {
          company_id: string
          costs_amount?: number
          created_at?: string
          created_by?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          operation_id: string
          package_csv_path?: string | null
          package_report_path?: string | null
          package_zip_path?: string | null
          sent_at?: string | null
          sent_by?: string | null
          snapshot_json?: Json
          source_status: Database["public"]["Enums"]["factor_operation_status_en"]
          total_items?: number
          version_number: number
        }
        Update: {
          company_id?: string
          costs_amount?: number
          created_at?: string
          created_by?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          operation_id?: string
          package_csv_path?: string | null
          package_report_path?: string | null
          package_zip_path?: string | null
          sent_at?: string | null
          sent_by?: string | null
          snapshot_json?: Json
          source_status?: Database["public"]["Enums"]["factor_operation_status_en"]
          total_items?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "factor_operation_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operation_versions_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "factor_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      factor_operations: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          completed_at: string | null
          completed_by: string | null
          costs_amount: number
          created_at: string
          created_by: string | null
          current_version_id: string | null
          expected_settlement_date: string | null
          factor_id: string
          gross_amount: number
          id: string
          issue_date: string
          last_response_at: string | null
          net_amount: number
          notes: string | null
          operation_number: number
          reference: string | null
          sent_at: string | null
          sent_by: string | null
          settlement_account_id: string | null
          status: Database["public"]["Enums"]["factor_operation_status_en"]
          updated_at: string
          version_counter: number
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          costs_amount?: number
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          expected_settlement_date?: string | null
          factor_id: string
          gross_amount?: number
          id?: string
          issue_date?: string
          last_response_at?: string | null
          net_amount?: number
          notes?: string | null
          operation_number?: number
          reference?: string | null
          sent_at?: string | null
          sent_by?: string | null
          settlement_account_id?: string | null
          status?: Database["public"]["Enums"]["factor_operation_status_en"]
          updated_at?: string
          version_counter?: number
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          costs_amount?: number
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          expected_settlement_date?: string | null
          factor_id?: string
          gross_amount?: number
          id?: string
          issue_date?: string
          last_response_at?: string | null
          net_amount?: number
          notes?: string | null
          operation_number?: number
          reference?: string | null
          sent_at?: string | null
          sent_by?: string | null
          settlement_account_id?: string | null
          status?: Database["public"]["Enums"]["factor_operation_status_en"]
          updated_at?: string
          version_counter?: number
        }
        Relationships: [
          {
            foreignKeyName: "factor_operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operations_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "factor_operation_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operations_factor_id_fkey"
            columns: ["factor_id"]
            isOneToOne: false
            referencedRelation: "factors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factor_operations_settlement_account_id_fkey"
            columns: ["settlement_account_id"]
            isOneToOne: false
            referencedRelation: "company_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      factors: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          created_by: string | null
          default_auto_settle_buyback: boolean
          default_fee_rate: number
          default_grace_days: number
          default_interest_rate: number
          default_iof_rate: number
          default_other_cost_rate: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          default_auto_settle_buyback?: boolean
          default_fee_rate?: number
          default_grace_days?: number
          default_interest_rate?: number
          default_iof_rate?: number
          default_other_cost_rate?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          default_auto_settle_buyback?: boolean
          default_fee_rate?: number
          default_grace_days?: number
          default_interest_rate?: number
          default_iof_rate?: number
          default_other_cost_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          expense_account_id: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expense_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expense_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_category_sequences: {
        Row: {
          company_id: string
          last_suffix: number
          parent_account_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          last_suffix?: number
          parent_account_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          last_suffix?: number
          parent_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_category_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_category_sequences_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string | null
          description: string
          due_date: string
          id: string
          kind: string
          origin_id: string
          origin_type: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string | null
          description: string
          due_date: string
          id?: string
          kind?: string
          origin_id: string
          origin_type: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string | null
          description?: string
          due_date?: string
          id?: string
          kind?: string
          origin_id?: string
          origin_type?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
            foreignKeyName: "financial_event_installments_suggested_account_id_fkey"
            columns: ["suggested_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
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
          status: Database["public"]["Enums"]["financial_event_status_en"]
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
          status?: Database["public"]["Enums"]["financial_event_status_en"]
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
          status?: Database["public"]["Enums"]["financial_event_status_en"]
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
      fiscal_dfe_sync_state: {
        Row: {
          company_id: string
          created_at: string
          environment: string
          id: string
          last_error: string | null
          last_nsu: string
          last_sync_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          environment: string
          id?: string
          last_error?: string | null
          last_nsu?: string
          last_sync_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          environment?: string
          id?: string
          last_error?: string | null
          last_nsu?: string
          last_sync_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_dfe_sync_state_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_inbound_dfe: {
        Row: {
          chnfe: string | null
          company_id: string
          created_at: string
          dest_cnpj: string | null
          dh_emi: string | null
          emit_cnpj: string | null
          emit_nome: string | null
          environment: string
          has_full_xml: boolean
          id: string
          manifest_status: string
          manifest_updated_at: string | null
          nsu: string
          schema: string
          summary_json: Json
          total: number | null
          updated_at: string
          xml_base64: string | null
          xml_is_gz: boolean
        }
        Insert: {
          chnfe?: string | null
          company_id: string
          created_at?: string
          dest_cnpj?: string | null
          dh_emi?: string | null
          emit_cnpj?: string | null
          emit_nome?: string | null
          environment: string
          has_full_xml?: boolean
          id?: string
          manifest_status?: string
          manifest_updated_at?: string | null
          nsu: string
          schema: string
          summary_json?: Json
          total?: number | null
          updated_at?: string
          xml_base64?: string | null
          xml_is_gz?: boolean
        }
        Update: {
          chnfe?: string | null
          company_id?: string
          created_at?: string
          dest_cnpj?: string | null
          dh_emi?: string | null
          emit_cnpj?: string | null
          emit_nome?: string | null
          environment?: string
          has_full_xml?: boolean
          id?: string
          manifest_status?: string
          manifest_updated_at?: string | null
          nsu?: string
          schema?: string
          summary_json?: Json
          total?: number | null
          updated_at?: string
          xml_base64?: string | null
          xml_is_gz?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_inbound_dfe_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_inbound_manifest_events: {
        Row: {
          chnfe: string
          company_id: string
          created_at: string
          environment: string
          event_type: string
          id: string
          justification: string | null
          last_error: string | null
          sefaz_protocol: string | null
          sefaz_receipt: string | null
          status: string
          updated_at: string
        }
        Insert: {
          chnfe: string
          company_id: string
          created_at?: string
          environment: string
          event_type: string
          id?: string
          justification?: string | null
          last_error?: string | null
          sefaz_protocol?: string | null
          sefaz_receipt?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          chnfe?: string
          company_id?: string
          created_at?: string
          environment?: string
          event_type?: string
          id?: string
          justification?: string | null
          last_error?: string | null
          sefaz_protocol?: string | null
          sefaz_receipt?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_inbound_manifest_events_company_id_fkey"
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
            foreignKeyName: "fiscal_operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_operations_tax_group_id_fkey"
            columns: ["tax_group_id"]
            isOneToOne: false
            referencedRelation: "tax_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_fuel_records: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          fuel_date: string
          fuel_type: string
          gas_station: string | null
          id: string
          notes: string | null
          odometer_km: number
          price_per_liter: number
          quantity_liters: number
          total_amount: number
          updated_at: string
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          fuel_date: string
          fuel_type: string
          gas_station?: string | null
          id?: string
          notes?: string | null
          odometer_km: number
          price_per_liter: number
          quantity_liters: number
          total_amount: number
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          fuel_date?: string
          fuel_type?: string
          gas_station?: string | null
          id?: string
          notes?: string | null
          odometer_km?: number
          price_per_liter?: number
          quantity_liters?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_fuel_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_fuel_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_toll_records: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          location: string
          notes: string | null
          payment_method: string
          toll_date: string
          toll_time: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          location: string
          notes?: string | null
          payment_method: string
          toll_date: string
          toll_time: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string
          notes?: string | null
          payment_method?: string
          toll_date?: string
          toll_time?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_toll_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_toll_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_traffic_fines: {
        Row: {
          amount: number
          city: string
          company_id: string
          created_at: string
          created_by: string | null
          deducted_from_driver: boolean
          driver_name: string
          due_date: string | null
          fine_date: string
          id: string
          notes: string | null
          reason: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string
        }
        Insert: {
          amount: number
          city: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deducted_from_driver?: boolean
          driver_name: string
          due_date?: string | null
          fine_date: string
          id?: string
          notes?: string | null
          reason: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id: string
        }
        Update: {
          amount?: number
          city?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deducted_from_driver?: boolean
          driver_name?: string
          due_date?: string | null
          fine_date?: string
          id?: string
          notes?: string | null
          reason?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_traffic_fines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_traffic_fines_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicles: {
        Row: {
          avg_fuel_consumption_km_l: number | null
          brand: string | null
          chassis: string | null
          color: string | null
          company_id: string
          cost_center_id: string | null
          created_at: string | null
          fuel_type: string | null
          id: string
          inactivated_at: string | null
          inactivated_by: string | null
          is_active: boolean
          model: string | null
          name: string
          odometer_current_km: number | null
          odometer_initial_km: number | null
          plate: string | null
          renavam: string | null
          tank_capacity_l: number | null
          type: string | null
          updated_at: string | null
          updated_by: string | null
          year: number | null
        }
        Insert: {
          avg_fuel_consumption_km_l?: number | null
          brand?: string | null
          chassis?: string | null
          color?: string | null
          company_id: string
          cost_center_id?: string | null
          created_at?: string | null
          fuel_type?: string | null
          id?: string
          inactivated_at?: string | null
          inactivated_by?: string | null
          is_active?: boolean
          model?: string | null
          name: string
          odometer_current_km?: number | null
          odometer_initial_km?: number | null
          plate?: string | null
          renavam?: string | null
          tank_capacity_l?: number | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          year?: number | null
        }
        Update: {
          avg_fuel_consumption_km_l?: number | null
          brand?: string | null
          chassis?: string | null
          color?: string | null
          company_id?: string
          cost_center_id?: string | null
          created_at?: string | null
          fuel_type?: string | null
          id?: string
          inactivated_at?: string | null
          inactivated_by?: string | null
          is_active?: boolean
          model?: string | null
          name?: string
          odometer_current_km?: number | null
          odometer_initial_km?: number | null
          plate?: string | null
          renavam?: string | null
          tank_capacity_l?: number | null
          type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_vehicles_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
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
          is_system_locked: boolean | null
          name: string
          nature: string | null
          origin: string | null
          origin_id: string | null
          parent_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_system_locked?: boolean | null
          name: string
          nature?: string | null
          origin?: string | null
          origin_id?: string | null
          parent_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_system_locked?: boolean | null
          name?: string
          nature?: string | null
          origin?: string | null
          origin_id?: string | null
          parent_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_allocation_backfill_audit: {
        Row: {
          company_id: string
          created_at: string
          details: Json | null
          id: string
          installment_id: string
          installment_type: string
          reason: string
        }
        Insert: {
          company_id: string
          created_at?: string
          details?: Json | null
          id?: string
          installment_id: string
          installment_type: string
          reason: string
        }
        Update: {
          company_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          installment_id?: string
          installment_type?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_allocation_backfill_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_lines: {
        Row: {
          company_id: string
          counted_qty_base: number | null
          created_at: string
          diff_qty_base: number
          id: string
          inventory_count_id: string
          item_id: string
          notes: string | null
          system_qty_base: number
          updated_at: string
        }
        Insert: {
          company_id: string
          counted_qty_base?: number | null
          created_at?: string
          diff_qty_base?: number
          id?: string
          inventory_count_id: string
          item_id: string
          notes?: string | null
          system_qty_base?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          counted_qty_base?: number | null
          created_at?: string
          diff_qty_base?: number
          id?: string
          inventory_count_id?: string
          item_id?: string
          notes?: string | null
          system_qty_base?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_lines_inventory_count_id_fkey"
            columns: ["inventory_count_id"]
            isOneToOne: false
            referencedRelation: "inventory_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_count_sequences: {
        Row: {
          company_id: string
          next_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          next_number: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          next_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          company_id: string
          counted_at: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          notes: string | null
          number: number
          posted_at: string | null
          posted_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          counted_at?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          number: number
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          counted_at?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          number?: number
          posted_at?: string | null
          posted_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["auth_user_id"]
          },
          {
            foreignKeyName: "inventory_counts_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["auth_user_id"]
          },
        ]
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
            foreignKeyName: "item_fiscal_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
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
        Relationships: [
          {
            foreignKeyName: "item_inventory_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_inventory_profiles_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "item_packaging_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_packaging_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
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
          default_sector_id: string | null
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
          default_sector_id?: string | null
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
          default_sector_id?: string | null
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
            foreignKeyName: "item_production_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_production_profiles_default_bom_id_fkey"
            columns: ["default_bom_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_production_profiles_default_sector_id_fkey"
            columns: ["default_sector_id"]
            isOneToOne: false
            referencedRelation: "production_sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_production_profiles_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "item_purchase_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_purchase_profiles_default_purchase_packaging_id_fkey"
            columns: ["default_purchase_packaging_id"]
            isOneToOne: false
            referencedRelation: "item_packaging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_purchase_profiles_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_purchase_profiles_preferred_supplier_id_fkey"
            columns: ["preferred_supplier_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
        Relationships: [
          {
            foreignKeyName: "item_sales_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_sales_profiles_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          avg_cost: number
          base_weight_kg: number | null
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
          base_weight_kg?: number | null
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
          base_weight_kg?: number | null
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
      mobile_api_tokens: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          token_hash: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          token_hash: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobile_api_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_expense_events: {
        Row: {
          company_id: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          received_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mobile_expense_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_cancellations: {
        Row: {
          access_key: string
          c_stat: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          nfe_emission_id: string
          processed_at: string | null
          protocol: string | null
          reason: string
          request_xml: string | null
          response_xml: string | null
          sales_document_id: string | null
          sequence: number
          status: string
          updated_at: string
          x_motivo: string | null
        }
        Insert: {
          access_key: string
          c_stat?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          nfe_emission_id: string
          processed_at?: string | null
          protocol?: string | null
          reason: string
          request_xml?: string | null
          response_xml?: string | null
          sales_document_id?: string | null
          sequence: number
          status?: string
          updated_at?: string
          x_motivo?: string | null
        }
        Update: {
          access_key?: string
          c_stat?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nfe_emission_id?: string
          processed_at?: string | null
          protocol?: string | null
          reason?: string
          request_xml?: string | null
          response_xml?: string | null
          sales_document_id?: string | null
          sequence?: number
          status?: string
          updated_at?: string
          x_motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_cancellations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_cancellations_nfe_emission_id_fkey"
            columns: ["nfe_emission_id"]
            isOneToOne: false
            referencedRelation: "nfe_emissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_cancellations_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_correction_letters: {
        Row: {
          access_key: string
          c_stat: string | null
          company_id: string
          correction_text: string
          created_at: string
          created_by: string | null
          id: string
          nfe_emission_id: string
          processed_at: string | null
          protocol: string | null
          request_xml: string | null
          response_xml: string | null
          sales_document_id: string | null
          sequence: number
          status: string
          updated_at: string
          x_motivo: string | null
        }
        Insert: {
          access_key: string
          c_stat?: string | null
          company_id: string
          correction_text: string
          created_at?: string
          created_by?: string | null
          id?: string
          nfe_emission_id: string
          processed_at?: string | null
          protocol?: string | null
          request_xml?: string | null
          response_xml?: string | null
          sales_document_id?: string | null
          sequence: number
          status?: string
          updated_at?: string
          x_motivo?: string | null
        }
        Update: {
          access_key?: string
          c_stat?: string | null
          company_id?: string
          correction_text?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nfe_emission_id?: string
          processed_at?: string | null
          protocol?: string | null
          request_xml?: string | null
          response_xml?: string | null
          sales_document_id?: string | null
          sequence?: number
          status?: string
          updated_at?: string
          x_motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_correction_letters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_correction_letters_nfe_emission_id_fkey"
            columns: ["nfe_emission_id"]
            isOneToOne: false
            referencedRelation: "nfe_emissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_correction_letters_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_emissions: {
        Row: {
          access_key: string
          attempts: number | null
          authorized_at: string | null
          c_stat: string | null
          company_id: string
          created_at: string | null
          dest_document: string | null
          dest_uf: string | null
          dh_recbto: string | null
          digest_value: string | null
          emit_cnpj: string | null
          emit_uf: string | null
          error_message: string | null
          id: string
          id_lote: string | null
          imported_at: string | null
          imported_by: string | null
          ind_sinc: string | null
          is_read_only: boolean
          last_attempt_at: string | null
          legacy_protocol_status: string | null
          modelo: string | null
          n_prot: string | null
          n_recibo: string | null
          numero: string
          sales_document_id: string | null
          serie: string
          source_system: string
          status: string
          total_vnf: number | null
          tp_amb: string
          uf: string | null
          updated_at: string | null
          x_motivo: string | null
          xml_nfe_proc: string | null
          xml_sent: string | null
          xml_signed: string
          xml_storage_path: string | null
          xml_unsigned: string | null
        }
        Insert: {
          access_key: string
          attempts?: number | null
          authorized_at?: string | null
          c_stat?: string | null
          company_id: string
          created_at?: string | null
          dest_document?: string | null
          dest_uf?: string | null
          dh_recbto?: string | null
          digest_value?: string | null
          emit_cnpj?: string | null
          emit_uf?: string | null
          error_message?: string | null
          id?: string
          id_lote?: string | null
          imported_at?: string | null
          imported_by?: string | null
          ind_sinc?: string | null
          is_read_only?: boolean
          last_attempt_at?: string | null
          legacy_protocol_status?: string | null
          modelo?: string | null
          n_prot?: string | null
          n_recibo?: string | null
          numero: string
          sales_document_id?: string | null
          serie: string
          source_system?: string
          status?: string
          total_vnf?: number | null
          tp_amb: string
          uf?: string | null
          updated_at?: string | null
          x_motivo?: string | null
          xml_nfe_proc?: string | null
          xml_sent?: string | null
          xml_signed: string
          xml_storage_path?: string | null
          xml_unsigned?: string | null
        }
        Update: {
          access_key?: string
          attempts?: number | null
          authorized_at?: string | null
          c_stat?: string | null
          company_id?: string
          created_at?: string | null
          dest_document?: string | null
          dest_uf?: string | null
          dh_recbto?: string | null
          digest_value?: string | null
          emit_cnpj?: string | null
          emit_uf?: string | null
          error_message?: string | null
          id?: string
          id_lote?: string | null
          imported_at?: string | null
          imported_by?: string | null
          ind_sinc?: string | null
          is_read_only?: boolean
          last_attempt_at?: string | null
          legacy_protocol_status?: string | null
          modelo?: string | null
          n_prot?: string | null
          n_recibo?: string | null
          numero?: string
          sales_document_id?: string | null
          serie?: string
          source_system?: string
          status?: string
          total_vnf?: number | null
          tp_amb?: string
          uf?: string | null
          updated_at?: string | null
          x_motivo?: string | null
          xml_nfe_proc?: string | null
          xml_sent?: string | null
          xml_signed?: string
          xml_storage_path?: string | null
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
      nfe_inbound_reversals: {
        Row: {
          c_stat: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          inbound_emission_id: string | null
          internal_notes: string | null
          mode: string
          outbound_access_key: string
          outbound_emission_id: string
          outbound_sales_document_id: string | null
          reason_code: string
          reason_other: string | null
          selection: Json
          status: string
          updated_at: string
          x_motivo: string | null
        }
        Insert: {
          c_stat?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inbound_emission_id?: string | null
          internal_notes?: string | null
          mode: string
          outbound_access_key: string
          outbound_emission_id: string
          outbound_sales_document_id?: string | null
          reason_code: string
          reason_other?: string | null
          selection?: Json
          status?: string
          updated_at?: string
          x_motivo?: string | null
        }
        Update: {
          c_stat?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inbound_emission_id?: string | null
          internal_notes?: string | null
          mode?: string
          outbound_access_key?: string
          outbound_emission_id?: string
          outbound_sales_document_id?: string | null
          reason_code?: string
          reason_other?: string | null
          selection?: Json
          status?: string
          updated_at?: string
          x_motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfe_inbound_reversals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_inbound_reversals_inbound_emission_id_fkey"
            columns: ["inbound_emission_id"]
            isOneToOne: false
            referencedRelation: "nfe_emissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_inbound_reversals_outbound_emission_id_fkey"
            columns: ["outbound_emission_id"]
            isOneToOne: false
            referencedRelation: "nfe_emissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_inbound_reversals_outbound_sales_document_id_fkey"
            columns: ["outbound_sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      nfe_legacy_import_items: {
        Row: {
          cfop: string | null
          company_id: string
          cprod: string
          created_at: string
          id: string
          is_produced: boolean
          item_number: number
          ncm: string | null
          nfe_emission_id: string
          qcom: number
          ucom: string
          updated_at: string
          vprod: number
          vuncom: number
          xprod: string
        }
        Insert: {
          cfop?: string | null
          company_id: string
          cprod: string
          created_at?: string
          id?: string
          is_produced?: boolean
          item_number: number
          ncm?: string | null
          nfe_emission_id: string
          qcom: number
          ucom: string
          updated_at?: string
          vprod: number
          vuncom: number
          xprod: string
        }
        Update: {
          cfop?: string | null
          company_id?: string
          cprod?: string
          created_at?: string
          id?: string
          is_produced?: boolean
          item_number?: number
          ncm?: string | null
          nfe_emission_id?: string
          qcom?: number
          ucom?: string
          updated_at?: string
          vprod?: number
          vuncom?: number
          xprod?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfe_legacy_import_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_legacy_import_items_nfe_emission_id_fkey"
            columns: ["nfe_emission_id"]
            isOneToOne: false
            referencedRelation: "nfe_emissions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_commission_rate_history: {
        Row: {
          changed_at: string
          changed_by: string
          company_id: string
          id: string
          new_rate: number
          old_rate: number
          order_id: string
          reason: string
          source_context: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          company_id: string
          id?: string
          new_rate: number
          old_rate: number
          order_id: string
          reason: string
          source_context: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          company_id?: string
          id?: string
          new_rate?: number
          old_rate?: number
          order_id?: string
          reason?: string
          source_context?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_commission_rate_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_commission_rate_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_commission_rate_history_order_id_fkey"
            columns: ["order_id"]
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
        Relationships: [
          {
            foreignKeyName: "organization_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "organization_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_tag_links: {
        Row: {
          company_id: string
          created_at: string
          organization_id: string
          tag_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          organization_id: string
          tag_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_tag_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_tag_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "organization_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_tags: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          company_id: string
          country_code: string
          created_at: string
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
          icms_contributor: string | null
          id: string
          ie: string | null
          ie_indicator: string
          ie_last_checked_at: string | null
          ie_sefaz_status: string | null
          ie_source: string | null
          is_final_consumer: boolean | null
          is_ie_exempt: boolean | null
          is_public_agency: boolean
          is_simple_national: boolean
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
          updated_at: string
        }
        Insert: {
          company_id: string
          country_code?: string
          created_at?: string
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
          icms_contributor?: string | null
          id?: string
          ie?: string | null
          ie_indicator?: string
          ie_last_checked_at?: string | null
          ie_sefaz_status?: string | null
          ie_source?: string | null
          is_final_consumer?: boolean | null
          is_ie_exempt?: boolean | null
          is_public_agency?: boolean
          is_simple_national?: boolean
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
          updated_at?: string
        }
        Update: {
          company_id?: string
          country_code?: string
          created_at?: string
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
          icms_contributor?: string | null
          id?: string
          ie?: string | null
          ie_indicator?: string
          ie_last_checked_at?: string | null
          ie_sefaz_status?: string | null
          ie_source?: string | null
          is_final_consumer?: boolean | null
          is_ie_exempt?: boolean | null
          is_public_agency?: boolean
          is_simple_national?: boolean
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
          updated_at?: string
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
        Relationships: [
          {
            foreignKeyName: "payment_modes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "payment_terms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
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
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
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
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
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
          updated_at?: string
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
            foreignKeyName: "people_branch_integrity_fkey"
            columns: ["branch_id", "company_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organization_branches"
            referencedColumns: ["id", "company_id", "organization_id"]
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          price?: number | null
          price_table_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          price?: number | null
          price_table_id?: string
          updated_at?: string
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
          commission_pct: number | null
          company_id: string
          created_at: string | null
          customer_profiles: string[] | null
          deleted_at: string | null
          effective_date: string
          freight_included: boolean
          id: string
          internal_notes: string | null
          is_active: boolean
          min_order_value: number | null
          name: string
          states: string[] | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          commission_pct?: number | null
          company_id: string
          created_at?: string | null
          customer_profiles?: string[] | null
          deleted_at?: string | null
          effective_date?: string
          freight_included?: boolean
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          min_order_value?: number | null
          name: string
          states?: string[] | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          commission_pct?: number | null
          company_id?: string
          created_at?: string | null
          customer_profiles?: string[] | null
          deleted_at?: string | null
          effective_date?: string
          freight_included?: boolean
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          min_order_value?: number | null
          name?: string
          states?: string[] | null
          updated_at?: string | null
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
        Relationships: [
          {
            foreignKeyName: "print_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          normalized_name: string
          revenue_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          normalized_name: string
          revenue_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          normalized_name?: string
          revenue_account_id?: string | null
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
          {
            foreignKeyName: "product_categories_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      production_sector_sequences: {
        Row: {
          company_id: string
          next_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          next_number: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          next_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_sector_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      production_sectors: {
        Row: {
          capacity_recipes: number
          code: string
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          capacity_recipes?: number
          code: string
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          capacity_recipes?: number
          code?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_sectors_company_id_fkey"
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
      recurring_rules: {
        Row: {
          amount: number | null
          amount_type: string | null
          auto_generate: boolean | null
          billing_plan_type: string | null
          category: string | null
          category_id: string | null
          company_id: string
          contract_amount: number | null
          cost_center_id: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_day: number | null
          end_month: string | null
          estimated_amount: number | null
          first_due_date: string | null
          fixed_amount: number | null
          generation_mode: string | null
          id: string
          installments_count: number | null
          manual_installments: Json
          name: string
          partner_id: string | null
          partner_name: string | null
          payment_mode_id: string | null
          rule_type: string | null
          start_month: string | null
          status: string
          updated_at: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          amount?: number | null
          amount_type?: string | null
          auto_generate?: boolean | null
          billing_plan_type?: string | null
          category?: string | null
          category_id?: string | null
          company_id: string
          contract_amount?: number | null
          cost_center_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_day?: number | null
          end_month?: string | null
          estimated_amount?: number | null
          first_due_date?: string | null
          fixed_amount?: number | null
          generation_mode?: string | null
          id?: string
          installments_count?: number | null
          manual_installments?: Json
          name: string
          partner_id?: string | null
          partner_name?: string | null
          payment_mode_id?: string | null
          rule_type?: string | null
          start_month?: string | null
          status?: string
          updated_at?: string | null
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          amount?: number | null
          amount_type?: string | null
          auto_generate?: boolean | null
          billing_plan_type?: string | null
          category?: string | null
          category_id?: string | null
          company_id?: string
          contract_amount?: number | null
          cost_center_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_day?: number | null
          end_month?: string | null
          estimated_amount?: number | null
          first_due_date?: string | null
          fixed_amount?: number | null
          generation_mode?: string | null
          id?: string
          installments_count?: number | null
          manual_installments?: Json
          name?: string
          partner_id?: string | null
          partner_name?: string | null
          payment_mode_id?: string | null
          rule_type?: string | null
          start_month?: string | null
          status?: string
          updated_at?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_payment_mode_id_fkey"
            columns: ["payment_mode_id"]
            isOneToOne: false
            referencedRelation: "payment_modes"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_commission_ledger: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          entry_type: string
          id: string
          notes: string | null
          release_id: string | null
          rep_id: string
          settlement_id: string | null
          source_key: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          entry_type: string
          id?: string
          notes?: string | null
          release_id?: string | null
          rep_id: string
          settlement_id?: string | null
          source_key?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          entry_type?: string
          id?: string
          notes?: string | null
          release_id?: string | null
          rep_id?: string
          settlement_id?: string | null
          source_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rep_commission_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_commission_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_commission_ledger_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "commission_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_commission_ledger_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_commission_ledger_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "commission_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_category_sequences: {
        Row: {
          company_id: string
          last_suffix: number
          updated_at: string
        }
        Insert: {
          company_id: string
          last_suffix?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          last_suffix?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_category_sequences_company_id_fkey"
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
            foreignKeyName: "sales_document_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
        Relationships: [
          {
            foreignKeyName: "sales_document_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "sales_document_finance_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_document_finance_events_sales_document_id_fkey"
            columns: ["sales_document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_document_history: {
        Row: {
          created_at: string | null
          description: string
          document_id: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          document_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          document_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_document_history_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "sales_documents"
            referencedColumns: ["id"]
          },
        ]
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
          gross_weight_kg_snapshot: number | null
          id: string
          ipi_aliquot: number | null
          ipi_applies: boolean | null
          ipi_cst: string | null
          ipi_value: number | null
          item_id: string
          manual_weight_override: boolean | null
          ncm_snapshot: string | null
          notes: string | null
          origin_snapshot: number | null
          packaging_id: string | null
          pis_aliquot: number | null
          pis_cst: string | null
          pis_value: number | null
          qty_base: number | null
          qty_fulfilled: number | null
          qty_invoiced: number | null
          qty_returned: number | null
          quantity: number
          sales_unit_label_snapshot: string | null
          sales_unit_snapshot: Json | null
          sales_uom_abbrev_snapshot: string | null
          st_aliquot: number | null
          st_applies: boolean | null
          st_base_calc: number | null
          st_value: number | null
          total_amount: number | null
          total_weight_kg: number | null
          unit_price: number
          unit_weight_kg: number | null
          updated_at: string | null
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
          gross_weight_kg_snapshot?: number | null
          id?: string
          ipi_aliquot?: number | null
          ipi_applies?: boolean | null
          ipi_cst?: string | null
          ipi_value?: number | null
          item_id: string
          manual_weight_override?: boolean | null
          ncm_snapshot?: string | null
          notes?: string | null
          origin_snapshot?: number | null
          packaging_id?: string | null
          pis_aliquot?: number | null
          pis_cst?: string | null
          pis_value?: number | null
          qty_base?: number | null
          qty_fulfilled?: number | null
          qty_invoiced?: number | null
          qty_returned?: number | null
          quantity: number
          sales_unit_label_snapshot?: string | null
          sales_unit_snapshot?: Json | null
          sales_uom_abbrev_snapshot?: string | null
          st_aliquot?: number | null
          st_applies?: boolean | null
          st_base_calc?: number | null
          st_value?: number | null
          total_amount?: number | null
          total_weight_kg?: number | null
          unit_price: number
          unit_weight_kg?: number | null
          updated_at?: string | null
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
          gross_weight_kg_snapshot?: number | null
          id?: string
          ipi_aliquot?: number | null
          ipi_applies?: boolean | null
          ipi_cst?: string | null
          ipi_value?: number | null
          item_id?: string
          manual_weight_override?: boolean | null
          ncm_snapshot?: string | null
          notes?: string | null
          origin_snapshot?: number | null
          packaging_id?: string | null
          pis_aliquot?: number | null
          pis_cst?: string | null
          pis_value?: number | null
          qty_base?: number | null
          qty_fulfilled?: number | null
          qty_invoiced?: number | null
          qty_returned?: number | null
          quantity?: number
          sales_unit_label_snapshot?: string | null
          sales_unit_snapshot?: Json | null
          sales_uom_abbrev_snapshot?: string | null
          st_aliquot?: number | null
          st_applies?: boolean | null
          st_base_calc?: number | null
          st_value?: number | null
          total_amount?: number | null
          total_weight_kg?: number | null
          unit_price?: number
          unit_weight_kg?: number | null
          updated_at?: string | null
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
            foreignKeyName: "sales_document_items_fiscal_operation_id_fkey"
            columns: ["fiscal_operation_id"]
            isOneToOne: false
            referencedRelation: "fiscal_operations"
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "sales_document_nfes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "sales_document_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          commission_rate: number | null
          commission_rate_source: string | null
          commission_rate_updated_at: string | null
          commission_rate_updated_by: string | null
          company_id: string
          created_at: string | null
          date_issued: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          delivered_at: string | null
          delivery_address_json: Json | null
          delivery_date: string | null
          discount_amount: number | null
          dispatch_blocked: boolean
          dispatch_blocked_at: string | null
          dispatch_blocked_by: string | null
          dispatch_blocked_reason: string | null
          doc_type: string
          document_number: number | null
          financial_status: Database["public"]["Enums"]["financial_status_en"]
          freight_amount: number | null
          freight_mode: string | null
          id: string
          internal_notes: string | null
          invoiced_at: string | null
          is_antecipada: boolean | null
          loading_checked: boolean | null
          loading_checked_at: string | null
          loading_checked_by: string | null
          locked_at: string | null
          logistic_last_occurrence_at: string | null
          needs_commercial_attention: boolean | null
          needs_finance_attention: boolean | null
          payment_mode_id: string | null
          payment_terms_id: string | null
          price_table_id: string | null
          route_tag: string | null
          sales_rep_id: string | null
          scheduled_delivery_date: string | null
          shipping_notes: string | null
          status_commercial: Database["public"]["Enums"]["sales_commercial_status"]
          status_fiscal: string
          status_logistic: Database["public"]["Enums"]["sales_logistic_status_en"]
          subtotal_amount: number | null
          total_amount: number | null
          total_gross_weight_kg: number | null
          total_weight_kg: number | null
          updated_at: string | null
          valid_until: string | null
          volumes_brand: string | null
          volumes_gross_weight_kg: number | null
          volumes_net_weight_kg: number | null
          volumes_qty: number | null
          volumes_species: string | null
        }
        Insert: {
          carrier_id?: string | null
          client_id: string
          client_notes?: string | null
          commission_rate?: number | null
          commission_rate_source?: string | null
          commission_rate_updated_at?: string | null
          commission_rate_updated_by?: string | null
          company_id: string
          created_at?: string | null
          date_issued?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivered_at?: string | null
          delivery_address_json?: Json | null
          delivery_date?: string | null
          discount_amount?: number | null
          dispatch_blocked?: boolean
          dispatch_blocked_at?: string | null
          dispatch_blocked_by?: string | null
          dispatch_blocked_reason?: string | null
          doc_type: string
          document_number?: number | null
          financial_status?: Database["public"]["Enums"]["financial_status_en"]
          freight_amount?: number | null
          freight_mode?: string | null
          id?: string
          internal_notes?: string | null
          invoiced_at?: string | null
          is_antecipada?: boolean | null
          loading_checked?: boolean | null
          loading_checked_at?: string | null
          loading_checked_by?: string | null
          locked_at?: string | null
          logistic_last_occurrence_at?: string | null
          needs_commercial_attention?: boolean | null
          needs_finance_attention?: boolean | null
          payment_mode_id?: string | null
          payment_terms_id?: string | null
          price_table_id?: string | null
          route_tag?: string | null
          sales_rep_id?: string | null
          scheduled_delivery_date?: string | null
          shipping_notes?: string | null
          status_commercial: Database["public"]["Enums"]["sales_commercial_status"]
          status_fiscal?: string
          status_logistic?: Database["public"]["Enums"]["sales_logistic_status_en"]
          subtotal_amount?: number | null
          total_amount?: number | null
          total_gross_weight_kg?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          valid_until?: string | null
          volumes_brand?: string | null
          volumes_gross_weight_kg?: number | null
          volumes_net_weight_kg?: number | null
          volumes_qty?: number | null
          volumes_species?: string | null
        }
        Update: {
          carrier_id?: string | null
          client_id?: string
          client_notes?: string | null
          commission_rate?: number | null
          commission_rate_source?: string | null
          commission_rate_updated_at?: string | null
          commission_rate_updated_by?: string | null
          company_id?: string
          created_at?: string | null
          date_issued?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          delivered_at?: string | null
          delivery_address_json?: Json | null
          delivery_date?: string | null
          discount_amount?: number | null
          dispatch_blocked?: boolean
          dispatch_blocked_at?: string | null
          dispatch_blocked_by?: string | null
          dispatch_blocked_reason?: string | null
          doc_type?: string
          document_number?: number | null
          financial_status?: Database["public"]["Enums"]["financial_status_en"]
          freight_amount?: number | null
          freight_mode?: string | null
          id?: string
          internal_notes?: string | null
          invoiced_at?: string | null
          is_antecipada?: boolean | null
          loading_checked?: boolean | null
          loading_checked_at?: string | null
          loading_checked_by?: string | null
          locked_at?: string | null
          logistic_last_occurrence_at?: string | null
          needs_commercial_attention?: boolean | null
          needs_finance_attention?: boolean | null
          payment_mode_id?: string | null
          payment_terms_id?: string | null
          price_table_id?: string | null
          route_tag?: string | null
          sales_rep_id?: string | null
          scheduled_delivery_date?: string | null
          shipping_notes?: string | null
          status_commercial?: Database["public"]["Enums"]["sales_commercial_status"]
          status_fiscal?: string
          status_logistic?: Database["public"]["Enums"]["sales_logistic_status_en"]
          subtotal_amount?: number | null
          total_amount?: number | null
          total_gross_weight_kg?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          valid_until?: string | null
          volumes_brand?: string | null
          volumes_gross_weight_kg?: number | null
          volumes_net_weight_kg?: number | null
          volumes_qty?: number | null
          volumes_species?: string | null
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
            foreignKeyName: "sales_documents_commission_rate_updated_by_fkey"
            columns: ["commission_rate_updated_by"]
            isOneToOne: false
            referencedRelation: "users"
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
            foreignKeyName: "sales_documents_payment_mode_id_fkey"
            columns: ["payment_mode_id"]
            isOneToOne: false
            referencedRelation: "payment_modes"
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
        Relationships: [
          {
            foreignKeyName: "sales_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "tax_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "uoms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          auth_user_id: string
          body: string | null
          company_id: string
          created_at: string
          id: string
          is_read: boolean
          link_url: string | null
          metadata: Json
          read_at: string | null
          title: string | null
        }
        Insert: {
          auth_user_id: string
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string | null
        }
        Update: {
          auth_user_id?: string
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          role: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          role?: string
          updated_at?: string
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
      vehicle_documents: {
        Row: {
          amount: number
          company_id: string
          competency_year: number
          created_at: string | null
          first_due_date: string
          id: string
          installments_count: number
          notes: string | null
          status: string
          type: string
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          amount: number
          company_id: string
          competency_year: number
          created_at?: string | null
          first_due_date: string
          id?: string
          installments_count?: number
          notes?: string | null
          status?: string
          type: string
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          competency_year?: number
          created_at?: string | null
          first_due_date?: string
          id?: string
          installments_count?: number
          notes?: string | null
          status?: string
          type?: string
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
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
      work_order_sequences: {
        Row: {
          company_id: string
          next_number: number
          updated_at: string
        }
        Insert: {
          company_id: string
          next_number: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          next_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
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
          parent_work_order_id: string | null
          planned_qty: number
          produced_qty: number
          route_id: string | null
          scheduled_date: string | null
          sector_id: string | null
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
          parent_work_order_id?: string | null
          planned_qty: number
          produced_qty?: number
          route_id?: string | null
          scheduled_date?: string | null
          sector_id?: string | null
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
          parent_work_order_id?: string | null
          planned_qty?: number
          produced_qty?: number
          route_id?: string | null
          scheduled_date?: string | null
          sector_id?: string | null
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
            foreignKeyName: "work_orders_parent_work_order_id_fkey"
            columns: ["parent_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "production_sectors"
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
      _resolve_uom_from_id: { Args: { p_uom_id: string }; Returns: string }
      backfill_commission_settlement_document_numbers: {
        Args: never
        Returns: undefined
      }
      backfill_work_order_document_numbers: { Args: never; Returns: undefined }
      cleanup_user_drafts: {
        Args: { p_company_id: string; p_exclude_id?: string; p_user_id: string }
        Returns: undefined
      }
      commission_apply_entitlement_rate_override: {
        Args: {
          p_changed_by: string
          p_company_id: string
          p_entitlement_id: string
          p_new_rate: number
          p_reason: string
          p_source_context: string
        }
        Returns: {
          adjustment_delta: number
          entitlement_id: string
          new_rate: number
          old_rate: number
          open_releases_count: number
          order_id: string
        }[]
      }
      commission_apply_order_rate_override: {
        Args: {
          p_changed_by: string
          p_company_id: string
          p_new_rate: number
          p_order_id: string
          p_reason: string
          p_source_context: string
        }
        Returns: {
          adjustment_delta: number
          new_rate: number
          old_rate: number
          open_entitlements_count: number
          open_releases_count: number
          order_id: string
        }[]
      }
      commission_confirm_settlement: {
        Args: {
          p_allow_advance: boolean
          p_company_id: string
          p_created_by: string
          p_cutoff_date: string
          p_rep_id: string
          p_request_key?: string
          p_selected_items: Json
          p_total_to_pay: number
        }
        Returns: {
          settlement_id: string
          status: string
          total_advance_selected: number
          total_paid: number
          total_released_selected: number
        }[]
      }
      commission_get_rep_open_items: {
        Args: { p_company_id: string; p_cutoff_date: string; p_rep_id: string }
        Returns: {
          base_delivered_amount: number
          commission_rate: number
          commission_total: number
          customer_id: string
          customer_name: string
          default_selected: boolean
          delivered_date: string
          delivery_item_id: string
          entitlement_id: string
          max_payable_amount: number
          order_id: string
          order_number: number
          release_item_ids: Json
          released_open_amount: number
          status_financeiro: string
          status_logistico: string
          total_open_amount: number
          unreleased_open_amount: number
        }[]
      }
      commission_refresh_rep_open_state: {
        Args: { p_company_id: string; p_cutoff_date: string; p_rep_id: string }
        Returns: undefined
      }
      create_financial_category_for_operational_expense: {
        Args: {
          p_company_id: string
          p_name: string
          p_parent_account_id: string
        }
        Returns: {
          account_code: string
          account_id: string
          category_id: string
          category_name: string
          is_active: boolean
        }[]
      }
      create_inbound_reversal_request: {
        Args: {
          p_company_id: string
          p_created_by?: string
          p_outbound_emission_id: string
          p_payload: Json
        }
        Returns: {
          existing: boolean
          job_id: string
          reversal_id: string
        }[]
      }
      create_revenue_category_for_finished_product: {
        Args: { p_company_id: string; p_name: string }
        Returns: {
          account_code: string
          account_id: string
          category_id: string
          category_name: string
          is_active: boolean
        }[]
      }
      create_work_orders_with_dependencies: {
        Args: {
          p_children?: Json
          p_company_id: string
          p_parent_bom_id: string
          p_parent_item_id: string
          p_parent_notes?: string
          p_parent_planned_qty: number
          p_parent_scheduled_date: string
          p_parent_sector_id?: string
        }
        Returns: Json
      }
      deduct_stock_from_route: {
        Args: { p_route_id: string; p_user_id: string }
        Returns: undefined
      }
      delete_revenue_category_if_unused: {
        Args: { p_category_id: string; p_company_id: string }
        Returns: {
          deleted_account_id: string
          deleted_category_id: string
          mode: string
        }[]
      }
      enqueue_manifest_event: {
        Args: {
          p_chnfe: string
          p_company_id: string
          p_environment: string
          p_event_type: string
          p_justification?: string
        }
        Returns: {
          chnfe: string
          company_id: string
          created_at: string
          environment: string
          event_type: string
          id: string
          justification: string | null
          last_error: string | null
          sefaz_protocol: string | null
          sefaz_receipt: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "fiscal_inbound_manifest_events"
          isOneToOne: true
          isSetofReturn: false
        }
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
      generate_next_revenue_code: {
        Args: { p_company_id: string }
        Returns: string
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
      mobile_ingest_events: {
        Args: { _events: Json; _token_hash: string }
        Returns: {
          event_id: string
          status: string
        }[]
      }
      mobile_validate_token: { Args: { _token_hash: string }; Returns: string }
      next_commission_settlement_number: {
        Args: { p_company_id: string }
        Returns: number
      }
      next_inventory_count_number: {
        Args: { p_company_id: string }
        Returns: number
      }
      next_production_sector_code: {
        Args: { p_company_id: string }
        Returns: string
      }
      next_work_order_number: {
        Args: { p_company_id: string }
        Returns: number
      }
      normalize_plate: { Args: { p_plate: string }; Returns: string }
      onboard_create_company: {
        Args: { _company_name: string; _slug: string }
        Returns: string
      }
      post_inventory_count: {
        Args: { p_inventory_count_id: string; p_posted_by: string }
        Returns: Json
      }
      post_work_order_entry: {
        Args: {
          p_company_id: string
          p_created_by: string
          p_divergence_type: string
          p_executed_batches: number
          p_idempotency_key: string
          p_mark_done?: boolean
          p_notes: string
          p_occurred_at: string
          p_produced_qty: number
          p_work_order_id: string
        }
        Returns: {
          created_movement_count: number
          expected_output_qty: number
          loss_qty: number
          posted: boolean
          produced_total: number
          work_order_status: string
        }[]
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
      seed_chart_spine: { Args: { p_company_id: string }; Returns: undefined }
      seed_default_uoms: {
        Args: { target_company_id: string }
        Returns: undefined
      }
      seed_financial_categories_for_operational_expenses: {
        Args: { p_company_id: string }
        Returns: number
      }
      seed_test_data: { Args: never; Returns: Json }
      set_ap_installment_allocations: {
        Args: { p_allocations: Json; p_installment_id: string }
        Returns: {
          amount: number
          ap_installment_id: string
          cost_center_id: string
          gl_account_id: string
          id: string
        }[]
      }
      set_ar_installment_allocations: {
        Args: { p_allocations: Json; p_installment_id: string }
        Returns: {
          amount: number
          ar_installment_id: string
          cost_center_id: string
          gl_account_id: string
          id: string
        }[]
      }
      set_default_packaging: {
        Args: {
          p_company_id: string
          p_item_id: string
          p_packaging_id: string
        }
        Returns: undefined
      }
      set_dfe_sync_result: {
        Args: {
          p_company_id: string
          p_environment: string
          p_last_error?: string
          p_last_nsu: string
          p_status: string
        }
        Returns: {
          company_id: string
          created_at: string
          environment: string
          id: string
          last_error: string | null
          last_nsu: string
          last_sync_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "fiscal_dfe_sync_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_dfe_sync_running: {
        Args: { p_company_id: string; p_environment: string }
        Returns: {
          company_id: string
          created_at: string
          environment: string
          id: string
          last_error: string | null
          last_nsu: string
          last_sync_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "fiscal_dfe_sync_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_revenue_category_active: {
        Args: {
          p_category_id: string
          p_company_id: string
          p_is_active: boolean
        }
        Returns: {
          account_id: string
          category_id: string
          is_active: boolean
        }[]
      }
      sync_order_logistic_status: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      title_case: { Args: { input_text: string }; Returns: string }
      update_sales_doc_logistic_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      upsert_inbound_dfe_batch: {
        Args: { p_company_id: string; p_environment: string; p_rows: Json }
        Returns: {
          inserted_count: number
          updated_count: number
        }[]
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
      factor_attachment_type_en:
        | "package_csv"
        | "package_zip"
        | "package_report"
        | "return_import"
        | "user_upload"
      factor_custody_status_en: "own" | "with_factor" | "repurchased"
      factor_item_action_en: "discount" | "buyback" | "due_date_change"
      factor_operation_status_en:
        | "draft"
        | "sent_to_factor"
        | "in_adjustment"
        | "completed"
        | "cancelled"
      factor_posting_type_en:
        | "ar_discount_settlement"
        | "ap_factor_cost"
        | "ap_buyback"
        | "ap_buyback_settlement"
      factor_response_status_en:
        | "pending"
        | "accepted"
        | "rejected"
        | "adjusted"
      financial_event_status_en:
        | "pending"
        | "attention"
        | "approving"
        | "approved"
        | "rejected"
      financial_status_en:
        | "pending"
        | "pre_posted"
        | "approved"
        | "in_review"
        | "cancelled"
        | "paid"
        | "overdue"
        | "partial"
      financial_status_enum:
        | "pending"
        | "pre_lancado"
        | "approved"
        | "em_revisao"
        | "cancelado"
        | "pago"
        | "atrasado"
        | "parcial"
      job_status: "pending" | "processing" | "completed" | "failed"
      logistics_status:
        | "pending"
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
        | "pending"
        | "roteirizado"
        | "agendado"
        | "expedition"
        | "em_rota"
        | "entregue"
        | "nao_entregue"
        | "devolvido"
        | "parcial"
        | "cancelado"
      sales_logistic_status_en:
        | "pending"
        | "routed"
        | "scheduled"
        | "expedition"
        | "in_route"
        | "delivered"
        | "not_delivered"
        | "returned"
        | "partial"
        | "cancelled"
        | "sandbox"
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
  graphql_public: {
    Enums: {},
  },
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
      factor_attachment_type_en: [
        "package_csv",
        "package_zip",
        "package_report",
        "return_import",
        "user_upload",
      ],
      factor_custody_status_en: ["own", "with_factor", "repurchased"],
      factor_item_action_en: ["discount", "buyback", "due_date_change"],
      factor_operation_status_en: [
        "draft",
        "sent_to_factor",
        "in_adjustment",
        "completed",
        "cancelled",
      ],
      factor_posting_type_en: [
        "ar_discount_settlement",
        "ap_factor_cost",
        "ap_buyback",
        "ap_buyback_settlement",
      ],
      factor_response_status_en: [
        "pending",
        "accepted",
        "rejected",
        "adjusted",
      ],
      financial_event_status_en: [
        "pending",
        "attention",
        "approving",
        "approved",
        "rejected",
      ],
      financial_status_en: [
        "pending",
        "pre_posted",
        "approved",
        "in_review",
        "cancelled",
        "paid",
        "overdue",
        "partial",
      ],
      financial_status_enum: [
        "pending",
        "pre_lancado",
        "approved",
        "em_revisao",
        "cancelado",
        "pago",
        "atrasado",
        "parcial",
      ],
      job_status: ["pending", "processing", "completed", "failed"],
      logistics_status: [
        "pending",
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
        "pending",
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
      sales_logistic_status_en: [
        "pending",
        "routed",
        "scheduled",
        "expedition",
        "in_route",
        "delivered",
        "not_delivered",
        "returned",
        "partial",
        "cancelled",
        "sandbox",
      ],
    },
  },
} as const

