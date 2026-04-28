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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          module: string
          record_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          module: string
          record_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          module?: string
          record_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      backups_metadata: {
        Row: {
          backup_scope: string
          backup_size_bytes: number | null
          backup_status: string
          backup_type: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          integrity_status: string | null
          message: string | null
          started_at: string | null
          storage_location: string | null
          updated_at: string
        }
        Insert: {
          backup_scope: string
          backup_size_bytes?: number | null
          backup_status: string
          backup_type: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          integrity_status?: string | null
          message?: string | null
          started_at?: string | null
          storage_location?: string | null
          updated_at?: string
        }
        Update: {
          backup_scope?: string
          backup_size_bytes?: number | null
          backup_status?: string
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          integrity_status?: string | null
          message?: string | null
          started_at?: string | null
          storage_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backups_metadata_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          bank_name: string | null
          bic: string | null
          billing_address: Json | null
          company_name: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          external_customer_id: string | null
          iban: string | null
          id: string
          phone: string | null
          raw_data: Json | null
          shipping_address: Json | null
          source_system: string
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          bic?: string | null
          billing_address?: Json | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          external_customer_id?: string | null
          iban?: string | null
          id?: string
          phone?: string | null
          raw_data?: Json | null
          shipping_address?: Json | null
          source_system: string
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          bic?: string | null
          billing_address?: Json | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          external_customer_id?: string | null
          iban?: string | null
          id?: string
          phone?: string | null
          raw_data?: Json | null
          shipping_address?: Json | null
          source_system?: string
          updated_at?: string
        }
        Relationships: []
      }
      deleted_customers: {
        Row: {
          company_name: string | null
          deleted_at: string
          deleted_by: string | null
          external_customer_id: string
          id: string
          source_system: string
        }
        Insert: {
          company_name?: string | null
          deleted_at?: string
          deleted_by?: string | null
          external_customer_id: string
          id?: string
          source_system: string
        }
        Update: {
          company_name?: string | null
          deleted_at?: string
          deleted_by?: string | null
          external_customer_id?: string
          id?: string
          source_system?: string
        }
        Relationships: [
          {
            foreignKeyName: "deleted_customers_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      finance_records: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          due_date: string | null
          finance_note: string | null
          id: string
          invoice_status: string | null
          last_checked_at: string | null
          order_id: string
          payment_status: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          due_date?: string | null
          finance_note?: string | null
          id?: string
          invoice_status?: string | null
          last_checked_at?: string | null
          order_id: string
          payment_status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          due_date?: string | null
          finance_note?: string | null
          id?: string
          invoice_status?: string | null
          last_checked_at?: string | null
          order_id?: string
          payment_status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_records_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_sessions: {
        Row: {
          created_at: string
          device_info: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          last_reauth_at: string | null
          otp_verified_at: string | null
          reauth_required: boolean
          session_context: string | null
          session_token: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_reauth_at?: string | null
          otp_verified_at?: string | null
          reauth_required?: boolean
          session_context?: string | null
          session_token?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_reauth_at?: string | null
          otp_verified_at?: string | null
          reauth_required?: boolean
          session_context?: string | null
          session_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_documents: {
        Row: {
          created_at: string
          document_type: string | null
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          order_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          order_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          order_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_import_logs: {
        Row: {
          created_at: string
          external_customer_id: string | null
          external_order_id: string | null
          id: string
          import_status: string
          imported_by: string | null
          message: string | null
          order_number: string | null
          source_system: string
        }
        Insert: {
          created_at?: string
          external_customer_id?: string | null
          external_order_id?: string | null
          id?: string
          import_status?: string
          imported_by?: string | null
          message?: string | null
          order_number?: string | null
          source_system: string
        }
        Update: {
          created_at?: string
          external_customer_id?: string | null
          external_order_id?: string | null
          id?: string
          import_status?: string
          imported_by?: string | null
          message?: string | null
          order_number?: string | null
          source_system?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_import_logs_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          discount: number | null
          external_item_id: string | null
          id: string
          item_name: string | null
          item_order: number | null
          order_id: string
          quantity: number | null
          rate: number | null
          raw_data: Json | null
          sku: string | null
          tax_amount: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          discount?: number | null
          external_item_id?: string | null
          id?: string
          item_name?: string | null
          item_order?: number | null
          order_id: string
          quantity?: number | null
          rate?: number | null
          raw_data?: Json | null
          sku?: string | null
          tax_amount?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          discount?: number | null
          external_item_id?: string | null
          id?: string
          item_name?: string | null
          item_order?: number | null
          order_id?: string
          quantity?: number | null
          rate?: number | null
          raw_data?: Json | null
          sku?: string | null
          tax_amount?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_internal: boolean
          note_text: string
          note_type: string | null
          order_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean
          note_text: string
          note_type?: string | null
          order_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean
          note_text?: string
          note_type?: string | null
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          change_note: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          order_id: string
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          order_id: string
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          created_at: string
          currency: string | null
          customer_id: string
          expected_shipment_date: string | null
          external_order_id: string | null
          id: string
          order_date: string | null
          order_number: string
          order_status: string | null
          raw_data: Json | null
          salesperson_name: string | null
          shipping_address: Json | null
          source_system: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string
          currency?: string | null
          customer_id: string
          expected_shipment_date?: string | null
          external_order_id?: string | null
          id?: string
          order_date?: string | null
          order_number: string
          order_status?: string | null
          raw_data?: Json | null
          salesperson_name?: string | null
          shipping_address?: Json | null
          source_system: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          billing_address?: Json | null
          created_at?: string
          currency?: string | null
          customer_id?: string
          expected_shipment_date?: string | null
          external_order_id?: string | null
          id?: string
          order_date?: string | null
          order_number?: string
          order_status?: string | null
          raw_data?: Json | null
          salesperson_name?: string | null
          shipping_address?: Json | null
          source_system?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_challenges: {
        Row: {
          attempt_count: number
          blocked_at: string | null
          challenge_reason: string | null
          challenge_status: string
          channel: string
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          otp_hash: string | null
          sent_at: string | null
          session_id: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempt_count?: number
          blocked_at?: string | null
          challenge_reason?: string | null
          challenge_status?: string
          channel: string
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          otp_hash?: string | null
          sent_at?: string | null
          session_id?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempt_count?: number
          blocked_at?: string | null
          challenge_reason?: string | null
          challenge_status?: string
          channel?: string
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          otp_hash?: string | null
          sent_at?: string | null
          session_id?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otp_challenges_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "login_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "otp_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          item_name: string | null
          item_order: number | null
          production_order_id: string
          quantity: number | null
          sku: string | null
          source_order_item_id: string | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_name?: string | null
          item_order?: number | null
          production_order_id: string
          quantity?: number | null
          sku?: string | null
          source_order_item_id?: string | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_name?: string | null
          item_order?: number | null
          production_order_id?: string
          quantity?: number | null
          sku?: string | null
          source_order_item_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_order_items_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          anmerkungen: string | null
          bearbeiter: string
          created_at: string
          created_by: string | null
          farbe: string
          id: string
          liefertermin: string
          modellname: string | null
          order_id: string
          order_number: string
          pdf_path: string | null
          power_handstueck: string
          sent_at: string | null
          seriennummer: string | null
          sonderwuensche: string | null
          status: string
          supplier_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          anmerkungen?: string | null
          bearbeiter: string
          created_at?: string
          created_by?: string | null
          farbe: string
          id?: string
          liefertermin: string
          modellname?: string | null
          order_id: string
          order_number: string
          pdf_path?: string | null
          power_handstueck: string
          sent_at?: string | null
          seriennummer?: string | null
          sonderwuensche?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          anmerkungen?: string | null
          bearbeiter?: string
          created_at?: string
          created_by?: string | null
          farbe?: string
          id?: string
          liefertermin?: string
          modellname?: string | null
          order_id?: string
          order_number?: string
          pdf_path?: string | null
          power_handstueck?: string
          sent_at?: string | null
          seriennummer?: string | null
          sonderwuensche?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      route_plans: {
        Row: {
          assigned_employee: string | null
          assigned_team: string | null
          created_at: string
          created_by: string | null
          id: string
          location_address: Json | null
          order_id: string
          planned_date: string | null
          planning_note: string | null
          planning_status: string
          priority: string | null
          time_window_end: string | null
          time_window_start: string | null
          updated_at: string
          updated_by: string | null
          vehicle_info: string | null
        }
        Insert: {
          assigned_employee?: string | null
          assigned_team?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_address?: Json | null
          order_id: string
          planned_date?: string | null
          planning_note?: string | null
          planning_status?: string
          priority?: string | null
          time_window_end?: string | null
          time_window_start?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_info?: string | null
        }
        Update: {
          assigned_employee?: string | null
          assigned_team?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_address?: Json | null
          order_id?: string
          planned_date?: string | null
          planning_note?: string | null
          planning_status?: string
          priority?: string | null
          time_window_end?: string | null
          time_window_start?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_plans_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string | null
          id: string
          invitation_status: string
          sent_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invitation_status?: string
          sent_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invitation_status?: string
          sent_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          account_status: string
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string | null
          id: string
          invitation_status: string
          is_active: boolean
          last_otp_verified_at: string | null
          otp_channel: string
          password_reset_required: boolean
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          invitation_status?: string
          is_active?: boolean
          last_otp_verified_at?: string | null
          otp_channel?: string
          password_reset_required?: boolean
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          invitation_status?: string
          is_active?: boolean
          last_otp_verified_at?: string | null
          otp_channel?: string
          password_reset_required?: boolean
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_finance: { Args: never; Returns: boolean }
      can_access_import_logs: { Args: never; Returns: boolean }
      can_access_orders: { Args: never; Returns: boolean }
      can_access_planning: { Args: never; Returns: boolean }
      can_manage_orders: { Args: never; Returns: boolean }
      can_manage_planning: { Args: never; Returns: boolean }
      has_role: { Args: { check_role: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      requires_reauth: { Args: never; Returns: boolean }
      session_requires_reauth: { Args: never; Returns: boolean }
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
