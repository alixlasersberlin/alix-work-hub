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
      audit_findings: {
        Row: {
          area: string | null
          audit_date: string | null
          audit_name: string
          auditor: string | null
          capa_id: string | null
          created_at: string
          created_by: string | null
          description: string
          finding_number: string | null
          finding_type: string
          id: string
          reference: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area?: string | null
          audit_date?: string | null
          audit_name: string
          auditor?: string | null
          capa_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          finding_number?: string | null
          finding_type?: string
          id?: string
          reference?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area?: string | null
          audit_date?: string | null
          audit_name?: string
          auditor?: string | null
          capa_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          finding_number?: string | null
          finding_type?: string
          id?: string
          reference?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capas"
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
          file_count: number | null
          id: string
          integrity_status: string | null
          message: string | null
          notify_email: string | null
          started_at: string | null
          storage_location: string | null
          storage_path: string | null
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
          file_count?: number | null
          id?: string
          integrity_status?: string | null
          message?: string | null
          notify_email?: string | null
          started_at?: string | null
          storage_location?: string | null
          storage_path?: string | null
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
          file_count?: number | null
          id?: string
          integrity_status?: string | null
          message?: string | null
          notify_email?: string | null
          started_at?: string | null
          storage_location?: string | null
          storage_path?: string | null
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
      bank_financing_requests: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          decision_text: string | null
          down_payment: number | null
          has_offer: boolean
          id: string
          in_processing: boolean
          in_processing_date: string | null
          in_processing_note: string | null
          offer_file_path: string | null
          order_id: string
          purchase_price: number | null
          request_date: string | null
          residual_value: number | null
          status: string
          term_months: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          decision_text?: string | null
          down_payment?: number | null
          has_offer?: boolean
          id?: string
          in_processing?: boolean
          in_processing_date?: string | null
          in_processing_note?: string | null
          offer_file_path?: string | null
          order_id: string
          purchase_price?: number | null
          request_date?: string | null
          residual_value?: number | null
          status?: string
          term_months?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          decision_text?: string | null
          down_payment?: number | null
          has_offer?: boolean
          id?: string
          in_processing?: boolean
          in_processing_date?: string | null
          in_processing_note?: string | null
          offer_file_path?: string | null
          order_id?: string
          purchase_price?: number | null
          request_date?: string | null
          residual_value?: number | null
          status?: string
          term_months?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_financing_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bugs: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          criticality: string
          description: string | null
          due_date: string | null
          id: string
          module: string | null
          priority: string
          product: string | null
          reporter_id: string
          software_version: string | null
          status: string
          ticket_number: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: string
          description?: string | null
          due_date?: string | null
          id?: string
          module?: string | null
          priority?: string
          product?: string | null
          reporter_id: string
          software_version?: string | null
          status?: string
          ticket_number?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: string
          description?: string | null
          due_date?: string | null
          id?: string
          module?: string | null
          priority?: string
          product?: string | null
          reporter_id?: string
          software_version?: string | null
          status?: string
          ticket_number?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      capa_actions: {
        Row: {
          action_text: string
          audit_finding_id: string | null
          bug_id: string | null
          capa_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          evidence_text: string | null
          id: string
          responsible_id: string | null
          source: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action_text: string
          audit_finding_id?: string | null
          bug_id?: string | null
          capa_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          evidence_text?: string | null
          id?: string
          responsible_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action_text?: string
          audit_finding_id?: string | null
          bug_id?: string | null
          capa_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          evidence_text?: string | null
          id?: string
          responsible_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capa_actions_audit_finding_id_fkey"
            columns: ["audit_finding_id"]
            isOneToOne: false
            referencedRelation: "audit_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_actions_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capa_actions_capa_id_fkey"
            columns: ["capa_id"]
            isOneToOne: false
            referencedRelation: "capas"
            referencedColumns: ["id"]
          },
        ]
      }
      capas: {
        Row: {
          audit_finding_id: string | null
          bug_id: string | null
          capa_number: string | null
          closure_approved_at: string | null
          closure_approved_by: string | null
          corrective_action: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          effectiveness_check: string | null
          effectiveness_ok: boolean | null
          id: string
          immediate_action: string | null
          preventive_action: string | null
          production_order_id: string | null
          responsible_id: string | null
          root_cause: string | null
          status: string
          title: string
          trigger_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audit_finding_id?: string | null
          bug_id?: string | null
          capa_number?: string | null
          closure_approved_at?: string | null
          closure_approved_by?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          effectiveness_check?: string | null
          effectiveness_ok?: boolean | null
          id?: string
          immediate_action?: string | null
          preventive_action?: string | null
          production_order_id?: string | null
          responsible_id?: string | null
          root_cause?: string | null
          status?: string
          title: string
          trigger_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audit_finding_id?: string | null
          bug_id?: string | null
          capa_number?: string | null
          closure_approved_at?: string | null
          closure_approved_by?: string | null
          corrective_action?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          effectiveness_check?: string | null
          effectiveness_ok?: boolean | null
          id?: string
          immediate_action?: string | null
          preventive_action?: string | null
          production_order_id?: string | null
          responsible_id?: string | null
          root_cause?: string | null
          status?: string
          title?: string
          trigger_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capas_audit_finding_fk"
            columns: ["audit_finding_id"]
            isOneToOne: false
            referencedRelation: "audit_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capas_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bugs"
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
          created_by: string | null
          email: string | null
          external_customer_id: string | null
          iban: string | null
          id: string
          is_vip: boolean
          phone: string | null
          raw_data: Json | null
          shipping_address: Json | null
          source_system: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bank_name?: string | null
          bic?: string | null
          billing_address?: Json | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          external_customer_id?: string | null
          iban?: string | null
          id?: string
          is_vip?: boolean
          phone?: string | null
          raw_data?: Json | null
          shipping_address?: Json | null
          source_system: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bank_name?: string | null
          bic?: string | null
          billing_address?: Json | null
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          external_customer_id?: string | null
          iban?: string | null
          id?: string
          is_vip?: boolean
          phone?: string | null
          raw_data?: Json | null
          shipping_address?: Json | null
          source_system?: string
          updated_at?: string
          user_id?: string | null
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
      email_templates: {
        Row: {
          body: string
          display_name: string
          id: string
          placeholders: string[]
          subject: string
          template_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          display_name: string
          id?: string
          placeholders?: string[]
          subject: string
          template_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          display_name?: string
          id?: string
          placeholders?: string[]
          subject?: string
          template_key?: string
          updated_at?: string
          updated_by?: string | null
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
      invoice_workflow_states: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_key: string
          invoice_number: string | null
          note: string | null
          source: string
          updated_at: string
          updated_by: string | null
          workflow_status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_key: string
          invoice_number?: string | null
          note?: string | null
          source: string
          updated_at?: string
          updated_by?: string | null
          workflow_status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_key?: string
          invoice_number?: string | null
          note?: string | null
          source?: string
          updated_at?: string
          updated_by?: string | null
          workflow_status?: string
        }
        Relationships: []
      }
      item_category_assignments: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          id: string
          item_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      lager_devices: {
        Row: {
          airtable_record_id: string | null
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          model_name: string
          notes: string | null
          reservation_week: string | null
          reserved_order_id: string | null
          serial_number: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          airtable_record_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          model_name: string
          notes?: string | null
          reservation_week?: string | null
          reserved_order_id?: string | null
          serial_number: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          airtable_record_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          model_name?: string
          notes?: string | null
          reservation_week?: string | null
          reserved_order_id?: string | null
          serial_number?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      mail_audit_logs: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mail_automation_runs: {
        Row: {
          automation_id: string
          created_at: string
          customer_id: string | null
          error_message: string | null
          executed_at: string
          id: string
          invoice_id: string | null
          message_id: string | null
          order_id: string | null
          repair_id: string | null
          status: string
          ticket_id: string | null
        }
        Insert: {
          automation_id: string
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          executed_at?: string
          id?: string
          invoice_id?: string | null
          message_id?: string | null
          order_id?: string | null
          repair_id?: string | null
          status?: string
          ticket_id?: string | null
        }
        Update: {
          automation_id?: string
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          executed_at?: string
          id?: string
          invoice_id?: string | null
          message_id?: string | null
          order_id?: string | null
          repair_id?: string | null
          status?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mail_automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "mail_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_automations: {
        Row: {
          created_at: string
          created_by: string | null
          delay_minutes: number
          department: string | null
          description: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_run_at: string | null
          name: string
          sender_email: string | null
          sender_name: string | null
          status: string
          template_id: string | null
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delay_minutes?: number
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_run_at?: string | null
          name: string
          sender_email?: string | null
          sender_name?: string | null
          status?: string
          template_id?: string | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delay_minutes?: number
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_run_at?: string | null
          name?: string
          sender_email?: string | null
          sender_name?: string | null
          status?: string
          template_id?: string | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      mail_campaigns: {
        Row: {
          audience_label: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          error_message: string | null
          id: string
          language: string | null
          name: string
          recipient_count: number | null
          reply_to: string | null
          scheduled_at: string | null
          segment_id: string | null
          sender_email: string | null
          sender_name: string | null
          sent_at: string | null
          status: string
          subject: string
          target_filter: Json | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          audience_label?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          language?: string | null
          name: string
          recipient_count?: number | null
          reply_to?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          target_filter?: Json | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          audience_label?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          language?: string | null
          name?: string
          recipient_count?: number | null
          reply_to?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          target_filter?: Json | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mail_domains: {
        Row: {
          api_key_encrypted: string | null
          created_at: string | null
          domain: string
          id: string
          is_active: boolean | null
          provider: string | null
          sender_email: string
          sender_name: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string | null
          domain: string
          id?: string
          is_active?: boolean | null
          provider?: string | null
          sender_email: string
          sender_name?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
          provider?: string | null
          sender_email?: string
          sender_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mail_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: string | null
          message_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          message_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          message_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mail_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mail_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          bounced_at: string | null
          clicked_at: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          domain_id: string | null
          error_message: string | null
          from_email: string
          from_name: string | null
          id: string
          invoice_id: string | null
          opened_at: string | null
          order_id: string | null
          provider_message_id: string | null
          repair_id: string | null
          reply_to: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_id: string | null
          ticket_id: string | null
          to_email: string
          to_name: string | null
          unsubscribed_at: string | null
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          domain_id?: string | null
          error_message?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          invoice_id?: string | null
          opened_at?: string | null
          order_id?: string | null
          provider_message_id?: string | null
          repair_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          ticket_id?: string | null
          to_email: string
          to_name?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          domain_id?: string | null
          error_message?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          invoice_id?: string | null
          opened_at?: string | null
          order_id?: string | null
          provider_message_id?: string | null
          repair_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          ticket_id?: string | null
          to_email?: string
          to_name?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mail_messages_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "mail_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "mail_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_recipients: {
        Row: {
          bounced_at: string | null
          campaign_id: string
          clicked_at: string | null
          company: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          email: string
          id: string
          name: string | null
          opened_at: string | null
          sent_at: string | null
          status: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          bounced_at?: string | null
          campaign_id: string
          clicked_at?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          email: string
          id?: string
          name?: string | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string
          clicked_at?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          email?: string
          id?: string
          name?: string | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mail_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          id: string
          is_active: boolean | null
          language: string | null
          name: string
          subject: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          name: string
          subject: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          name?: string
          subject?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      mail_unsubscribes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          email: string
          id: string
          reason: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          email: string
          id?: string
          reason?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          email?: string
          id?: string
          reason?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_additional_deposits: {
        Row: {
          amount: number
          booking_date: string
          created_at: string
          created_by: string | null
          geleistet: boolean
          id: string
          note: string | null
          order_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          booking_date: string
          created_at?: string
          created_by?: string | null
          geleistet?: boolean
          id?: string
          note?: string | null
          order_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_date?: string
          created_at?: string
          created_by?: string | null
          geleistet?: boolean
          id?: string
          note?: string | null
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_additional_deposits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_at_approval: {
        Row: {
          bestellfreigabe: boolean
          bezahlt: boolean
          created_at: string
          created_by: string | null
          datum_zahlung: string | null
          id: string
          name: string | null
          oder: string | null
          order_id: string
          rechnung: boolean
          rechnungswert: number | null
          restsumme: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bestellfreigabe?: boolean
          bezahlt?: boolean
          created_at?: string
          created_by?: string | null
          datum_zahlung?: string | null
          id?: string
          name?: string | null
          oder?: string | null
          order_id: string
          rechnung?: boolean
          rechnungswert?: number | null
          restsumme?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bestellfreigabe?: boolean
          bezahlt?: boolean
          created_at?: string
          created_by?: string | null
          datum_zahlung?: string | null
          id?: string
          name?: string | null
          oder?: string | null
          order_id?: string
          rechnung?: boolean
          rechnungswert?: number | null
          restsumme?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      order_at_purchase: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string | null
          einkaufspreis: number | null
          id: string
          note: string | null
          order_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          einkaufspreis?: number | null
          id?: string
          note?: string | null
          order_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          einkaufspreis?: number | null
          id?: string
          note?: string | null
          order_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          deposit_additional: number | null
          deposit_amount: number | null
          deposit_booking_date: string | null
          deposit_ok: boolean
          deposit_ok_at: string | null
          deposit_ok_by: string | null
          expected_shipment_date: string | null
          external_order_id: string | null
          id: string
          internal_number: string | null
          is_vip: boolean
          lawyer_reason: string | null
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
          deposit_additional?: number | null
          deposit_amount?: number | null
          deposit_booking_date?: string | null
          deposit_ok?: boolean
          deposit_ok_at?: string | null
          deposit_ok_by?: string | null
          expected_shipment_date?: string | null
          external_order_id?: string | null
          id?: string
          internal_number?: string | null
          is_vip?: boolean
          lawyer_reason?: string | null
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
          deposit_additional?: number | null
          deposit_amount?: number | null
          deposit_booking_date?: string | null
          deposit_ok?: boolean
          deposit_ok_at?: string | null
          deposit_ok_by?: string | null
          expected_shipment_date?: string | null
          external_order_id?: string | null
          id?: string
          internal_number?: string | null
          is_vip?: boolean
          lawyer_reason?: string | null
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
      product_categories: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          approval_note: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          attachment_pdf_path: string | null
          bearbeiter: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          farbe: string
          id: string
          invoice_pdf_path: string | null
          is_reclamation: boolean
          liefertermin: string
          modellname: string | null
          order_id: string | null
          order_number: string | null
          payment_status: string
          pdf_path: string | null
          photo_front_path: string | null
          photo_left_path: string | null
          photo_right_path: string | null
          power_handstueck: string
          production_order_number: string | null
          reclamation_reason: string | null
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
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attachment_pdf_path?: string | null
          bearbeiter: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          farbe: string
          id?: string
          invoice_pdf_path?: string | null
          is_reclamation?: boolean
          liefertermin: string
          modellname?: string | null
          order_id?: string | null
          order_number?: string | null
          payment_status?: string
          pdf_path?: string | null
          photo_front_path?: string | null
          photo_left_path?: string | null
          photo_right_path?: string | null
          power_handstueck: string
          production_order_number?: string | null
          reclamation_reason?: string | null
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
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          attachment_pdf_path?: string | null
          bearbeiter?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          farbe?: string
          id?: string
          invoice_pdf_path?: string | null
          is_reclamation?: boolean
          liefertermin?: string
          modellname?: string | null
          order_id?: string | null
          order_number?: string | null
          payment_status?: string
          pdf_path?: string | null
          photo_front_path?: string | null
          photo_left_path?: string | null
          photo_right_path?: string | null
          power_handstueck?: string
          production_order_number?: string | null
          reclamation_reason?: string | null
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
            foreignKeyName: "production_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      qm_attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      qm_comments: {
        Row: {
          comment_text: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
      }
      repair_attachments: {
        Row: {
          category: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          repair_order_id: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          repair_order_id: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          repair_order_id?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_attachments_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_communications: {
        Row: {
          approval_required: boolean
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          communication_type: string
          created_at: string
          created_by: string | null
          direction: string
          id: string
          message_body: string | null
          recipient_email: string | null
          repair_order_id: string
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_required?: boolean
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          communication_type?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          message_body?: string | null
          recipient_email?: string | null
          repair_order_id: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_required?: boolean
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          communication_type?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          message_body?: string | null
          recipient_email?: string | null
          repair_order_id?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_communications_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_delivery_handover: {
        Row: {
          created_at: string
          delivered_at: string
          delivered_by: string | null
          id: string
          notes: string | null
          recipient_name: string | null
          repair_order_id: string
          signature_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string
          delivered_by?: string | null
          id?: string
          notes?: string | null
          recipient_name?: string | null
          repair_order_id: string
          signature_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string
          delivered_by?: string | null
          id?: string
          notes?: string | null
          recipient_name?: string | null
          repair_order_id?: string
          signature_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_delivery_handover_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_finance_handover: {
        Row: {
          created_at: string
          currency: string
          handed_over_at: string
          handed_over_by: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          repair_order_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          handed_over_at?: string
          handed_over_by?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          repair_order_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          handed_over_at?: string
          handed_over_by?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          repair_order_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_finance_handover_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_orders: {
        Row: {
          accessories: string | null
          actual_cost: number | null
          address_city: string | null
          address_country: string | null
          address_street: string | null
          address_zip: string | null
          assigned_supplier_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_company: string | null
          customer_contact: string | null
          customer_email: string | null
          customer_error_description: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          device_brand: string | null
          device_category: string | null
          device_model: string | null
          device_serial_number: string | null
          device_type: string | null
          diagnosis: string | null
          error_permanent: boolean | null
          estimated_cost: number | null
          handover_signature_path: string | null
          id: string
          intake_signature_path: string | null
          internal_notes: string | null
          issue_description: string | null
          order_id: string | null
          order_number: string | null
          powers_on: boolean | null
          priority: string
          purchase_date: string | null
          repair_number: string | null
          repair_status: string
          sent_to_finance: boolean
          sent_to_finance_at: string | null
          sent_to_route_planning: boolean
          sent_to_route_planning_at: string | null
          updated_at: string
          updated_by: string | null
          visible_damages: string | null
          work_order_pdf_path: string | null
        }
        Insert: {
          accessories?: string | null
          actual_cost?: number | null
          address_city?: string | null
          address_country?: string | null
          address_street?: string | null
          address_zip?: string | null
          assigned_supplier_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_company?: string | null
          customer_contact?: string | null
          customer_email?: string | null
          customer_error_description?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          device_brand?: string | null
          device_category?: string | null
          device_model?: string | null
          device_serial_number?: string | null
          device_type?: string | null
          diagnosis?: string | null
          error_permanent?: boolean | null
          estimated_cost?: number | null
          handover_signature_path?: string | null
          id?: string
          intake_signature_path?: string | null
          internal_notes?: string | null
          issue_description?: string | null
          order_id?: string | null
          order_number?: string | null
          powers_on?: boolean | null
          priority?: string
          purchase_date?: string | null
          repair_number?: string | null
          repair_status?: string
          sent_to_finance?: boolean
          sent_to_finance_at?: string | null
          sent_to_route_planning?: boolean
          sent_to_route_planning_at?: string | null
          updated_at?: string
          updated_by?: string | null
          visible_damages?: string | null
          work_order_pdf_path?: string | null
        }
        Update: {
          accessories?: string | null
          actual_cost?: number | null
          address_city?: string | null
          address_country?: string | null
          address_street?: string | null
          address_zip?: string | null
          assigned_supplier_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_company?: string | null
          customer_contact?: string | null
          customer_email?: string | null
          customer_error_description?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          device_brand?: string | null
          device_category?: string | null
          device_model?: string | null
          device_serial_number?: string | null
          device_type?: string | null
          diagnosis?: string | null
          error_permanent?: boolean | null
          estimated_cost?: number | null
          handover_signature_path?: string | null
          id?: string
          intake_signature_path?: string | null
          internal_notes?: string | null
          issue_description?: string | null
          order_id?: string | null
          order_number?: string | null
          powers_on?: boolean | null
          priority?: string
          purchase_date?: string | null
          repair_number?: string | null
          repair_status?: string
          sent_to_finance?: boolean
          sent_to_finance_at?: string | null
          sent_to_route_planning?: boolean
          sent_to_route_planning_at?: string | null
          updated_at?: string
          updated_by?: string | null
          visible_damages?: string | null
          work_order_pdf_path?: string | null
        }
        Relationships: []
      }
      repair_parts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_name: string
          notes: string | null
          order_status: string
          quantity: number
          received: boolean
          received_at: string | null
          repair_order_id: string
          sku: string | null
          supplier_id: string | null
          supplier_name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_name: string
          notes?: string | null
          order_status?: string
          quantity?: number
          received?: boolean
          received_at?: string | null
          repair_order_id: string
          sku?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          order_status?: string
          quantity?: number
          received?: boolean
          received_at?: string | null
          repair_order_id?: string
          sku?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_parts_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_signatures: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          repair_order_id: string
          signed_at: string
          signer_name: string
          storage_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          repair_order_id: string
          signed_at?: string
          signer_name: string
          storage_path: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          repair_order_id?: string
          signed_at?: string
          signer_name?: string
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_signatures_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_spare_parts: {
        Row: {
          created_at: string
          currency: string
          id: string
          notes: string | null
          ordered_at: string | null
          part_name: string
          part_number: string | null
          quantity: number
          received_at: string | null
          repair_order_id: string
          status: string
          supplier: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          ordered_at?: string | null
          part_name: string
          part_number?: string | null
          quantity?: number
          received_at?: string | null
          repair_order_id: string
          status?: string
          supplier?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          ordered_at?: string | null
          part_name?: string
          part_number?: string | null
          quantity?: number
          received_at?: string | null
          repair_order_id?: string
          status?: string
          supplier?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_spare_parts_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_status_history: {
        Row: {
          change_note: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          repair_order_id: string
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          repair_order_id: string
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          repair_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_status_history_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_work_orders: {
        Row: {
          created_at: string
          diagnosis: string | null
          finished_at: string | null
          id: string
          labor_hours: number | null
          labor_rate: number | null
          repair_order_id: string
          started_at: string | null
          status: string
          technician_id: string | null
          updated_at: string
          work_performed: string | null
        }
        Insert: {
          created_at?: string
          diagnosis?: string | null
          finished_at?: string | null
          id?: string
          labor_hours?: number | null
          labor_rate?: number | null
          repair_order_id: string
          started_at?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string
          work_performed?: string | null
        }
        Update: {
          created_at?: string
          diagnosis?: string | null
          finished_at?: string | null
          id?: string
          labor_hours?: number | null
          labor_rate?: number | null
          repair_order_id?: string
          started_at?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string
          work_performed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_work_orders_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_workshop_intake: {
        Row: {
          accessories_received: string | null
          condition_notes: string | null
          created_at: string
          id: string
          intake_signature_path: string | null
          photos_paths: string[] | null
          received_at: string
          received_by: string | null
          repair_order_id: string
          updated_at: string
        }
        Insert: {
          accessories_received?: string | null
          condition_notes?: string | null
          created_at?: string
          id?: string
          intake_signature_path?: string | null
          photos_paths?: string[] | null
          received_at?: string
          received_by?: string | null
          repair_order_id: string
          updated_at?: string
        }
        Update: {
          accessories_received?: string | null
          condition_notes?: string | null
          created_at?: string
          id?: string
          intake_signature_path?: string | null
          photos_paths?: string[] | null
          received_at?: string
          received_by?: string | null
          repair_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_workshop_intake_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      review_email_logs: {
        Row: {
          customer_email: string | null
          delivery_status: string | null
          error_message: string | null
          id: string
          order_id: string | null
          review_id: string | null
          sent_at: string
          sent_by: string | null
          sent_type: string
        }
        Insert: {
          customer_email?: string | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          review_id?: string | null
          sent_at?: string
          sent_by?: string | null
          sent_type: string
        }
        Update: {
          customer_email?: string | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          review_id?: string | null
          sent_at?: string
          sent_by?: string | null
          sent_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_email_logs_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closed_reason: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          delivery_date: string | null
          id: string
          improvement_text: string | null
          invitation_sent_at: string | null
          invitation_sent_by: string | null
          invitation_status: string
          order_id: string
          order_number: string | null
          product_name: string | null
          rating_delivery: number | null
          rating_driver_friendliness: number | null
          rating_training_text: string | null
          review_token: string
          status: string
          submitted_at: string | null
          token_expires_at: string | null
          training_answer: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          delivery_date?: string | null
          id?: string
          improvement_text?: string | null
          invitation_sent_at?: string | null
          invitation_sent_by?: string | null
          invitation_status?: string
          order_id: string
          order_number?: string | null
          product_name?: string | null
          rating_delivery?: number | null
          rating_driver_friendliness?: number | null
          rating_training_text?: string | null
          review_token: string
          status?: string
          submitted_at?: string | null
          token_expires_at?: string | null
          training_answer?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          delivery_date?: string | null
          id?: string
          improvement_text?: string | null
          invitation_sent_at?: string | null
          invitation_sent_by?: string | null
          invitation_status?: string
          order_id?: string
          order_number?: string | null
          product_name?: string | null
          rating_delivery?: number | null
          rating_driver_friendliness?: number | null
          rating_training_text?: string | null
          review_token?: string
          status?: string
          submitted_at?: string | null
          token_expires_at?: string | null
          training_answer?: string | null
          updated_at?: string
        }
        Relationships: []
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
          email_secondary: string | null
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
          email_secondary?: string | null
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
          email_secondary?: string | null
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
      system_maintenance: {
        Row: {
          enabled: boolean
          id: boolean
          message: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          message?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: boolean
          message?: string
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
          mfa_enrolled_at: string | null
          mfa_recovery_codes_hash: string[]
          otp_channel: string
          password_reset_required: boolean
          phone_number: string | null
          supplier_id: string | null
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
          mfa_enrolled_at?: string | null
          mfa_recovery_codes_hash?: string[]
          otp_channel?: string
          password_reset_required?: boolean
          phone_number?: string | null
          supplier_id?: string | null
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
          mfa_enrolled_at?: string | null
          mfa_recovery_codes_hash?: string[]
          otp_channel?: string
          password_reset_required?: boolean
          phone_number?: string | null
          supplier_id?: string | null
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
          {
            foreignKeyName: "user_profiles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      zoho_invoices: {
        Row: {
          balance: number | null
          billing_address: Json | null
          city: string | null
          created_at: string
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          last_payment_date: string | null
          payment_status: string | null
          raw_data: Json | null
          reference_number: string | null
          source_system: string
          status: string | null
          synced_at: string
          total: number | null
          updated_at: string
          zoho_invoice_id: string
        }
        Insert: {
          balance?: number | null
          billing_address?: Json | null
          city?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          last_payment_date?: string | null
          payment_status?: string | null
          raw_data?: Json | null
          reference_number?: string | null
          source_system: string
          status?: string | null
          synced_at?: string
          total?: number | null
          updated_at?: string
          zoho_invoice_id: string
        }
        Update: {
          balance?: number | null
          billing_address?: Json | null
          city?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          last_payment_date?: string | null
          payment_status?: string | null
          raw_data?: Json | null
          reference_number?: string | null
          source_system?: string
          status?: string | null
          synced_at?: string
          total?: number | null
          updated_at?: string
          zoho_invoice_id?: string
        }
        Relationships: []
      }
      zoho_items: {
        Row: {
          actual_available_stock: number | null
          available_stock: number | null
          brand: string | null
          category_name: string | null
          created_at: string
          currency_code: string | null
          description: string | null
          id: string
          image_name: string | null
          image_type: string | null
          item_type: string | null
          manufacturer: string | null
          name: string | null
          product_type: string | null
          purchase_rate: number | null
          rate: number | null
          raw_data: Json | null
          sku: string | null
          source_system: string
          status: string | null
          stock_on_hand: number | null
          synced_at: string
          tax_id: string | null
          tax_name: string | null
          tax_percentage: number | null
          unit: string | null
          updated_at: string
          zoho_created_time: string | null
          zoho_item_id: string
          zoho_last_modified_time: string | null
        }
        Insert: {
          actual_available_stock?: number | null
          available_stock?: number | null
          brand?: string | null
          category_name?: string | null
          created_at?: string
          currency_code?: string | null
          description?: string | null
          id?: string
          image_name?: string | null
          image_type?: string | null
          item_type?: string | null
          manufacturer?: string | null
          name?: string | null
          product_type?: string | null
          purchase_rate?: number | null
          rate?: number | null
          raw_data?: Json | null
          sku?: string | null
          source_system?: string
          status?: string | null
          stock_on_hand?: number | null
          synced_at?: string
          tax_id?: string | null
          tax_name?: string | null
          tax_percentage?: number | null
          unit?: string | null
          updated_at?: string
          zoho_created_time?: string | null
          zoho_item_id: string
          zoho_last_modified_time?: string | null
        }
        Update: {
          actual_available_stock?: number | null
          available_stock?: number | null
          brand?: string | null
          category_name?: string | null
          created_at?: string
          currency_code?: string | null
          description?: string | null
          id?: string
          image_name?: string | null
          image_type?: string | null
          item_type?: string | null
          manufacturer?: string | null
          name?: string | null
          product_type?: string | null
          purchase_rate?: number | null
          rate?: number | null
          raw_data?: Json | null
          sku?: string | null
          source_system?: string
          status?: string | null
          stock_on_hand?: number | null
          synced_at?: string
          tax_id?: string | null
          tax_name?: string | null
          tax_percentage?: number | null
          unit?: string | null
          updated_at?: string
          zoho_created_time?: string | null
          zoho_item_id?: string
          zoho_last_modified_time?: string | null
        }
        Relationships: []
      }
      zoho_recurring_invoices: {
        Row: {
          balance: number | null
          billing_address: Json | null
          city: string | null
          created_at: string
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          device_name: string | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          last_payment_date: string | null
          payment_status: string | null
          raw_data: Json | null
          reference_number: string | null
          source_system: string
          status: string | null
          synced_at: string
          total: number | null
          updated_at: string
          zoho_invoice_id: string
          zoho_recurring_invoice_id: string | null
        }
        Insert: {
          balance?: number | null
          billing_address?: Json | null
          city?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          device_name?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          last_payment_date?: string | null
          payment_status?: string | null
          raw_data?: Json | null
          reference_number?: string | null
          source_system: string
          status?: string | null
          synced_at?: string
          total?: number | null
          updated_at?: string
          zoho_invoice_id: string
          zoho_recurring_invoice_id?: string | null
        }
        Update: {
          balance?: number | null
          billing_address?: Json | null
          city?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          device_name?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          last_payment_date?: string | null
          payment_status?: string | null
          raw_data?: Json | null
          reference_number?: string | null
          source_system?: string
          status?: string | null
          synced_at?: string
          total?: number | null
          updated_at?: string
          zoho_invoice_id?: string
          zoho_recurring_invoice_id?: string | null
        }
        Relationships: []
      }
      zoho_recurring_profiles: {
        Row: {
          company_name: string | null
          created_at: string
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          device_name: string | null
          email: string | null
          end_date: string | null
          id: string
          last_sent_date: string | null
          line_items: Json | null
          next_invoice_date: string | null
          raw_data: Json | null
          recurrence_frequency: string | null
          recurrence_name: string | null
          reference_number: string | null
          repeat_every: number | null
          salesperson_name: string | null
          source_system: string
          start_date: string | null
          status: string | null
          sub_total: number | null
          synced_at: string
          total: number | null
          updated_at: string
          zoho_recurring_invoice_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          device_name?: string | null
          email?: string | null
          end_date?: string | null
          id?: string
          last_sent_date?: string | null
          line_items?: Json | null
          next_invoice_date?: string | null
          raw_data?: Json | null
          recurrence_frequency?: string | null
          recurrence_name?: string | null
          reference_number?: string | null
          repeat_every?: number | null
          salesperson_name?: string | null
          source_system: string
          start_date?: string | null
          status?: string | null
          sub_total?: number | null
          synced_at?: string
          total?: number | null
          updated_at?: string
          zoho_recurring_invoice_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          device_name?: string | null
          email?: string | null
          end_date?: string | null
          id?: string
          last_sent_date?: string | null
          line_items?: Json | null
          next_invoice_date?: string | null
          raw_data?: Json | null
          recurrence_frequency?: string | null
          recurrence_name?: string | null
          reference_number?: string | null
          repeat_every?: number | null
          salesperson_name?: string | null
          source_system?: string
          start_date?: string | null
          status?: string | null
          sub_total?: number | null
          synced_at?: string
          total?: number | null
          updated_at?: string
          zoho_recurring_invoice_id?: string
        }
        Relationships: []
      }
      zoho_unpaid_invoices: {
        Row: {
          balance: number | null
          currency_code: string | null
          customer_name: string | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          raw: Json | null
          status: string | null
          synced_at: string | null
          total: number | null
        }
        Insert: {
          balance?: number | null
          currency_code?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_id?: string | null
          invoice_number?: string | null
          raw?: Json | null
          status?: string | null
          synced_at?: string | null
          total?: number | null
        }
        Update: {
          balance?: number | null
          currency_code?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_id?: string | null
          invoice_number?: string | null
          raw?: Json | null
          status?: string | null
          synced_at?: string | null
          total?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_finance: { Args: never; Returns: boolean }
      can_access_financing: { Args: never; Returns: boolean }
      can_access_import_logs: { Args: never; Returns: boolean }
      can_access_mail: { Args: never; Returns: boolean }
      can_access_orders: { Args: never; Returns: boolean }
      can_access_planning: { Args: never; Returns: boolean }
      can_access_qm: { Args: never; Returns: boolean }
      can_access_repair: { Args: never; Returns: boolean }
      can_manage_mail_campaigns: { Args: never; Returns: boolean }
      can_manage_mail_domains: { Args: never; Returns: boolean }
      can_manage_mail_templates: { Args: never; Returns: boolean }
      can_manage_orders: { Args: never; Returns: boolean }
      can_manage_planning: { Args: never; Returns: boolean }
      can_manage_repair: { Args: never; Returns: boolean }
      can_upload_factory_invoice: { Args: never; Returns: boolean }
      can_view_mail_audit: { Args: never; Returns: boolean }
      clear_factory_invoice_pdf: {
        Args: { _production_order_id: string }
        Returns: undefined
      }
      complete_password_setup: { Args: never; Returns: undefined }
      current_supplier_id: { Args: never; Returns: string }
      has_role: { Args: { check_role: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_supplier: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          _action: string
          _details?: Json
          _ip_address?: string
          _module: string
          _record_id?: string
          _user_agent?: string
        }
        Returns: string
      }
      requires_reauth: { Args: never; Returns: boolean }
      session_requires_reauth: { Args: never; Returns: boolean }
      set_factory_invoice_payment_ok: {
        Args: { _ok: boolean; _production_order_id: string }
        Returns: undefined
      }
      set_factory_invoice_pdf: {
        Args: { _path: string; _production_order_id: string }
        Returns: undefined
      }
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
