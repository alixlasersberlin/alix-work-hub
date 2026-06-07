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
      academy_bookings: {
        Row: {
          academy_session_id: string | null
          booking_status: string
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          metadata: Json | null
          notes: string | null
          source_customer_id: string | null
          source_id: string | null
          source_session_id: string | null
          updated_at: string
        }
        Insert: {
          academy_session_id?: string | null
          booking_status?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          source_customer_id?: string | null
          source_id?: string | null
          source_session_id?: string | null
          updated_at?: string
        }
        Update: {
          academy_session_id?: string | null
          booking_status?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          source_customer_id?: string | null
          source_id?: string | null
          source_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_bookings_academy_session_id_fkey"
            columns: ["academy_session_id"]
            isOneToOne: false
            referencedRelation: "academy_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_sessions: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          instructor: string | null
          location: string | null
          max_participants: number | null
          metadata: Json | null
          source_id: string | null
          start_date: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          instructor?: string | null
          location?: string | null
          max_participants?: number | null
          metadata?: Json | null
          source_id?: string | null
          start_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          instructor?: string | null
          location?: string | null
          max_participants?: number | null
          metadata?: Json | null
          source_id?: string | null
          start_date?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_service_analyses: {
        Row: {
          ai_model: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          device_name: string | null
          error_description: string | null
          estimated_diagnosis_time_minutes: number | null
          estimated_repair_time_minutes: number | null
          estimated_total_time_minutes: number | null
          id: string
          probable_cause: string | null
          recommended_parts: Json | null
          recommended_repair: string | null
          recommended_steps: Json | null
          recommended_technician: string | null
          repair_id: string | null
          serial_number: string | null
          status: string
          ticket_id: string | null
        }
        Insert: {
          ai_model?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          device_name?: string | null
          error_description?: string | null
          estimated_diagnosis_time_minutes?: number | null
          estimated_repair_time_minutes?: number | null
          estimated_total_time_minutes?: number | null
          id?: string
          probable_cause?: string | null
          recommended_parts?: Json | null
          recommended_repair?: string | null
          recommended_steps?: Json | null
          recommended_technician?: string | null
          repair_id?: string | null
          serial_number?: string | null
          status?: string
          ticket_id?: string | null
        }
        Update: {
          ai_model?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          device_name?: string | null
          error_description?: string | null
          estimated_diagnosis_time_minutes?: number | null
          estimated_repair_time_minutes?: number | null
          estimated_total_time_minutes?: number | null
          id?: string
          probable_cause?: string | null
          recommended_parts?: Json | null
          recommended_repair?: string | null
          recommended_steps?: Json | null
          recommended_technician?: string | null
          repair_id?: string | null
          serial_number?: string | null
          status?: string
          ticket_id?: string | null
        }
        Relationships: []
      }
      ai_service_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          payload: Json | null
          result: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      aic_analysis_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          modules: string[]
          started_at: string
          stats: Json
          status: string
          trigger: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          modules?: string[]
          started_at?: string
          stats?: Json
          status?: string
          trigger?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          modules?: string[]
          started_at?: string
          stats?: Json
          status?: string
          trigger?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      aic_forecasts: {
        Row: {
          confidence: number | null
          created_at: string
          generated_at: string
          id: string
          kind: string
          payload: Json
          rationale: string | null
          run_id: string | null
          unit: string | null
          updated_at: string
          valid_until: string | null
          value: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          generated_at?: string
          id?: string
          kind: string
          payload?: Json
          rationale?: string | null
          run_id?: string | null
          unit?: string | null
          updated_at?: string
          valid_until?: string | null
          value?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          generated_at?: string
          id?: string
          kind?: string
          payload?: Json
          rationale?: string | null
          run_id?: string | null
          unit?: string | null
          updated_at?: string
          valid_until?: string | null
          value?: number | null
        }
        Relationships: []
      }
      aic_insights: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          module: string
          payload: Json
          run_id: string | null
          severity: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          module: string
          payload?: Json
          run_id?: string | null
          severity?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          module?: string
          payload?: Json
          run_id?: string | null
          severity?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      aic_report_schedules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          kind: string
          last_run_at: string | null
          monthday: number | null
          next_run_at: string | null
          recipients: string[]
          send_hour: number
          updated_at: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          last_run_at?: string | null
          monthday?: number | null
          next_run_at?: string | null
          recipients?: string[]
          send_hour?: number
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          last_run_at?: string | null
          monthday?: number | null
          next_run_at?: string | null
          recipients?: string[]
          send_hour?: number
          updated_at?: string
          weekday?: number | null
        }
        Relationships: []
      }
      aic_reports: {
        Row: {
          content_html: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          period_end: string | null
          period_start: string | null
          recipients: string[]
          send_error: string | null
          send_status: string
          sent_at: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content_html?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          period_end?: string | null
          period_start?: string | null
          recipients?: string[]
          send_error?: string | null
          send_status?: string
          sent_at?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content_html?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          period_end?: string | null
          period_start?: string | null
          recipients?: string[]
          send_error?: string | null
          send_status?: string
          sent_at?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      aic_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          order_id: string | null
          payload: Json
          priority: number
          related_insight_id: string | null
          run_id: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          priority?: number
          related_insight_id?: string | null
          run_id?: string | null
          status?: string
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order_id?: string | null
          payload?: Json
          priority?: number
          related_insight_id?: string | null
          run_id?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aic_tasks_related_insight_id_fkey"
            columns: ["related_insight_id"]
            isOneToOne: false
            referencedRelation: "aic_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      alixsmart_migration_logs: {
        Row: {
          action: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          migration_batch_id: string | null
          rows_failed: number
          rows_processed: number
          rows_success: number
          source_table: string | null
          status: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          migration_batch_id?: string | null
          rows_failed?: number
          rows_processed?: number
          rows_success?: number
          source_table?: string | null
          status?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          migration_batch_id?: string | null
          rows_failed?: number
          rows_processed?: number
          rows_success?: number
          source_table?: string | null
          status?: string | null
        }
        Relationships: []
      }
      alixsmart_migration_map: {
        Row: {
          conflict_status: string | null
          created_at: string
          error_message: string | null
          id: string
          match_key: string | null
          metadata: Json | null
          migration_status: string
          source_id: string
          source_table: string
          target_id: string | null
          target_table: string
          updated_at: string
        }
        Insert: {
          conflict_status?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          match_key?: string | null
          metadata?: Json | null
          migration_status?: string
          source_id: string
          source_table: string
          target_id?: string | null
          target_table: string
          updated_at?: string
        }
        Update: {
          conflict_status?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          match_key?: string | null
          metadata?: Json | null
          migration_status?: string
          source_id?: string
          source_table?: string
          target_id?: string | null
          target_table?: string
          updated_at?: string
        }
        Relationships: []
      }
      alixsmart_products: {
        Row: {
          category: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string | null
          price: number | null
          sku: string | null
          source_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string | null
          price?: number | null
          sku?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string | null
          price?: number | null
          sku?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          bucket_key: string
          request_at: string
        }
        Insert: {
          bucket_key: string
          request_at?: string
        }
        Update: {
          bucket_key?: string
          request_at?: string
        }
        Relationships: []
      }
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
      customer_communication_log: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          department: string | null
          direction: string | null
          id: string
          metadata: Json | null
          occurred_at: string
          order_id: string | null
          preview: string | null
          reference_id: string | null
          reference_table: string | null
          repair_order_id: string | null
          subject: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          department?: string | null
          direction?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          order_id?: string | null
          preview?: string | null
          reference_id?: string | null
          reference_table?: string | null
          repair_order_id?: string | null
          subject?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          department?: string | null
          direction?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          order_id?: string | null
          preview?: string | null
          reference_id?: string | null
          reference_table?: string | null
          repair_order_id?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          author_id: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          is_internal: boolean
          metadata: Json | null
          note: string | null
          source_customer_id: string | null
          source_id: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          is_internal?: boolean
          metadata?: Json | null
          note?: string | null
          source_customer_id?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          is_internal?: boolean
          metadata?: Json | null
          note?: string | null
          source_customer_id?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_document_downloads: {
        Row: {
          attachment_id: string | null
          customer_id: string
          document_type: string | null
          downloaded_at: string
          id: string
          ip_address: string | null
          storage_bucket: string | null
          storage_path: string | null
          user_agent: string | null
        }
        Insert: {
          attachment_id?: string | null
          customer_id: string
          document_type?: string | null
          downloaded_at?: string
          id?: string
          ip_address?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          user_agent?: string | null
        }
        Update: {
          attachment_id?: string | null
          customer_id?: string
          document_type?: string | null
          downloaded_at?: string
          id?: string
          ip_address?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_document_downloads_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "mail_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_document_downloads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_quote_responses: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          ip_address: string | null
          note: string | null
          order_id: string | null
          production_order_id: string | null
          responded_at: string
          response: string
          signed_name: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          ip_address?: string | null
          note?: string | null
          order_id?: string | null
          production_order_id?: string | null
          responded_at?: string
          response: string
          signed_name?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          ip_address?: string | null
          note?: string | null
          order_id?: string | null
          production_order_id?: string | null
          responded_at?: string
          response?: string
          signed_name?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_quote_responses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_quote_responses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_quote_responses_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_ticket_messages: {
        Row: {
          attachment_path: string | null
          author_id: string | null
          created_at: string
          from_role: string
          id: string
          message: string
          ticket_id: string
        }
        Insert: {
          attachment_path?: string | null
          author_id?: string | null
          created_at?: string
          from_role: string
          id?: string
          message: string
          ticket_id: string
        }
        Update: {
          attachment_path?: string | null
          author_id?: string | null
          created_at?: string
          from_role?: string
          id?: string
          message?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_users: {
        Row: {
          accepted_at: string | null
          created_at: string
          customer_id: string
          id: string
          invited_at: string | null
          last_login_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          invited_at?: string | null
          last_login_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          invited_at?: string | null
          last_login_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      device_health_scores: {
        Row: {
          complaint_count: number
          customer_name: string | null
          device_name: string | null
          downtime_days: number
          health_score: number | null
          health_status: string
          id: string
          leasing_status: string | null
          repair_count: number
          serial_number: string
          spare_part_count: number
          ticket_count: number
          updated_at: string
          warranty_cases: number
          warranty_status: string | null
        }
        Insert: {
          complaint_count?: number
          customer_name?: string | null
          device_name?: string | null
          downtime_days?: number
          health_score?: number | null
          health_status?: string
          id?: string
          leasing_status?: string | null
          repair_count?: number
          serial_number: string
          spare_part_count?: number
          ticket_count?: number
          updated_at?: string
          warranty_cases?: number
          warranty_status?: string | null
        }
        Update: {
          complaint_count?: number
          customer_name?: string | null
          device_name?: string | null
          downtime_days?: number
          health_score?: number | null
          health_status?: string
          id?: string
          leasing_status?: string | null
          repair_count?: number
          serial_number?: string
          spare_part_count?: number
          ticket_count?: number
          updated_at?: string
          warranty_cases?: number
          warranty_status?: string | null
        }
        Relationships: []
      }
      device_lifecycle: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          description: string | null
          device_name: string | null
          event_date: string
          event_source: string
          event_type: string
          id: string
          meta: Json | null
          metadata: Json | null
          reference_id: string | null
          reference_table: string | null
          serial_number: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          description?: string | null
          device_name?: string | null
          event_date?: string
          event_source: string
          event_type: string
          id?: string
          meta?: Json | null
          metadata?: Json | null
          reference_id?: string | null
          reference_table?: string | null
          serial_number: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          description?: string | null
          device_name?: string | null
          event_date?: string
          event_source?: string
          event_type?: string
          id?: string
          meta?: Json | null
          metadata?: Json | null
          reference_id?: string | null
          reference_table?: string | null
          serial_number?: string
        }
        Relationships: []
      }
      device_maintenance: {
        Row: {
          assigned_technician: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          device_name: string | null
          id: string
          last_maintenance_date: string | null
          maintenance_plan_id: string | null
          maintenance_status: string
          next_maintenance_date: string | null
          notes: string | null
          postponed_until: string | null
          reminder_14d_sent_at: string | null
          reminder_30d_sent_at: string | null
          reminder_due_sent_at: string | null
          reminder_overdue_sent_at: string | null
          route_plan_id: string | null
          serial_number: string
          service_address: Json | null
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_technician?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          device_name?: string | null
          id?: string
          last_maintenance_date?: string | null
          maintenance_plan_id?: string | null
          maintenance_status?: string
          next_maintenance_date?: string | null
          notes?: string | null
          postponed_until?: string | null
          reminder_14d_sent_at?: string | null
          reminder_30d_sent_at?: string | null
          reminder_due_sent_at?: string | null
          reminder_overdue_sent_at?: string | null
          route_plan_id?: string | null
          serial_number: string
          service_address?: Json | null
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_technician?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          device_name?: string | null
          id?: string
          last_maintenance_date?: string | null
          maintenance_plan_id?: string | null
          maintenance_status?: string
          next_maintenance_date?: string | null
          notes?: string | null
          postponed_until?: string | null
          reminder_14d_sent_at?: string | null
          reminder_30d_sent_at?: string | null
          reminder_due_sent_at?: string | null
          reminder_overdue_sent_at?: string | null
          route_plan_id?: string | null
          serial_number?: string
          service_address?: Json | null
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_maintenance_maintenance_plan_id_fkey"
            columns: ["maintenance_plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_path: string
          id: string
          mime_type: string | null
          route_plan_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          route_plan_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          route_plan_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_attachments_route_plan_id_fkey"
            columns: ["route_plan_id"]
            isOneToOne: false
            referencedRelation: "route_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_checklist_runs: {
        Row: {
          answers: Json
          checklist_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          result: string | null
          route_plan_id: string | null
          technician_user_id: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          checklist_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          result?: string | null
          route_plan_id?: string | null
          technician_user_id?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          checklist_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          result?: string | null
          route_plan_id?: string | null
          technician_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_checklist_runs_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "dispatch_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_checklist_runs_route_plan_id_fkey"
            columns: ["route_plan_id"]
            isOneToOne: false
            referencedRelation: "route_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_checklists: {
        Row: {
          checklist_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          items: Json
          name: string
          updated_at: string
        }
        Insert: {
          checklist_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          name: string
          updated_at?: string
        }
        Update: {
          checklist_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      dispatch_signatures: {
        Row: {
          created_at: string
          id: string
          role: string
          route_plan_id: string | null
          signed_at: string
          signer_name: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          route_plan_id?: string | null
          signed_at?: string
          signer_name?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          route_plan_id?: string | null
          signed_at?: string
          signer_name?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_signatures_route_plan_id_fkey"
            columns: ["route_plan_id"]
            isOneToOne: false
            referencedRelation: "route_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_used_parts: {
        Row: {
          created_at: string
          id: string
          note: string | null
          part_name: string
          part_sku: string | null
          quantity: number
          route_plan_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          part_name: string
          part_sku?: string | null
          quantity?: number
          route_plan_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          part_name?: string
          part_sku?: string | null
          quantity?: number
          route_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_used_parts_route_plan_id_fkey"
            columns: ["route_plan_id"]
            isOneToOne: false
            referencedRelation: "route_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_vehicles: {
        Row: {
          active: boolean
          created_at: string
          driver_user_id: string | null
          id: string
          license_plate: string | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          driver_user_id?: string | null
          id?: string
          license_plate?: string | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          driver_user_id?: string | null
          id?: string
          license_plate?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          provider_message_id: string | null
          recipient_email: string | null
          sent_at: string | null
          source_id: string | null
          source_system: string | null
          status: string | null
          subject: string | null
          template: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          recipient_email?: string | null
          sent_at?: string | null
          source_id?: string | null
          source_system?: string | null
          status?: string | null
          subject?: string | null
          template?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          recipient_email?: string | null
          sent_at?: string | null
          source_id?: string | null
          source_system?: string | null
          status?: string | null
          subject?: string | null
          template?: string | null
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
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string | null
          id: string
          metadata: Json | null
          reason: string | null
          source_id: string | null
          token: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          source_id?: string | null
          token?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          source_id?: string | null
          token?: string | null
          unsubscribed_at?: string | null
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
      goods_receipts: {
        Row: {
          created_at: string
          delivery_note: string | null
          id: string
          item_id: string | null
          item_name: string | null
          notes: string | null
          order_id: string | null
          quantity: number
          receipt_number: string | null
          received_at: string
          received_by: string | null
          serial_numbers: string[] | null
          sku: string | null
          supplier: string | null
        }
        Insert: {
          created_at?: string
          delivery_note?: string | null
          id?: string
          item_id?: string | null
          item_name?: string | null
          notes?: string | null
          order_id?: string | null
          quantity: number
          receipt_number?: string | null
          received_at?: string
          received_by?: string | null
          serial_numbers?: string[] | null
          sku?: string | null
          supplier?: string | null
        }
        Update: {
          created_at?: string
          delivery_note?: string | null
          id?: string
          item_id?: string | null
          item_name?: string | null
          notes?: string | null
          order_id?: string | null
          quantity?: number
          receipt_number?: string | null
          received_at?: string
          received_by?: string | null
          serial_numbers?: string[] | null
          sku?: string | null
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "spare_part_stock_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "zoho_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "spare_part_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      goodwill_cases: {
        Row: {
          approval_note: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          cost_share_company: number | null
          cost_share_customer: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          reason: string | null
          requires_approval: boolean | null
          responsible_user: string | null
          serial_number: string | null
          updated_at: string
          warranty_decision_id: string | null
        }
        Insert: {
          approval_note?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cost_share_company?: number | null
          cost_share_customer?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          reason?: string | null
          requires_approval?: boolean | null
          responsible_user?: string | null
          serial_number?: string | null
          updated_at?: string
          warranty_decision_id?: string | null
        }
        Update: {
          approval_note?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          cost_share_company?: number | null
          cost_share_customer?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          reason?: string | null
          requires_approval?: boolean | null
          responsible_user?: string | null
          serial_number?: string | null
          updated_at?: string
          warranty_decision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goodwill_cases_warranty_decision_id_fkey"
            columns: ["warranty_decision_id"]
            isOneToOne: false
            referencedRelation: "warranty_decisions"
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
      iso_audit_findings_ext: {
        Row: {
          audit_id: string
          capa_id: string | null
          clause: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          responsible: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          audit_id: string
          capa_id?: string | null
          clause?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          responsible?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          audit_id?: string
          capa_id?: string | null
          clause?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          responsible?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iso_audit_findings_ext_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "iso_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      iso_audits: {
        Row: {
          audit_date: string | null
          audit_number: string | null
          audit_type: string
          auditor: string | null
          created_at: string
          created_by: string | null
          id: string
          result: string | null
          scope: string | null
          standard: string
          status: string
          summary: string | null
          tenant_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audit_date?: string | null
          audit_number?: string | null
          audit_type?: string
          auditor?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          result?: string | null
          scope?: string | null
          standard?: string
          status?: string
          summary?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audit_date?: string | null
          audit_number?: string | null
          audit_type?: string
          auditor?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          result?: string | null
          scope?: string | null
          standard?: string
          status?: string
          summary?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iso_audits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      iso_change_controls: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          area: string | null
          change_number: string | null
          created_at: string
          description: string | null
          effective_date: string | null
          id: string
          impact_assessment: string | null
          reason: string | null
          requested_by: string | null
          risk_class: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          area?: string | null
          change_number?: string | null
          created_at?: string
          description?: string | null
          effective_date?: string | null
          id?: string
          impact_assessment?: string | null
          reason?: string | null
          requested_by?: string | null
          risk_class?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          area?: string | null
          change_number?: string | null
          created_at?: string
          description?: string | null
          effective_date?: string | null
          id?: string
          impact_assessment?: string | null
          reason?: string | null
          requested_by?: string | null
          risk_class?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      iso_supplier_evaluations: {
        Row: {
          classification: string | null
          created_at: string
          delivery_score: number | null
          evaluated_at: string
          evaluated_by: string | null
          evaluation_year: number
          id: string
          overall_score: number | null
          quality_score: number | null
          remarks: string | null
          service_score: number | null
          supplier_id: string | null
          supplier_name: string
          updated_at: string
        }
        Insert: {
          classification?: string | null
          created_at?: string
          delivery_score?: number | null
          evaluated_at?: string
          evaluated_by?: string | null
          evaluation_year: number
          id?: string
          overall_score?: number | null
          quality_score?: number | null
          remarks?: string | null
          service_score?: number | null
          supplier_id?: string | null
          supplier_name: string
          updated_at?: string
        }
        Update: {
          classification?: string | null
          created_at?: string
          delivery_score?: number | null
          evaluated_at?: string
          evaluated_by?: string | null
          evaluation_year?: number
          id?: string
          overall_score?: number | null
          quality_score?: number | null
          remarks?: string | null
          service_score?: number | null
          supplier_id?: string | null
          supplier_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      iso_training_records: {
        Row: {
          certificate_path: string | null
          completed_at: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          note: string | null
          score: number | null
          training_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_path?: string | null
          completed_at?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          score?: number | null
          training_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_path?: string | null
          completed_at?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          score?: number | null
          training_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iso_training_records_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "iso_trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      iso_trainings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_mandatory: boolean
          standard: string | null
          target_roles: string[] | null
          title: string
          updated_at: string
          validity_months: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean
          standard?: string | null
          target_roles?: string[] | null
          title: string
          updated_at?: string
          validity_months?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean
          standard?: string | null
          target_roles?: string[] | null
          title?: string
          updated_at?: string
          validity_months?: number | null
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
          alixsmart_metadata: Json | null
          alixsmart_source_id: string | null
          alixsmart_user_id: string | null
          commissioning_date: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string | null
          device_status: string | null
          entry_date: string
          id: string
          last_service_date: string | null
          model_name: string
          next_service_date: string | null
          notes: string | null
          reservation_week: string | null
          reserved_order_id: string | null
          serial_number: string
          source_system: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          airtable_record_id?: string | null
          alixsmart_metadata?: Json | null
          alixsmart_source_id?: string | null
          alixsmart_user_id?: string | null
          commissioning_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          device_status?: string | null
          entry_date?: string
          id?: string
          last_service_date?: string | null
          model_name: string
          next_service_date?: string | null
          notes?: string | null
          reservation_week?: string | null
          reserved_order_id?: string | null
          serial_number: string
          source_system?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          airtable_record_id?: string | null
          alixsmart_metadata?: Json | null
          alixsmart_source_id?: string | null
          alixsmart_user_id?: string | null
          commissioning_date?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          device_status?: string | null
          entry_date?: string
          id?: string
          last_service_date?: string | null
          model_name?: string
          next_service_date?: string | null
          notes?: string | null
          reservation_week?: string | null
          reserved_order_id?: string | null
          serial_number?: string
          source_system?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      loaner_device_assignments: {
        Row: {
          condition_in: string | null
          condition_out: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          lager_device_id: string | null
          model_name: string | null
          notes: string | null
          repair_order_id: string | null
          returned_at: string | null
          returned_by: string | null
          serial_number: string | null
          status: string | null
          updated_at: string
          warranty_decision_id: string | null
        }
        Insert: {
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          lager_device_id?: string | null
          model_name?: string | null
          notes?: string | null
          repair_order_id?: string | null
          returned_at?: string | null
          returned_by?: string | null
          serial_number?: string | null
          status?: string | null
          updated_at?: string
          warranty_decision_id?: string | null
        }
        Update: {
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          lager_device_id?: string | null
          model_name?: string | null
          notes?: string | null
          repair_order_id?: string | null
          returned_at?: string | null
          returned_by?: string | null
          serial_number?: string | null
          status?: string | null
          updated_at?: string
          warranty_decision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loaner_device_assignments_lager_device_id_fkey"
            columns: ["lager_device_id"]
            isOneToOne: false
            referencedRelation: "lager_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loaner_device_assignments_warranty_decision_id_fkey"
            columns: ["warranty_decision_id"]
            isOneToOne: false
            referencedRelation: "warranty_decisions"
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
      mail_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          document_type: string
          download_count: number
          downloaded_at: string | null
          file_name: string
          file_size: number | null
          id: string
          is_signed: boolean
          message_id: string | null
          mime_type: string | null
          opened_at: string | null
          order_id: string | null
          production_order_id: string | null
          repair_order_id: string | null
          sent_at: string | null
          signed_at: string | null
          status: string
          storage_bucket: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          document_type: string
          download_count?: number
          downloaded_at?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          is_signed?: boolean
          message_id?: string | null
          mime_type?: string | null
          opened_at?: string | null
          order_id?: string | null
          production_order_id?: string | null
          repair_order_id?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          storage_bucket: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          document_type?: string
          download_count?: number
          downloaded_at?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          is_signed?: boolean
          message_id?: string | null
          mime_type?: string | null
          opened_at?: string | null
          order_id?: string | null
          production_order_id?: string | null
          repair_order_id?: string | null
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_attachments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mail_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_attachments_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_attachments_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
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
      mail_followups: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          department: string | null
          due_date: string
          id: string
          note: string | null
          phone_note_id: string | null
          priority: string
          status: string
          task_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          department?: string | null
          due_date: string
          id?: string
          note?: string | null
          phone_note_id?: string | null
          priority?: string
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          department?: string | null
          due_date?: string
          id?: string
          note?: string | null
          phone_note_id?: string | null
          priority?: string
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mail_followups_phone_note_id_fkey"
            columns: ["phone_note_id"]
            isOneToOne: false
            referencedRelation: "mail_phone_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_followups_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "mail_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_internal_messages: {
        Row: {
          body: string
          created_at: string
          customer_id: string | null
          id: string
          is_read: boolean | null
          message_id: string | null
          order_id: string | null
          read_at: string | null
          recipient_department: string | null
          recipient_user_id: string | null
          sender_id: string
          source_id: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          customer_id?: string | null
          id?: string
          is_read?: boolean | null
          message_id?: string | null
          order_id?: string | null
          read_at?: string | null
          recipient_department?: string | null
          recipient_user_id?: string | null
          sender_id: string
          source_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          is_read?: boolean | null
          message_id?: string | null
          order_id?: string | null
          read_at?: string | null
          recipient_department?: string | null
          recipient_user_id?: string | null
          sender_id?: string
          source_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mail_messages: {
        Row: {
          assigned_to: string | null
          body_html: string | null
          body_text: string | null
          bounced_at: string | null
          clicked_at: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          direction: string | null
          domain_id: string | null
          due_date: string | null
          error_message: string | null
          from_email: string
          from_name: string | null
          id: string
          in_reply_to: string | null
          invoice_id: string | null
          is_read: boolean | null
          mailbox: string | null
          opened_at: string | null
          order_id: string | null
          priority: string | null
          provider_message_id: string | null
          repair_id: string | null
          reply_to: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_id: string | null
          thread_id: string | null
          ticket_id: string | null
          to_email: string
          to_name: string | null
          unsubscribed_at: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          direction?: string | null
          domain_id?: string | null
          due_date?: string | null
          error_message?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          invoice_id?: string | null
          is_read?: boolean | null
          mailbox?: string | null
          opened_at?: string | null
          order_id?: string | null
          priority?: string | null
          provider_message_id?: string | null
          repair_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          thread_id?: string | null
          ticket_id?: string | null
          to_email: string
          to_name?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          direction?: string | null
          domain_id?: string | null
          due_date?: string | null
          error_message?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          in_reply_to?: string | null
          invoice_id?: string | null
          is_read?: boolean | null
          mailbox?: string | null
          opened_at?: string | null
          order_id?: string | null
          priority?: string | null
          provider_message_id?: string | null
          repair_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          thread_id?: string | null
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
      mail_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string
          customer_id: string | null
          id: string
          message_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          customer_id?: string | null
          id?: string
          message_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          id?: string
          message_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mail_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      mail_phone_notes: {
        Row: {
          call_date: string
          call_time: string | null
          call_type: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          department: string | null
          followup_date: string | null
          has_followup: boolean
          id: string
          note: string | null
          order_id: string | null
          phone_number: string | null
          priority: string
          repair_order_id: string | null
          result: string | null
          staff_user_id: string | null
          topic: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          call_date?: string
          call_time?: string | null
          call_type?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          department?: string | null
          followup_date?: string | null
          has_followup?: boolean
          id?: string
          note?: string | null
          order_id?: string | null
          phone_number?: string | null
          priority?: string
          repair_order_id?: string | null
          result?: string | null
          staff_user_id?: string | null
          topic?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          call_date?: string
          call_time?: string | null
          call_type?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          department?: string | null
          followup_date?: string | null
          has_followup?: boolean
          id?: string
          note?: string | null
          order_id?: string | null
          phone_number?: string | null
          priority?: string
          repair_order_id?: string | null
          result?: string | null
          staff_user_id?: string | null
          topic?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      mail_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          department: string | null
          description: string | null
          due_date: string | null
          id: string
          order_id: string | null
          phone_note_id: string | null
          priority: string
          repair_order_id: string | null
          status: string
          ticket_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          department?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order_id?: string | null
          phone_note_id?: string | null
          priority?: string
          repair_order_id?: string | null
          status?: string
          ticket_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          department?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          order_id?: string | null
          phone_note_id?: string | null
          priority?: string
          repair_order_id?: string | null
          status?: string
          ticket_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mail_tasks_phone_note_id_fkey"
            columns: ["phone_note_id"]
            isOneToOne: false
            referencedRelation: "mail_phone_notes"
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
      maintenance_confirmations: {
        Row: {
          confirmation_date: string | null
          confirmed_by: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          device_id: string | null
          document_url: string | null
          id: string
          metadata: Json | null
          notes: string | null
          serial_number: string | null
          signature_url: string | null
          source_device_id: string | null
          source_id: string | null
          updated_at: string
        }
        Insert: {
          confirmation_date?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          device_id?: string | null
          document_url?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          serial_number?: string | null
          signature_url?: string | null
          source_device_id?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          confirmation_date?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          device_id?: string | null
          document_url?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          serial_number?: string | null
          signature_url?: string | null
          source_device_id?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_confirmations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plans: {
        Row: {
          created_at: string
          device_name: string
          estimated_duration_min: number | null
          id: string
          maintenance_description: string | null
          maintenance_interval_hours: number | null
          maintenance_interval_months: number | null
          mandatory: boolean | null
          model: string | null
          on_site: boolean | null
          required_parts: Json | null
          responsible_role: string | null
          serial_number: string | null
          updated_at: string
          warranty_terms: string | null
          work_scope: string | null
        }
        Insert: {
          created_at?: string
          device_name: string
          estimated_duration_min?: number | null
          id?: string
          maintenance_description?: string | null
          maintenance_interval_hours?: number | null
          maintenance_interval_months?: number | null
          mandatory?: boolean | null
          model?: string | null
          on_site?: boolean | null
          required_parts?: Json | null
          responsible_role?: string | null
          serial_number?: string | null
          updated_at?: string
          warranty_terms?: string | null
          work_scope?: string | null
        }
        Update: {
          created_at?: string
          device_name?: string
          estimated_duration_min?: number | null
          id?: string
          maintenance_description?: string | null
          maintenance_interval_hours?: number | null
          maintenance_interval_months?: number | null
          mandatory?: boolean | null
          model?: string | null
          on_site?: boolean | null
          required_parts?: Json | null
          responsible_role?: string | null
          serial_number?: string | null
          updated_at?: string
          warranty_terms?: string | null
          work_scope?: string | null
        }
        Relationships: []
      }
      maintenance_reminder_log: {
        Row: {
          customer_id: string | null
          customer_name: string | null
          device_maintenance_id: string | null
          device_name: string | null
          due_date: string | null
          error: string | null
          id: string
          payload: Json | null
          recipient_email: string
          reminder_type: string
          sent_at: string
          sent_on: string
          serial_number: string | null
          status: string
        }
        Insert: {
          customer_id?: string | null
          customer_name?: string | null
          device_maintenance_id?: string | null
          device_name?: string | null
          due_date?: string | null
          error?: string | null
          id?: string
          payload?: Json | null
          recipient_email: string
          reminder_type: string
          sent_at?: string
          sent_on?: string
          serial_number?: string | null
          status?: string
        }
        Update: {
          customer_id?: string | null
          customer_name?: string | null
          device_maintenance_id?: string | null
          device_name?: string | null
          due_date?: string | null
          error?: string | null
          id?: string
          payload?: Json | null
          recipient_email?: string
          reminder_type?: string
          sent_at?: string
          sent_on?: string
          serial_number?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_reminder_log_device_maintenance_id_fkey"
            columns: ["device_maintenance_id"]
            isOneToOne: false
            referencedRelation: "device_maintenance"
            referencedColumns: ["id"]
          },
        ]
      }
      mdr_vigilance_reports: {
        Row: {
          authority_reference: string | null
          authority_status: string
          created_at: string
          device_name: string | null
          id: string
          immediate_action: string | null
          incident_date: string | null
          incident_description: string
          patient_harm: boolean
          report_number: string | null
          reported_at: string
          reported_by: string | null
          root_cause: string | null
          serial_number: string | null
          severity: string
          tenant_id: string | null
          udi: string | null
          updated_at: string
        }
        Insert: {
          authority_reference?: string | null
          authority_status?: string
          created_at?: string
          device_name?: string | null
          id?: string
          immediate_action?: string | null
          incident_date?: string | null
          incident_description: string
          patient_harm?: boolean
          report_number?: string | null
          reported_at?: string
          reported_by?: string | null
          root_cause?: string | null
          serial_number?: string | null
          severity?: string
          tenant_id?: string | null
          udi?: string | null
          updated_at?: string
        }
        Update: {
          authority_reference?: string | null
          authority_status?: string
          created_at?: string
          device_name?: string | null
          id?: string
          immediate_action?: string | null
          incident_date?: string | null
          incident_description?: string
          patient_harm?: boolean
          report_number?: string | null
          reported_at?: string
          reported_by?: string | null
          root_cause?: string | null
          serial_number?: string | null
          severity?: string
          tenant_id?: string | null
          udi?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mdr_vigilance_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_backup_logs: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          row_counts: Json
          size_bytes: number
          started_at: string
          status: string
          storage_path: string | null
          tables: Json
          total_rows: number
          wave: number
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          row_counts?: Json
          size_bytes?: number
          started_at?: string
          status?: string
          storage_path?: string | null
          tables?: Json
          total_rows?: number
          wave: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          row_counts?: Json
          size_bytes?: number
          started_at?: string
          status?: string
          storage_path?: string | null
          tables?: Json
          total_rows?: number
          wave?: number
        }
        Relationships: []
      }
      mobile_push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      model_manuals: {
        Row: {
          created_at: string
          file_path: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          model_name: string | null
          source_id: string | null
          title: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          model_name?: string | null
          source_id?: string | null
          title?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          model_name?: string | null
          source_id?: string | null
          title?: string | null
          updated_at?: string
          version?: string | null
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
      repair_invoice_proposals: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string | null
          customer_company: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          device_label: string | null
          device_serial: string | null
          id: string
          invoice_id: string | null
          labor_cost: number | null
          labor_hours: number | null
          labor_rate: number | null
          notes: string | null
          parts: Json
          parts_total: number | null
          processed_at: string | null
          processed_by: string | null
          repair_number: string | null
          repair_order_id: string
          shipping_cost: number | null
          status: string
          ticket_id: string | null
          ticket_number: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_company?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          device_label?: string | null
          device_serial?: string | null
          id?: string
          invoice_id?: string | null
          labor_cost?: number | null
          labor_hours?: number | null
          labor_rate?: number | null
          notes?: string | null
          parts?: Json
          parts_total?: number | null
          processed_at?: string | null
          processed_by?: string | null
          repair_number?: string | null
          repair_order_id: string
          shipping_cost?: number | null
          status?: string
          ticket_id?: string | null
          ticket_number?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_company?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          device_label?: string | null
          device_serial?: string | null
          id?: string
          invoice_id?: string | null
          labor_cost?: number | null
          labor_hours?: number | null
          labor_rate?: number | null
          notes?: string | null
          parts?: Json
          parts_total?: number | null
          processed_at?: string | null
          processed_by?: string | null
          repair_number?: string | null
          repair_order_id?: string
          shipping_cost?: number | null
          status?: string
          ticket_id?: string | null
          ticket_number?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_invoice_proposals_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_invoice_proposals_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
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
          report_pdf_path: string | null
          sent_to_finance: boolean
          sent_to_finance_at: string | null
          sent_to_route_planning: boolean
          sent_to_route_planning_at: string | null
          shipped_at: string | null
          shipping_carrier: string | null
          shipping_note: string | null
          shipping_tracking_number: string | null
          shipping_tracking_url: string | null
          ticket_id: string | null
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
          report_pdf_path?: string | null
          sent_to_finance?: boolean
          sent_to_finance_at?: string | null
          sent_to_route_planning?: boolean
          sent_to_route_planning_at?: string | null
          shipped_at?: string | null
          shipping_carrier?: string | null
          shipping_note?: string | null
          shipping_tracking_number?: string | null
          shipping_tracking_url?: string | null
          ticket_id?: string | null
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
          report_pdf_path?: string | null
          sent_to_finance?: boolean
          sent_to_finance_at?: string | null
          sent_to_route_planning?: boolean
          sent_to_route_planning_at?: string | null
          shipped_at?: string | null
          shipping_carrier?: string | null
          shipping_note?: string | null
          shipping_tracking_number?: string | null
          shipping_tracking_url?: string | null
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
          visible_damages?: string | null
          work_order_pdf_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_orders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
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
      repair_quote_history: {
        Row: {
          action: string
          actor_email: string | null
          actor_user: string | null
          created_at: string
          id: string
          meta: Json | null
          quote_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          quote_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_quote_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "repair_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          kind: string
          line_total: number | null
          quantity: number | null
          quote_id: string
          sort_order: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          kind?: string
          line_total?: number | null
          quantity?: number | null
          quote_id: string
          sort_order?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kind?: string
          line_total?: number | null
          quantity?: number | null
          quote_id?: string
          sort_order?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "repair_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_quotes: {
        Row: {
          approval_token: string
          created_at: string
          created_by: string | null
          customer_note: string | null
          decided_at: string | null
          decided_by_email: string | null
          id: string
          internal_note: string | null
          labor_hours: number | null
          labor_rate: number | null
          labor_total: number | null
          parts_total: number | null
          pdf_path: string | null
          quote_number: string | null
          repair_order_id: string
          sent_at: string | null
          shipping_total: number | null
          status: string
          total_gross: number | null
          total_net: number | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          approval_token?: string
          created_at?: string
          created_by?: string | null
          customer_note?: string | null
          decided_at?: string | null
          decided_by_email?: string | null
          id?: string
          internal_note?: string | null
          labor_hours?: number | null
          labor_rate?: number | null
          labor_total?: number | null
          parts_total?: number | null
          pdf_path?: string | null
          quote_number?: string | null
          repair_order_id: string
          sent_at?: string | null
          shipping_total?: number | null
          status?: string
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          approval_token?: string
          created_at?: string
          created_by?: string | null
          customer_note?: string | null
          decided_at?: string | null
          decided_by_email?: string | null
          id?: string
          internal_note?: string | null
          labor_hours?: number | null
          labor_rate?: number | null
          labor_total?: number | null
          parts_total?: number | null
          pdf_path?: string | null
          quote_number?: string | null
          repair_order_id?: string
          sent_at?: string | null
          shipping_total?: number | null
          status?: string
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_quotes_repair_order_id_fkey"
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
          device_label: string | null
          id: string
          notes: string | null
          ordered_at: string | null
          part_name: string
          part_number: string | null
          priority: string | null
          quantity: number
          received_at: string | null
          repair_order_id: string
          requested_at: string | null
          requested_by: string | null
          serial_number: string | null
          status: string
          supplier: string | null
          ticket_id: string | null
          ticket_number: string | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          device_label?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          part_name: string
          part_number?: string | null
          priority?: string | null
          quantity?: number
          received_at?: string | null
          repair_order_id: string
          requested_at?: string | null
          requested_by?: string | null
          serial_number?: string | null
          status?: string
          supplier?: string | null
          ticket_id?: string | null
          ticket_number?: string | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          device_label?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          part_name?: string
          part_number?: string | null
          priority?: string | null
          quantity?: number
          received_at?: string | null
          repair_order_id?: string
          requested_at?: string | null
          requested_by?: string | null
          serial_number?: string | null
          status?: string
          supplier?: string | null
          ticket_id?: string | null
          ticket_number?: string | null
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
          {
            foreignKeyName: "repair_spare_parts_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
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
          check_in_at: string | null
          check_out_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          device_model: string | null
          device_serial_number: string | null
          fault_description: string | null
          finance_id: string | null
          id: string
          location_address: Json | null
          next_step: string | null
          order_id: string | null
          planned_date: string | null
          planning_note: string | null
          planning_status: string
          priority: string | null
          repair_order_id: string | null
          report_pdf_path: string | null
          requested_date: string | null
          result_outcome: string | null
          signature_path: string | null
          technician_user_id: string | null
          ticket_id: string | null
          time_window_end: string | null
          time_window_start: string | null
          tour_type: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
          vehicle_info: string | null
          work_ended_at: string | null
          work_performed: string | null
          work_started_at: string | null
        }
        Insert: {
          assigned_employee?: string | null
          assigned_team?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          device_model?: string | null
          device_serial_number?: string | null
          fault_description?: string | null
          finance_id?: string | null
          id?: string
          location_address?: Json | null
          next_step?: string | null
          order_id?: string | null
          planned_date?: string | null
          planning_note?: string | null
          planning_status?: string
          priority?: string | null
          repair_order_id?: string | null
          report_pdf_path?: string | null
          requested_date?: string | null
          result_outcome?: string | null
          signature_path?: string | null
          technician_user_id?: string | null
          ticket_id?: string | null
          time_window_end?: string | null
          time_window_start?: string | null
          tour_type?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          vehicle_info?: string | null
          work_ended_at?: string | null
          work_performed?: string | null
          work_started_at?: string | null
        }
        Update: {
          assigned_employee?: string | null
          assigned_team?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          device_model?: string | null
          device_serial_number?: string | null
          fault_description?: string | null
          finance_id?: string | null
          id?: string
          location_address?: Json | null
          next_step?: string | null
          order_id?: string | null
          planned_date?: string | null
          planning_note?: string | null
          planning_status?: string
          priority?: string | null
          repair_order_id?: string | null
          report_pdf_path?: string | null
          requested_date?: string | null
          result_outcome?: string | null
          signature_path?: string | null
          technician_user_id?: string | null
          ticket_id?: string | null
          time_window_end?: string | null
          time_window_start?: string | null
          tour_type?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          vehicle_info?: string | null
          work_ended_at?: string | null
          work_performed?: string | null
          work_started_at?: string | null
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
      service_ai_analyses: {
        Row: {
          arbeitszeit: Json | null
          confidence: number | null
          created_at: string
          created_by: string | null
          device_model: string | null
          device_type: string | null
          ersatzteile: Json | null
          fehlercode: string | null
          id: string
          model: string | null
          prompt_summary: string | null
          pruefschritte: Json | null
          raw_response: Json | null
          repair_order_id: string | null
          reparatur_empfehlung: string | null
          serial_number: string | null
          source_kind: string
          technikerempfehlung: Json | null
          ticket_id: string | null
          tokens_input: number | null
          tokens_output: number | null
          ursache: string | null
        }
        Insert: {
          arbeitszeit?: Json | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          device_model?: string | null
          device_type?: string | null
          ersatzteile?: Json | null
          fehlercode?: string | null
          id?: string
          model?: string | null
          prompt_summary?: string | null
          pruefschritte?: Json | null
          raw_response?: Json | null
          repair_order_id?: string | null
          reparatur_empfehlung?: string | null
          serial_number?: string | null
          source_kind: string
          technikerempfehlung?: Json | null
          ticket_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          ursache?: string | null
        }
        Update: {
          arbeitszeit?: Json | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          device_model?: string | null
          device_type?: string | null
          ersatzteile?: Json | null
          fehlercode?: string | null
          id?: string
          model?: string | null
          prompt_summary?: string | null
          pruefschritte?: Json | null
          raw_response?: Json | null
          repair_order_id?: string | null
          reparatur_empfehlung?: string | null
          serial_number?: string | null
          source_kind?: string
          technikerempfehlung?: Json | null
          ticket_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          ursache?: string | null
        }
        Relationships: []
      }
      service_ai_feedback: {
        Row: {
          analysis_id: string | null
          created_at: string
          created_by: string | null
          id: string
          korrektur: string | null
          rating: number | null
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          korrektur?: string | null
          rating?: number | null
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          korrektur?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_ai_feedback_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "service_ai_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_ai_repair_guides: {
        Row: {
          abschlusspruefung: Json | null
          analysis_id: string | null
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          pdf_path: string | null
          pruefschritte: Json | null
          repair_order_id: string | null
          reparaturschritte: Json | null
          sicherheit: Json | null
          ticket_id: string | null
          titel: string | null
        }
        Insert: {
          abschlusspruefung?: Json | null
          analysis_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          pdf_path?: string | null
          pruefschritte?: Json | null
          repair_order_id?: string | null
          reparaturschritte?: Json | null
          sicherheit?: Json | null
          ticket_id?: string | null
          titel?: string | null
        }
        Update: {
          abschlusspruefung?: Json | null
          analysis_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          pdf_path?: string | null
          pruefschritte?: Json | null
          repair_order_id?: string | null
          reparaturschritte?: Json | null
          sicherheit?: Json | null
          ticket_id?: string | null
          titel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_ai_repair_guides_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "service_ai_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_communication_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          recipient_email: string | null
          repair_order_id: string | null
          status: string
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          recipient_email?: string | null
          repair_order_id?: string | null
          status?: string
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          recipient_email?: string | null
          repair_order_id?: string | null
          status?: string
          ticket_id?: string | null
        }
        Relationships: []
      }
      service_knowledge_base: {
        Row: {
          arbeitszeit_erwartet: number | null
          arbeitszeit_max: number | null
          arbeitszeit_min: number | null
          created_at: string
          created_by: string | null
          device_name: string | null
          error_code: string | null
          ersatzteile: Json | null
          estimated_work_time_minutes: number | null
          fehlercode: string | null
          geraetetyp: string | null
          id: string
          loesung: string | null
          probable_cause: string | null
          quelle: string | null
          recommended_parts: Json | null
          solution: string | null
          source_reference_id: string | null
          source_type: string | null
          symptom: string
          symptom_en: string | null
          tags: string[] | null
          updated_at: string
          ursache: string | null
        }
        Insert: {
          arbeitszeit_erwartet?: number | null
          arbeitszeit_max?: number | null
          arbeitszeit_min?: number | null
          created_at?: string
          created_by?: string | null
          device_name?: string | null
          error_code?: string | null
          ersatzteile?: Json | null
          estimated_work_time_minutes?: number | null
          fehlercode?: string | null
          geraetetyp?: string | null
          id?: string
          loesung?: string | null
          probable_cause?: string | null
          quelle?: string | null
          recommended_parts?: Json | null
          solution?: string | null
          source_reference_id?: string | null
          source_type?: string | null
          symptom: string
          symptom_en?: string | null
          tags?: string[] | null
          updated_at?: string
          ursache?: string | null
        }
        Update: {
          arbeitszeit_erwartet?: number | null
          arbeitszeit_max?: number | null
          arbeitszeit_min?: number | null
          created_at?: string
          created_by?: string | null
          device_name?: string | null
          error_code?: string | null
          ersatzteile?: Json | null
          estimated_work_time_minutes?: number | null
          fehlercode?: string | null
          geraetetyp?: string | null
          id?: string
          loesung?: string | null
          probable_cause?: string | null
          quelle?: string | null
          recommended_parts?: Json | null
          solution?: string | null
          source_reference_id?: string | null
          source_type?: string | null
          symptom?: string
          symptom_en?: string | null
          tags?: string[] | null
          updated_at?: string
          ursache?: string | null
        }
        Relationships: []
      }
      spare_part_consumption: {
        Row: {
          consumed_at: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          device_serial: string | null
          id: string
          item_id: string | null
          item_name: string
          notes: string | null
          quantity: number
          sku: string | null
          source_id: string | null
          source_type: string
          technician_id: string | null
          warranty_case: boolean | null
        }
        Insert: {
          consumed_at?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          device_serial?: string | null
          id?: string
          item_id?: string | null
          item_name: string
          notes?: string | null
          quantity?: number
          sku?: string | null
          source_id?: string | null
          source_type: string
          technician_id?: string | null
          warranty_case?: boolean | null
        }
        Update: {
          consumed_at?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          device_serial?: string | null
          id?: string
          item_id?: string | null
          item_name?: string
          notes?: string | null
          quantity?: number
          sku?: string | null
          source_id?: string | null
          source_type?: string
          technician_id?: string | null
          warranty_case?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_consumption_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "spare_part_stock_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_consumption_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "zoho_items"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_part_order_items: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          notes: string | null
          order_id: string
          quantity: number
          received_quantity: number
          sku: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_name: string
          notes?: string | null
          order_id: string
          quantity?: number
          received_quantity?: number
          sku?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          received_quantity?: number
          sku?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "spare_part_stock_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "zoho_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "spare_part_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_part_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string | null
          expected_at: string | null
          id: string
          notes: string | null
          order_number: string | null
          ordered_at: string | null
          status: string
          supplier_id: string | null
          supplier_name: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          ordered_at?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          ordered_at?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      support_videos: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          device_model: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          source_id: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          device_model?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          source_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          device_model?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          source_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string | null
          id: string
          metadata: Json | null
          reason: string | null
          source_id: string | null
          source_system: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          source_id?: string | null
          source_system?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          reason?: string | null
          source_id?: string | null
          source_system?: string
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
      technician_skills: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      technician_stock: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          min_quantity: number | null
          quantity: number
          sku: string | null
          technician_id: string
          updated_at: string
          vehicle_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_name: string
          min_quantity?: number | null
          quantity?: number
          sku?: string | null
          technician_id: string
          updated_at?: string
          vehicle_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          min_quantity?: number | null
          quantity?: number
          sku?: string | null
          technician_id?: string
          updated_at?: string
          vehicle_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "spare_part_stock_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "zoho_items"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string | null
          item_name: string
          movement_type: string
          notes: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          sku: string | null
          technician_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string | null
          item_name: string
          movement_type: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          sku?: string | null
          technician_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string | null
          item_name?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          sku?: string | null
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "spare_part_stock_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "zoho_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          code: string
          country: string | null
          created_at: string
          currency: string | null
          flag_emoji: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          zoho_source_system: string | null
        }
        Insert: {
          code: string
          country?: string | null
          created_at?: string
          currency?: string | null
          flag_emoji?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          zoho_source_system?: string | null
        }
        Update: {
          code?: string
          country?: string | null
          created_at?: string
          currency?: string | null
          flag_emoji?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          zoho_source_system?: string | null
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          source_system: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          source_system?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          source_system?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_category_rules: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          keyword: string
          priority_override: string | null
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          id?: string
          keyword: string
          priority_override?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          keyword?: string
          priority_override?: string | null
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          created_at: string
          external_message_id: string | null
          id: string
          is_internal: boolean
          message: string | null
          sender_email: string | null
          sender_name: string | null
          sender_type: string | null
          source_system: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          external_message_id?: string | null
          id?: string
          is_internal?: boolean
          message?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_type?: string | null
          source_system?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          external_message_id?: string | null
          id?: string
          is_internal?: boolean
          message?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_type?: string | null
          source_system?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_outbound_sync_logs: {
        Row: {
          action: string
          attempt: number | null
          created_at: string
          direction: string | null
          error_message: string | null
          external_ticket_id: string | null
          id: string
          payload: Json | null
          response_code: number | null
          status: string
          ticket_id: string
        }
        Insert: {
          action: string
          attempt?: number | null
          created_at?: string
          direction?: string | null
          error_message?: string | null
          external_ticket_id?: string | null
          id?: string
          payload?: Json | null
          response_code?: number | null
          status: string
          ticket_id: string
        }
        Update: {
          action?: string
          attempt?: number | null
          created_at?: string
          direction?: string | null
          error_message?: string | null
          external_ticket_id?: string | null
          id?: string
          payload?: Json | null
          response_code?: number | null
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_outbound_sync_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_sync_alerts: {
        Row: {
          action: string | null
          alert_type: string
          created_at: string
          direction: string | null
          error_group: string | null
          error_message: string | null
          external_ticket_id: string | null
          id: string
          payload_excerpt: Json | null
          provider_response: Json | null
          response_code: number | null
          sent_at: string
          sent_to: string
          status: string
          ticket_id: string | null
          ticket_number: string | null
        }
        Insert: {
          action?: string | null
          alert_type: string
          created_at?: string
          direction?: string | null
          error_group?: string | null
          error_message?: string | null
          external_ticket_id?: string | null
          id?: string
          payload_excerpt?: Json | null
          provider_response?: Json | null
          response_code?: number | null
          sent_at?: string
          sent_to: string
          status?: string
          ticket_id?: string | null
          ticket_number?: string | null
        }
        Update: {
          action?: string | null
          alert_type?: string
          created_at?: string
          direction?: string | null
          error_group?: string | null
          error_message?: string | null
          external_ticket_id?: string | null
          id?: string
          payload_excerpt?: Json | null
          provider_response?: Json | null
          response_code?: number | null
          sent_at?: string
          sent_to?: string
          status?: string
          ticket_id?: string | null
          ticket_number?: string | null
        }
        Relationships: []
      }
      ticket_sync_logs: {
        Row: {
          action: string | null
          attempt: number | null
          created_at: string
          direction: string | null
          error_message: string | null
          external_ticket_id: string | null
          id: string
          payload: Json | null
          response_code: number | null
          status: string | null
        }
        Insert: {
          action?: string | null
          attempt?: number | null
          created_at?: string
          direction?: string | null
          error_message?: string | null
          external_ticket_id?: string | null
          id?: string
          payload?: Json | null
          response_code?: number | null
          status?: string | null
        }
        Update: {
          action?: string | null
          attempt?: number | null
          created_at?: string
          direction?: string | null
          error_message?: string | null
          external_ticket_id?: string | null
          id?: string
          payload?: Json | null
          response_code?: number | null
          status?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assigned_to: string | null
          auto_category: string | null
          auto_notify_customer: boolean | null
          auto_priority: string | null
          classified_at: string | null
          company_name: string | null
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_visible_status: string
          department: string
          description: string | null
          device_name: string | null
          external_ticket_id: string | null
          id: string
          internal_note: string | null
          last_outbound_sync_at: string | null
          last_synced_at: string | null
          order_number: string | null
          priority: string
          repair_order_id: string | null
          serial_number: string | null
          sla_last_check: string | null
          sla_status: string | null
          source_system: string
          status: string
          suggested_technician_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          auto_category?: string | null
          auto_notify_customer?: boolean | null
          auto_priority?: string | null
          classified_at?: string | null
          company_name?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_visible_status?: string
          department?: string
          description?: string | null
          device_name?: string | null
          external_ticket_id?: string | null
          id?: string
          internal_note?: string | null
          last_outbound_sync_at?: string | null
          last_synced_at?: string | null
          order_number?: string | null
          priority?: string
          repair_order_id?: string | null
          serial_number?: string | null
          sla_last_check?: string | null
          sla_status?: string | null
          source_system?: string
          status?: string
          suggested_technician_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          auto_category?: string | null
          auto_notify_customer?: boolean | null
          auto_priority?: string | null
          classified_at?: string | null
          company_name?: string | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_visible_status?: string
          department?: string
          description?: string | null
          device_name?: string | null
          external_ticket_id?: string | null
          id?: string
          internal_note?: string | null
          last_outbound_sync_at?: string | null
          last_synced_at?: string | null
          order_number?: string | null
          priority?: string
          repair_order_id?: string | null
          serial_number?: string | null
          sla_last_check?: string | null
          sla_status?: string | null
          source_system?: string
          status?: string
          suggested_technician_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
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
      user_tenant_access: {
        Row: {
          created_at: string
          id: string
          role_scope: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_scope?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_scope?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenant_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_claims: {
        Row: {
          approval_status: string
          approved_by: string | null
          claim_date: string
          claim_reason: string | null
          created_at: string
          id: string
          notes: string | null
          repair_id: string | null
          serial_number: string
          ticket_id: string | null
        }
        Insert: {
          approval_status?: string
          approved_by?: string | null
          claim_date?: string
          claim_reason?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          repair_id?: string | null
          serial_number: string
          ticket_id?: string | null
        }
        Update: {
          approval_status?: string
          approved_by?: string | null
          claim_date?: string
          claim_reason?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          repair_id?: string | null
          serial_number?: string
          ticket_id?: string | null
        }
        Relationships: []
      }
      warranty_cost_items: {
        Row: {
          billing_target: string | null
          cost_date: string | null
          cost_type: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          quantity: number | null
          serial_number: string | null
          total_amount: number | null
          unit_price: number | null
          updated_at: string
          warranty_decision_id: string | null
        }
        Insert: {
          billing_target?: string | null
          cost_date?: string | null
          cost_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          quantity?: number | null
          serial_number?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string
          warranty_decision_id?: string | null
        }
        Update: {
          billing_target?: string | null
          cost_date?: string | null
          cost_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          quantity?: number | null
          serial_number?: string | null
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string
          warranty_decision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_cost_items_warranty_decision_id_fkey"
            columns: ["warranty_decision_id"]
            isOneToOne: false
            referencedRelation: "warranty_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_decisions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          check_result: string | null
          cost_coverage_company: number | null
          cost_coverage_customer: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_reason: string | null
          device_name: string | null
          id: string
          maintenance_id: string | null
          notes: string | null
          repair_order_id: string | null
          serial_number: string | null
          source_type: string
          ticket_id: string | null
          total_cost: number | null
          updated_at: string
          warranty_record_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          check_result?: string | null
          cost_coverage_company?: number | null
          cost_coverage_customer?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          device_name?: string | null
          id?: string
          maintenance_id?: string | null
          notes?: string | null
          repair_order_id?: string | null
          serial_number?: string | null
          source_type: string
          ticket_id?: string | null
          total_cost?: number | null
          updated_at?: string
          warranty_record_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          check_result?: string | null
          cost_coverage_company?: number | null
          cost_coverage_customer?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_reason?: string | null
          device_name?: string | null
          id?: string
          maintenance_id?: string | null
          notes?: string | null
          repair_order_id?: string | null
          serial_number?: string | null
          source_type?: string
          ticket_id?: string | null
          total_cost?: number | null
          updated_at?: string
          warranty_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_decisions_warranty_record_id_fkey"
            columns: ["warranty_record_id"]
            isOneToOne: false
            referencedRelation: "warranty_records"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_records: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          device_name: string | null
          id: string
          manufacturer: string | null
          serial_number: string
          updated_at: string
          warranty_end: string | null
          warranty_notes: string | null
          warranty_start: string | null
          warranty_status: string
          warranty_terms: string | null
          warranty_type: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          device_name?: string | null
          id?: string
          manufacturer?: string | null
          serial_number: string
          updated_at?: string
          warranty_end?: string | null
          warranty_notes?: string | null
          warranty_start?: string | null
          warranty_status?: string
          warranty_terms?: string | null
          warranty_type?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          device_name?: string | null
          id?: string
          manufacturer?: string | null
          serial_number?: string
          updated_at?: string
          warranty_end?: string | null
          warranty_notes?: string | null
          warranty_start?: string | null
          warranty_status?: string
          warranty_terms?: string | null
          warranty_type?: string | null
        }
        Relationships: []
      }
      whatsapp_automations: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          requires_consent: string
          template_id: string | null
          trigger_event: string
          trigger_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          requires_consent?: string
          template_id?: string | null
          trigger_event: string
          trigger_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requires_consent?: string
          template_id?: string | null
          trigger_event?: string
          trigger_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_consents: {
        Row: {
          consent_marketing: boolean
          consent_service: boolean
          consent_transactional: boolean
          created_at: string
          created_by: string | null
          customer_id: string | null
          granted_at: string
          id: string
          ip_address: string | null
          notes: string | null
          phone_number: string
          revoked_at: string | null
          source: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          consent_marketing?: boolean
          consent_service?: boolean
          consent_transactional?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          granted_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          phone_number: string
          revoked_at?: string | null
          source?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          consent_marketing?: boolean
          consent_service?: boolean
          consent_transactional?: boolean
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          granted_at?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          phone_number?: string
          revoked_at?: string | null
          source?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          department: string | null
          direction: string
          error_message: string | null
          id: string
          media_type: string | null
          media_url: string | null
          meta_message_id: string | null
          order_id: string | null
          phone_number: string
          read_at: string | null
          received_at: string | null
          repair_order_id: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          department?: string | null
          direction: string
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          meta_message_id?: string | null
          order_id?: string | null
          phone_number: string
          read_at?: string | null
          received_at?: string | null
          repair_order_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          department?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          meta_message_id?: string | null
          order_id?: string | null
          phone_number?: string
          read_at?: string | null
          received_at?: string | null
          repair_order_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sc_conversations: {
        Row: {
          assigned_department: string
          assigned_to: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          last_message_at: string
          linked_customer_id: string | null
          linked_ticket_id: string | null
          opt_out: boolean
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_department?: string
          assigned_to?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_message_at?: string
          linked_customer_id?: string | null
          linked_ticket_id?: string | null
          opt_out?: boolean
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_department?: string
          assigned_to?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_message_at?: string
          linked_customer_id?: string | null
          linked_ticket_id?: string | null
          opt_out?: boolean
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sc_conversations_linked_customer_id_fkey"
            columns: ["linked_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_sc_conversations_linked_ticket_id_fkey"
            columns: ["linked_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sc_messages: {
        Row: {
          conversation_id: string
          created_at: string
          direction: string
          id: string
          media_type: string | null
          media_url: string | null
          message_text: string | null
          receiver_phone: string | null
          sender_name: string | null
          sender_phone: string | null
          status: string
          ticket_id: string | null
          twilio_message_sid: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          receiver_phone?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          ticket_id?: string | null
          twilio_message_sid?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          receiver_phone?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          ticket_id?: string | null
          twilio_message_sid?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sc_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sc_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_sc_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sc_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          key: string
          language: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          key: string
          language?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          key?: string
          language?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_sync_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          payload: Json | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          status: string
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          status?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          language: string
          meta_template_name: string | null
          meta_template_status: string | null
          name: string
          status: string
          updated_at: string
          updated_by: string | null
          variables: Json
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          language?: string
          meta_template_name?: string | null
          meta_template_status?: string | null
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          language?: string
          meta_template_name?: string | null
          meta_template_status?: string | null
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          variables?: Json
        }
        Relationships: []
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
          is_spare_part: boolean | null
          item_type: string | null
          lead_time_days: number | null
          manufacturer: string | null
          min_stock: number | null
          name: string | null
          primary_supplier_id: string | null
          primary_supplier_name: string | null
          product_type: string | null
          purchase_rate: number | null
          rate: number | null
          raw_data: Json | null
          reorder_level: number | null
          serial_required: boolean | null
          sku: string | null
          source_system: string
          status: string | null
          stock_on_hand: number | null
          stock_on_order: number | null
          stock_reserved: number | null
          storage_location: string | null
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
          is_spare_part?: boolean | null
          item_type?: string | null
          lead_time_days?: number | null
          manufacturer?: string | null
          min_stock?: number | null
          name?: string | null
          primary_supplier_id?: string | null
          primary_supplier_name?: string | null
          product_type?: string | null
          purchase_rate?: number | null
          rate?: number | null
          raw_data?: Json | null
          reorder_level?: number | null
          serial_required?: boolean | null
          sku?: string | null
          source_system?: string
          status?: string | null
          stock_on_hand?: number | null
          stock_on_order?: number | null
          stock_reserved?: number | null
          storage_location?: string | null
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
          is_spare_part?: boolean | null
          item_type?: string | null
          lead_time_days?: number | null
          manufacturer?: string | null
          min_stock?: number | null
          name?: string | null
          primary_supplier_id?: string | null
          primary_supplier_name?: string | null
          product_type?: string | null
          purchase_rate?: number | null
          rate?: number | null
          raw_data?: Json | null
          reorder_level?: number | null
          serial_required?: boolean | null
          sku?: string | null
          source_system?: string
          status?: string | null
          stock_on_hand?: number | null
          stock_on_order?: number | null
          stock_reserved?: number | null
          storage_location?: string | null
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
        Relationships: [
          {
            foreignKeyName: "zoho_items_primary_supplier_id_fkey"
            columns: ["primary_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
      spare_part_stock_overview: {
        Row: {
          brand: string | null
          category_name: string | null
          ek: number | null
          id: string | null
          is_spare_part: boolean | null
          lead_time_days: number | null
          manufacturer: string | null
          min_stock: number | null
          name: string | null
          primary_supplier_id: string | null
          primary_supplier_name: string | null
          reorder_level: number | null
          serial_required: boolean | null
          sku: string | null
          stock_available: number | null
          stock_on_hand: number | null
          stock_on_order: number | null
          stock_reserved: number | null
          stock_status: string | null
          storage_location: string | null
          vk: number | null
        }
        Insert: {
          brand?: string | null
          category_name?: string | null
          ek?: number | null
          id?: string | null
          is_spare_part?: boolean | null
          lead_time_days?: number | null
          manufacturer?: string | null
          min_stock?: number | null
          name?: string | null
          primary_supplier_id?: string | null
          primary_supplier_name?: string | null
          reorder_level?: number | null
          serial_required?: boolean | null
          sku?: string | null
          stock_available?: never
          stock_on_hand?: never
          stock_on_order?: never
          stock_reserved?: never
          stock_status?: never
          storage_location?: string | null
          vk?: number | null
        }
        Update: {
          brand?: string | null
          category_name?: string | null
          ek?: number | null
          id?: string | null
          is_spare_part?: boolean | null
          lead_time_days?: number | null
          manufacturer?: string | null
          min_stock?: number | null
          name?: string | null
          primary_supplier_id?: string | null
          primary_supplier_name?: string | null
          reorder_level?: number | null
          serial_required?: boolean | null
          sku?: string | null
          stock_available?: never
          stock_on_hand?: never
          stock_on_order?: never
          stock_reserved?: never
          stock_status?: never
          storage_location?: string | null
          vk?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "zoho_items_primary_supplier_id_fkey"
            columns: ["primary_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_ai_service: { Args: never; Returns: boolean }
      can_access_finance: { Args: never; Returns: boolean }
      can_access_financing: { Args: never; Returns: boolean }
      can_access_import_logs: { Args: never; Returns: boolean }
      can_access_mail: { Args: never; Returns: boolean }
      can_access_maintenance: { Args: never; Returns: boolean }
      can_access_orders: { Args: never; Returns: boolean }
      can_access_planning: { Args: never; Returns: boolean }
      can_access_qm: { Args: never; Returns: boolean }
      can_access_repair: { Args: never; Returns: boolean }
      can_access_tickets: { Args: never; Returns: boolean }
      can_access_warranty: { Args: never; Returns: boolean }
      can_approve_warranty: { Args: never; Returns: boolean }
      can_manage_mail_campaigns: { Args: never; Returns: boolean }
      can_manage_mail_domains: { Args: never; Returns: boolean }
      can_manage_mail_templates: { Args: never; Returns: boolean }
      can_manage_maintenance: { Args: never; Returns: boolean }
      can_manage_orders: { Args: never; Returns: boolean }
      can_manage_planning: { Args: never; Returns: boolean }
      can_manage_repair: { Args: never; Returns: boolean }
      can_manage_tickets: { Args: never; Returns: boolean }
      can_manage_warranty: { Args: never; Returns: boolean }
      can_manage_whatsapp_automation: { Args: never; Returns: boolean }
      can_run_ai_service: { Args: never; Returns: boolean }
      can_send_whatsapp: { Args: never; Returns: boolean }
      can_upload_factory_invoice: { Args: never; Returns: boolean }
      can_view_mail_audit: { Args: never; Returns: boolean }
      check_rate_limit: {
        Args: { _bucket: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      clear_factory_invoice_pdf: {
        Args: { _production_order_id: string }
        Returns: undefined
      }
      complete_password_setup: { Args: never; Returns: undefined }
      current_portal_customer_id: { Args: never; Returns: string }
      current_supplier_id: { Args: never; Returns: string }
      dl_upsert: {
        Args: {
          _customer_id: string
          _customer_name: string
          _description: string
          _device: string
          _event_date: string
          _event_source: string
          _event_type: string
          _meta?: Json
          _reference_id: string
          _serial: string
        }
        Returns: undefined
      }
      get_table_columns: { Args: { _table: string }; Returns: string[] }
      has_role: { Args: { check_role: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_portal_customer: { Args: never; Returns: boolean }
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
      notify_customer_event: {
        Args: {
          _customer_name: string
          _event: string
          _message?: string
          _recipient_email: string
          _repair_number: string
          _repair_order_id: string
          _ticket_id: string
          _ticket_number: string
        }
        Returns: undefined
      }
      recompute_device_health: { Args: { _serial: string }; Returns: undefined }
      refresh_warranty_and_maintenance_status: {
        Args: never
        Returns: undefined
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
      tenant_id_for_source: { Args: { _source: string }; Returns: string }
      user_has_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      user_mailboxes: { Args: never; Returns: string[] }
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
