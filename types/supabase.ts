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
      item_purchase_profiles: {
        Row: {
          company_id: string
          conversion_factor: number | null
          created_at: string
          id: string
          item_id: string
          lead_time_days: number | null
          notes: string | null
          preferred_supplier_id: string | null
          purchase_uom: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          conversion_factor?: number | null
          created_at?: string
          id?: string
          item_id: string
          lead_time_days?: number | null
          notes?: string | null
          preferred_supplier_id?: string | null
          purchase_uom?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          conversion_factor?: number | null
          created_at?: string
          id?: string
          item_id?: string
          lead_time_days?: number | null
          notes?: string | null
          preferred_supplier_id?: string | null
          purchase_uom?: string | null
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
      item_fiscal_profiles: {
        Row: {
          cest: string | null
          cfop_default: string | null
          cofins_rate: number | null
          company_id: string
          created_at: string
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
          cfop_default?: string | null
          cofins_rate?: number | null
          company_id: string
          created_at?: string
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
          cfop_default?: string | null
          cofins_rate?: number | null
          company_id?: string
          created_at?: string
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
      item_production_profiles: {
        Row: {
          batch_size: number | null
          company_id: string
          created_at: string
          default_bom_id: string | null
          id: string
          is_produced: boolean
          item_id: string
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
            foreignKeyName: "item_production_profiles_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          branch_id: string | null
          city: string | null
          company_id: string
          complement: string | null
          country: string
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
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
          company_id: string
          complement?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
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
          company_id?: string
          complement?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
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
          qty: number
          sort_order: number
          uom: string
        }
        Insert: {
          bom_id: string
          company_id: string
          component_item_id: string
          id?: string
          qty: number
          sort_order?: number
          uom: string
        }
        Update: {
          bom_id?: string
          company_id?: string
          component_item_id?: string
          id?: string
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
      companies: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
          gtin?: string | null
          brand?: string | null
          line?: string | null
          description?: string | null
          image_url?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
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
          cert_password_encrypted: string | null
          is_cert_password_saved: boolean | null
          cert_a1_storage_path: string | null
          cert_a1_uploaded_at: string | null
          cnae: string | null
          cnpj: string | null
          company_id: string
          created_at: string
          email: string | null
          ie: string | null
          im: string | null
          legal_name: string | null
          logo_path: string | null
          nfe_environment: string | null
          nfe_next_number: number | null
          nfe_series: string | null
          phone: string | null
          tax_regime: string | null
          trade_name: string | null
          updated_at: string
          website: string | null
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
          cert_password_encrypted?: string | null
          is_cert_password_saved?: boolean | null
          cert_a1_storage_path?: string | null
          cert_a1_uploaded_at?: string | null
          cnae?: string | null
          cnpj?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          ie?: string | null
          im?: string | null
          legal_name?: string | null
          logo_path?: string | null
          nfe_environment?: string | null
          nfe_next_number?: number | null
          nfe_series?: string | null
          phone?: string | null
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
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
          cert_password_encrypted?: string | null
          is_cert_password_saved?: boolean | null
          cert_a1_storage_path?: string | null
          cert_a1_uploaded_at?: string | null
          cnae?: string | null
          cnpj?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          ie?: string | null
          im?: string | null
          legal_name?: string | null
          logo_path?: string | null
          nfe_environment?: string | null
          nfe_next_number?: number | null
          nfe_series?: string | null
          phone?: string | null
          tax_regime?: string | null
          trade_name?: string | null
          updated_at?: string
          website?: string | null
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
      inventory_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_id: string
          notes: string | null
          qty_in: number
          qty_out: number
          reason: string
          ref_id: string | null
          ref_type: string | null
          total_cost: number
          unit_cost: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          qty_in?: number
          qty_out?: number
          reason: string
          ref_id?: string | null
          ref_type?: string | null
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          qty_in?: number
          qty_out?: number
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
          total_cost?: number
          unit_cost?: number
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
      items: {
        Row: {
          avg_cost: number
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          sku: string | null
          type: string
          uom: string
          updated_at: string
          gtin: string | null
          brand: string | null
          line: string | null
          description: string | null
          image_url: string | null
        }
        Insert: {
          avg_cost?: number
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          sku?: string | null
          type: string
          uom: string
          updated_at?: string
          gtin?: string | null
          brand?: string | null
          line?: string | null
          description?: string | null
          image_url?: string | null
        }
        Update: {
          avg_cost?: number
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sku?: string | null
          type?: string
          uom?: string
          updated_at?: string
          gtin?: string | null
          brand?: string | null
          line?: string | null
          description?: string | null
          image_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          default_payment_terms_days: number | null
          deleted_at: string | null
          document: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          email_nfe: string | null
          freight_terms: string | null
          id: string
          ie_indicator: string
          is_public_agency: boolean
          is_simple_national: boolean
          legal_name: string | null
          municipal_registration: string | null
          notes: string | null
          notes_commercial: string | null
          phone: string | null
          price_table_id: string | null
          sales_rep_user_id: string | null
          state_registration: string | null
          status: string
          suframa: string | null
          trade_name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          country_code?: string
          created_at?: string
          default_payment_terms_days?: number | null
          deleted_at?: string | null
          document?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          email_nfe?: string | null
          freight_terms?: string | null
          id?: string
          ie_indicator?: string
          is_public_agency?: boolean
          is_simple_national?: boolean
          legal_name?: string | null
          municipal_registration?: string | null
          notes?: string | null
          notes_commercial?: string | null
          phone?: string | null
          price_table_id?: string | null
          sales_rep_user_id?: string | null
          state_registration?: string | null
          status?: string
          suframa?: string | null
          trade_name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          country_code?: string
          created_at?: string
          default_payment_terms_days?: number | null
          deleted_at?: string | null
          document?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          email_nfe?: string | null
          freight_terms?: string | null
          id?: string
          ie_indicator?: string
          is_public_agency?: boolean
          is_simple_national?: boolean
          legal_name?: string | null
          municipal_registration?: string | null
          notes?: string | null
          notes_commercial?: string | null
          phone?: string | null
          price_table_id?: string | null
          sales_rep_user_id?: string | null
          state_registration?: string | null
          status?: string
          suframa?: string | null
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
        ]
      }
      people: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
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
          role: string
          job_title: string | null
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
          role: string
          job_title?: string | null
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
          role?: string
          job_title?: string | null
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
          finished_at: string | null
          id: string
          item_id: string
          notes: string | null
          planned_qty: number
          produced_qty: number
          started_at: string | null
          status: string
          updated_at: string
          scheduled_date: string | null
          route_id: string | null
        }
        Insert: {
          bom_id?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          finished_at?: string | null
          id?: string
          item_id: string
          notes?: string | null
          planned_qty: number
          produced_qty?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          scheduled_date?: string | null
          route_id?: string | null
        }
        Update: {
          bom_id?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          finished_at?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          planned_qty?: number
          produced_qty?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          scheduled_date?: string | null
          route_id?: string | null
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
      [_ in never]: never
    }
    Functions: {
      is_company_member_for_path: {
        Args: { storage_path: string }
        Returns: boolean
      }
      is_member_of: { Args: { _company_id: string }; Returns: boolean }
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
