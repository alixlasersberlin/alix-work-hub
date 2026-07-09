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
      alix_sign_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          sign_request_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          sign_request_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          sign_request_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alix_sign_audit_log_sign_request_id_fkey"
            columns: ["sign_request_id"]
            isOneToOne: false
            referencedRelation: "alix_sign_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      alix_sign_requests: {
        Row: {
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          expires_at: string
          id: string
          offer_number: string
          offer_payload: Json
          opened_at: string | null
          signed_at: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          expires_at?: string
          id?: string
          offer_number: string
          offer_payload: Json
          opened_at?: string | null
          signed_at?: string | null
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          expires_at?: string
          id?: string
          offer_number?: string
          offer_payload?: Json
          opened_at?: string | null
          signed_at?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alix_sign_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      alix_sign_signatures: {
        Row: {
          accepted_credit_check: boolean | null
          accepted_electronic_signature: boolean
          accepted_offer: boolean
          accepted_privacy: boolean
          accepted_terms: boolean
          created_at: string
          customer_id: string | null
          id: string
          ip_address: unknown
          offer_number: string
          pdf_data: string | null
          pdf_hash: string | null
          sign_request_id: string
          signature_image_data: string | null
          signer_email: string
          signer_location: string | null
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          accepted_credit_check?: boolean | null
          accepted_electronic_signature?: boolean
          accepted_offer?: boolean
          accepted_privacy?: boolean
          accepted_terms?: boolean
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: unknown
          offer_number: string
          pdf_data?: string | null
          pdf_hash?: string | null
          sign_request_id: string
          signature_image_data?: string | null
          signer_email: string
          signer_location?: string | null
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          accepted_credit_check?: boolean | null
          accepted_electronic_signature?: boolean
          accepted_offer?: boolean
          accepted_privacy?: boolean
          accepted_terms?: boolean
          created_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: unknown
          offer_number?: string
          pdf_data?: string | null
          pdf_hash?: string | null
          sign_request_id?: string
          signature_image_data?: string | null
          signer_email?: string
          signer_location?: string | null
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alix_sign_signatures_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alix_sign_signatures_sign_request_id_fkey"
            columns: ["sign_request_id"]
            isOneToOne: false
            referencedRelation: "alix_sign_requests"
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
      as_callbacks: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          done_at: string | null
          done_by: string | null
          due_at: string
          id: string
          priority: Database["public"]["Enums"]["as_priority"]
          reason: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          due_at: string
          id?: string
          priority?: Database["public"]["Enums"]["as_priority"]
          reason?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          done_by?: string | null
          due_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["as_priority"]
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "as_callbacks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "as_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "as_callbacks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "as_cases_list_v"
            referencedColumns: ["id"]
          },
        ]
      }
      as_cases: {
        Row: {
          assignee_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          customer_id: string | null
          device_id: string | null
          health_score: number | null
          id: string
          last_contact_at: string | null
          metadata: Json
          next_callback_at: string | null
          order_id: string
          priority: Database["public"]["Enums"]["as_priority"]
          progress_pct: number
          sales_user_name: string | null
          satisfaction_note: string | null
          satisfaction_rating: number | null
          status: Database["public"]["Enums"]["as_case_status"]
          tenant_id: string | null
          traffic_light: Database["public"]["Enums"]["as_traffic_light"]
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          health_score?: number | null
          id?: string
          last_contact_at?: string | null
          metadata?: Json
          next_callback_at?: string | null
          order_id: string
          priority?: Database["public"]["Enums"]["as_priority"]
          progress_pct?: number
          sales_user_name?: string | null
          satisfaction_note?: string | null
          satisfaction_rating?: number | null
          status?: Database["public"]["Enums"]["as_case_status"]
          tenant_id?: string | null
          traffic_light?: Database["public"]["Enums"]["as_traffic_light"]
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          health_score?: number | null
          id?: string
          last_contact_at?: string | null
          metadata?: Json
          next_callback_at?: string | null
          order_id?: string
          priority?: Database["public"]["Enums"]["as_priority"]
          progress_pct?: number
          sales_user_name?: string | null
          satisfaction_note?: string | null
          satisfaction_rating?: number | null
          status?: Database["public"]["Enums"]["as_case_status"]
          tenant_id?: string | null
          traffic_light?: Database["public"]["Enums"]["as_traffic_light"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "as_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "as_cases_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "lager_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "as_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      as_checklist_items: {
        Row: {
          case_id: string
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          id: string
          item_key: string
          label: string
          note: string | null
          section: Database["public"]["Enums"]["as_section"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          case_id: string
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          item_key: string
          label: string
          note?: string | null
          section: Database["public"]["Enums"]["as_section"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          case_id?: string
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          item_key?: string
          label?: string
          note?: string | null
          section?: Database["public"]["Enums"]["as_section"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "as_checklist_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "as_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "as_checklist_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "as_cases_list_v"
            referencedColumns: ["id"]
          },
        ]
      }
      as_mediapaket_status: {
        Row: {
          case_id: string
          note: string | null
          stage: Database["public"]["Enums"]["as_mediapaket_stage"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          case_id: string
          note?: string | null
          stage?: Database["public"]["Enums"]["as_mediapaket_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          case_id?: string
          note?: string | null
          stage?: Database["public"]["Enums"]["as_mediapaket_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "as_mediapaket_status_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "as_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "as_mediapaket_status_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "as_cases_list_v"
            referencedColumns: ["id"]
          },
        ]
      }
      as_reminders: {
        Row: {
          case_id: string
          channel: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["as_reminder_kind"]
          payload: Json
          scheduled_at: string
          sent_at: string | null
        }
        Insert: {
          case_id: string
          channel?: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["as_reminder_kind"]
          payload?: Json
          scheduled_at?: string
          sent_at?: string | null
        }
        Update: {
          case_id?: string
          channel?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["as_reminder_kind"]
          payload?: Json
          scheduled_at?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "as_reminders_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "as_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "as_reminders_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "as_cases_list_v"
            referencedColumns: ["id"]
          },
        ]
      }
      as_timeline_events: {
        Row: {
          body: string | null
          case_id: string
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          source: string
          title: string
        }
        Insert: {
          body?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          source?: string
          title: string
        }
        Update: {
          body?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "as_timeline_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "as_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "as_timeline_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "as_cases_list_v"
            referencedColumns: ["id"]
          },
        ]
      }
      as_upsell_suggestions: {
        Row: {
          accepted: boolean | null
          case_id: string
          created_at: string
          id: string
          label: string
          note: string | null
          offer_id: string | null
          product_key: string
          updated_at: string
        }
        Insert: {
          accepted?: boolean | null
          case_id: string
          created_at?: string
          id?: string
          label: string
          note?: string | null
          offer_id?: string | null
          product_key: string
          updated_at?: string
        }
        Update: {
          accepted?: boolean | null
          case_id?: string
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          offer_id?: string | null
          product_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "as_upsell_suggestions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "as_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "as_upsell_suggestions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "as_cases_list_v"
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
      backup_notifications: {
        Row: {
          channel: string
          created_at: string
          event: string
          id: string
          payload: Json
          recipient: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          channel: string
          created_at?: string
          event: string
          id?: string
          payload?: Json
          recipient?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          event?: string
          id?: string
          payload?: Json
          recipient?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      backup_schedules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          cron: string | null
          id: string
          name: string
          retention_days: number
          schedule_type: string
          scope: string
          time_of_day: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          cron?: string | null
          id?: string
          name: string
          retention_days?: number
          schedule_type: string
          scope?: string
          time_of_day?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          cron?: string | null
          id?: string
          name?: string
          retention_days?: number
          schedule_type?: string
          scope?: string
          time_of_day?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      backup_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
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
      copilot_audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      copilot_departments: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          key: string
          label: string
          search_customers: boolean
          search_devices: boolean
          search_documents: boolean
          search_invoices: boolean
          search_maintenance: boolean
          search_offers: boolean
          search_repairs: boolean
          search_tickets: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          label: string
          search_customers?: boolean
          search_devices?: boolean
          search_documents?: boolean
          search_invoices?: boolean
          search_maintenance?: boolean
          search_offers?: boolean
          search_repairs?: boolean
          search_tickets?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          search_customers?: boolean
          search_devices?: boolean
          search_documents?: boolean
          search_invoices?: boolean
          search_maintenance?: boolean
          search_offers?: boolean
          search_repairs?: boolean
          search_tickets?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      copilot_import_jobs: {
        Row: {
          category: string | null
          created_at: string
          department: string | null
          error_message: string | null
          filename: string | null
          finished_at: string | null
          id: string
          recognized_items: number | null
          source_id: string | null
          started_by: string | null
          status: string
          tags: string[] | null
          updated_at: string
          version: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          department?: string | null
          error_message?: string | null
          filename?: string | null
          finished_at?: string | null
          id?: string
          recognized_items?: number | null
          source_id?: string | null
          started_by?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          department?: string | null
          error_message?: string | null
          filename?: string | null
          finished_at?: string | null
          id?: string
          recognized_items?: number | null
          source_id?: string | null
          started_by?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "copilot_import_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "copilot_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_knowledge_entries: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          priority: string
          responsible_user_id: string | null
          source: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          version: string | null
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          priority?: string
          responsible_user_id?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          priority?: string
          responsible_user_id?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          version?: string | null
        }
        Relationships: []
      }
      copilot_module_access: {
        Row: {
          created_at: string
          data_scope: string | null
          enabled: boolean
          id: string
          label: string
          module_key: string
          read_allowed: boolean
          role_restrictions: string[] | null
          updated_at: string
          write_allowed: boolean
        }
        Insert: {
          created_at?: string
          data_scope?: string | null
          enabled?: boolean
          id?: string
          label: string
          module_key: string
          read_allowed?: boolean
          role_restrictions?: string[] | null
          updated_at?: string
          write_allowed?: boolean
        }
        Update: {
          created_at?: string
          data_scope?: string | null
          enabled?: boolean
          id?: string
          label?: string
          module_key?: string
          read_allowed?: boolean
          role_restrictions?: string[] | null
          updated_at?: string
          write_allowed?: boolean
        }
        Relationships: []
      }
      copilot_settings: {
        Row: {
          auto_language: boolean
          cite_sources: boolean
          created_at: string
          id: string
          key: string
          mark_uncertain: boolean
          only_approved_sources: boolean
          prioritize_internal: boolean
          prioritize_iso: boolean
          restrict_customer_data: boolean
          restrict_finance_data: boolean
          restrict_pii: boolean
          tone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_language?: boolean
          cite_sources?: boolean
          created_at?: string
          id?: string
          key?: string
          mark_uncertain?: boolean
          only_approved_sources?: boolean
          prioritize_internal?: boolean
          prioritize_iso?: boolean
          restrict_customer_data?: boolean
          restrict_finance_data?: boolean
          restrict_pii?: boolean
          tone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_language?: boolean
          cite_sources?: boolean
          created_at?: string
          id?: string
          key?: string
          mark_uncertain?: boolean
          only_approved_sources?: boolean
          prioritize_internal?: boolean
          prioritize_iso?: boolean
          restrict_customer_data?: boolean
          restrict_finance_data?: boolean
          restrict_pii?: boolean
          tone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      copilot_source_files: {
        Row: {
          created_at: string
          created_by: string | null
          extracted_chars: number | null
          filename: string | null
          id: string
          mime: string | null
          pages: number | null
          size_bytes: number | null
          source_id: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          extracted_chars?: number | null
          filename?: string | null
          id?: string
          mime?: string | null
          pages?: number | null
          size_bytes?: number | null
          source_id: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          extracted_chars?: number | null
          filename?: string | null
          id?: string
          mime?: string | null
          pages?: number | null
          size_bytes?: number | null
          source_id?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_source_files_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "copilot_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_sources: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          file_path: string | null
          id: string
          last_import_at: string | null
          owner_user_id: string | null
          source_type: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          url: string | null
          valid_from: string | null
          valid_to: string | null
          version: string | null
          visible_to_copilot: boolean
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          last_import_at?: string | null
          owner_user_id?: string | null
          source_type?: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          url?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: string | null
          visible_to_copilot?: boolean
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          last_import_at?: string | null
          owner_user_id?: string | null
          source_type?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          url?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: string | null
          visible_to_copilot?: boolean
        }
        Relationships: []
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
      customer_sms_logs: {
        Row: {
          created_at: string
          customer_id: string | null
          document_id: string | null
          document_number: string | null
          document_type: string | null
          error_message: string | null
          id: string
          link_url: string | null
          message_text: string
          order_id: string | null
          phone: string
          recipient_name: string | null
          sent_at: string
          sent_by: string | null
          status: string
          twilio_sid: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          document_id?: string | null
          document_number?: string | null
          document_type?: string | null
          error_message?: string | null
          id?: string
          link_url?: string | null
          message_text: string
          order_id?: string | null
          phone: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          twilio_sid?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          document_id?: string | null
          document_number?: string | null
          document_type?: string | null
          error_message?: string | null
          id?: string
          link_url?: string | null
          message_text?: string
          order_id?: string | null
          phone?: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_sms_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sms_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          bank_name: string | null
          bic: string | null
          billing_address: Json | null
          birth_date: string | null
          company_name: string | null
          contact_name: string | null
          contact_tenant_id: string | null
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
          supplier_tenant_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bank_name?: string | null
          bic?: string | null
          billing_address?: Json | null
          birth_date?: string | null
          company_name?: string | null
          contact_name?: string | null
          contact_tenant_id?: string | null
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
          supplier_tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bank_name?: string | null
          bic?: string | null
          billing_address?: Json | null
          birth_date?: string | null
          company_name?: string | null
          contact_name?: string | null
          contact_tenant_id?: string | null
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
          supplier_tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_contact_tenant_id_fkey"
            columns: ["contact_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_supplier_tenant_id_fkey"
            columns: ["supplier_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      esc_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          new_values_json: Json | null
          old_values_json: Json | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values_json?: Json | null
          old_values_json?: Json | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values_json?: Json | null
          old_values_json?: Json | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      esc_departments: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          default_duration_minutes: number
          default_email_template_id: string | null
          default_location: string | null
          department_lead_user_id: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_public_bookable: boolean
          name: string
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number
          default_email_template_id?: string | null
          default_location?: string | null
          department_lead_user_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_public_bookable?: boolean
          name: string
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number
          default_email_template_id?: string | null
          default_location?: string | null
          department_lead_user_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_public_bookable?: boolean
          name?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esc_dept_default_tpl_fk"
            columns: ["default_email_template_id"]
            isOneToOne: false
            referencedRelation: "esc_email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      esc_email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          subject: string
          template_type: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esc_email_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "esc_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      esc_employee_departments: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          is_primary: boolean
          is_public_bookable: boolean
          role_in_department: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          is_primary?: boolean
          is_public_bookable?: boolean
          role_in_department?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          is_primary?: boolean
          is_public_bookable?: boolean
          role_in_department?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esc_employee_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "esc_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      esc_employee_settings: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          calendar_color: string
          created_at: string
          default_location: string | null
          id: string
          max_bookings_per_day: number | null
          timezone: string
          updated_at: string
          user_id: string
          visible_in_public_booking: boolean
          working_hours_json: Json
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_color?: string
          created_at?: string
          default_location?: string | null
          id?: string
          max_bookings_per_day?: number | null
          timezone?: string
          updated_at?: string
          user_id: string
          visible_in_public_booking?: boolean
          working_hours_json?: Json
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_color?: string
          created_at?: string
          default_location?: string | null
          id?: string
          max_bookings_per_day?: number | null
          timezone?: string
          updated_at?: string
          user_id?: string
          visible_in_public_booking?: boolean
          working_hours_json?: Json
        }
        Relationships: []
      }
      esc_event_emails: {
        Row: {
          clicked_at: string | null
          created_at: string
          error_message: string | null
          event_id: string | null
          id: string
          opened_at: string | null
          participant_id: string | null
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string
          template_id: string | null
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          opened_at?: string | null
          participant_id?: string | null
          provider_message_id?: string | null
          recipient_email: string
          sent_at?: string | null
          status?: string
          subject: string
          template_id?: string | null
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          opened_at?: string | null
          participant_id?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esc_event_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "esc_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esc_event_emails_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "esc_event_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esc_event_emails_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "esc_email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      esc_event_participants: {
        Row: {
          confirmation_sent_at: string | null
          confirmation_status: string
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string | null
          declined_at: string | null
          email: string | null
          event_id: string
          id: string
          name: string | null
          participant_type: string
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          confirmation_sent_at?: string | null
          confirmation_status?: string
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          declined_at?: string | null
          email?: string | null
          event_id: string
          id?: string
          name?: string | null
          participant_type: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          confirmation_sent_at?: string | null
          confirmation_status?: string
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          declined_at?: string | null
          email?: string | null
          event_id?: string
          id?: string
          name?: string | null
          participant_type?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esc_event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "esc_events"
            referencedColumns: ["id"]
          },
        ]
      }
      esc_event_resources: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          resource_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esc_event_resources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "esc_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esc_event_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "esc_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      esc_event_types: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          default_duration_minutes: number
          department_id: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_public_bookable: boolean
          name: string
          requires_confirmation_default: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number
          department_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_public_bookable?: boolean
          name: string
          requires_confirmation_default?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number
          department_id?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_public_bookable?: boolean
          name?: string
          requires_confirmation_default?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "esc_event_types_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "esc_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      esc_events: {
        Row: {
          address: string | null
          all_day: boolean
          assigned_user_id: string | null
          confirmation_status: string
          confirmation_token: string | null
          confirmation_token_expires_at: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          deleted_at: string | null
          department_id: string
          description: string | null
          device_id: string | null
          end_at: string
          event_type_id: string | null
          external_note: string | null
          ics_uid: string | null
          id: string
          internal_note: string | null
          is_public_booking: boolean
          is_recurring: boolean
          location: string | null
          parent_event_id: string | null
          priority: string
          public_booking_id: string | null
          recurrence_rule: string | null
          requires_confirmation: boolean
          resource_id: string | null
          room_id: string | null
          source: string
          start_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          address?: string | null
          all_day?: boolean
          assigned_user_id?: string | null
          confirmation_status?: string
          confirmation_token?: string | null
          confirmation_token_expires_at?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          department_id: string
          description?: string | null
          device_id?: string | null
          end_at: string
          event_type_id?: string | null
          external_note?: string | null
          ics_uid?: string | null
          id?: string
          internal_note?: string | null
          is_public_booking?: boolean
          is_recurring?: boolean
          location?: string | null
          parent_event_id?: string | null
          priority?: string
          public_booking_id?: string | null
          recurrence_rule?: string | null
          requires_confirmation?: boolean
          resource_id?: string | null
          room_id?: string | null
          source?: string
          start_at: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          address?: string | null
          all_day?: boolean
          assigned_user_id?: string | null
          confirmation_status?: string
          confirmation_token?: string | null
          confirmation_token_expires_at?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deleted_at?: string | null
          department_id?: string
          description?: string | null
          device_id?: string | null
          end_at?: string
          event_type_id?: string | null
          external_note?: string | null
          ics_uid?: string | null
          id?: string
          internal_note?: string | null
          is_public_booking?: boolean
          is_recurring?: boolean
          location?: string | null
          parent_event_id?: string | null
          priority?: string
          public_booking_id?: string | null
          recurrence_rule?: string | null
          requires_confirmation?: boolean
          resource_id?: string | null
          room_id?: string | null
          source?: string
          start_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esc_events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "esc_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esc_events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "esc_event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esc_events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "esc_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esc_events_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "esc_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esc_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "esc_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esc_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "esc_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      esc_ics_tokens: {
        Row: {
          created_at: string
          department_id: string | null
          expires_at: string
          feed_type: string
          id: string
          is_active: boolean
          revoked_at: string | null
          token: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          expires_at?: string
          feed_type: string
          id?: string
          is_active?: boolean
          revoked_at?: string | null
          token?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          expires_at?: string
          feed_type?: string
          id?: string
          is_active?: boolean
          revoked_at?: string | null
          token?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esc_ics_tokens_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "esc_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      esc_public_bookings: {
        Row: {
          booking_number: string
          company_name: string | null
          confirmation_token: string
          created_at: string
          created_event_id: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          department_id: string
          event_type_id: string | null
          id: string
          ip_address: string | null
          message: string | null
          preferred_end_at: string | null
          preferred_start_at: string
          source: string
          status: string
          timezone: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          booking_number?: string
          company_name?: string | null
          confirmation_token?: string
          created_at?: string
          created_event_id?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          department_id: string
          event_type_id?: string | null
          id?: string
          ip_address?: string | null
          message?: string | null
          preferred_end_at?: string | null
          preferred_start_at: string
          source?: string
          status?: string
          timezone?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          booking_number?: string
          company_name?: string | null
          confirmation_token?: string
          created_at?: string
          created_event_id?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          department_id?: string
          event_type_id?: string | null
          id?: string
          ip_address?: string | null
          message?: string | null
          preferred_end_at?: string | null
          preferred_start_at?: string
          source?: string
          status?: string
          timezone?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esc_public_bookings_created_event_id_fkey"
            columns: ["created_event_id"]
            isOneToOne: false
            referencedRelation: "esc_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esc_public_bookings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "esc_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esc_public_bookings_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "esc_event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      esc_resources: {
        Row: {
          capacity: number | null
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_public_bookable: boolean
          location: string | null
          name: string
          resource_type: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_public_bookable?: boolean
          location?: string | null
          name: string
          resource_type: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_public_bookable?: boolean
          location?: string | null
          name?: string
          resource_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_accounts: {
        Row: {
          blocked: boolean
          created_at: string
          credit_limit: number | null
          current_balance: number
          customer_id: string
          debtor_number: string | null
          id: string
          last_payment_at: string | null
          last_reminder_at: string | null
          notes: string | null
          overdue_balance: number
          payment_terms: string | null
          reminder_level: number
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          credit_limit?: number | null
          current_balance?: number
          customer_id: string
          debtor_number?: string | null
          id?: string
          last_payment_at?: string | null
          last_reminder_at?: string | null
          notes?: string | null
          overdue_balance?: number
          payment_terms?: string | null
          reminder_level?: number
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          credit_limit?: number | null
          current_balance?: number
          customer_id?: string
          debtor_number?: string | null
          id?: string
          last_payment_at?: string | null
          last_reminder_at?: string | null
          notes?: string | null
          overdue_balance?: number
          payment_terms?: string | null
          reminder_level?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_ai_insights: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          meta: Json | null
          model: string | null
          period_end: string | null
          period_start: string | null
          prompt: string | null
          prompt_hash: string | null
          response: string
          scope: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json | null
          model?: string | null
          period_end?: string | null
          period_start?: string | null
          prompt?: string | null
          prompt_hash?: string | null
          response: string
          scope: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          meta?: Json | null
          model?: string | null
          period_end?: string | null
          period_start?: string | null
          prompt?: string | null
          prompt_hash?: string | null
          response?: string
          scope?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_ai_insights_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_anomalies: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string
          description: string | null
          detected_at: string
          id: string
          meta: Json | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          source_id: string | null
          source_type: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          detected_at?: string
          id?: string
          meta?: Json | null
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source_id?: string | null
          source_type: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          detected_at?: string
          id?: string
          meta?: Json | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source_id?: string | null
          source_type?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_anomalies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_approvals: {
        Row: {
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          comment: string | null
          created_at: string
          currency: string | null
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          rejection_reason: string | null
          requested_by: string | null
          requires_dual_approval: boolean
          second_approved_at: string | null
          second_approver_id: string | null
          status: string
          tenant_id: string | null
          threshold_amount: number | null
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          comment?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          rejection_reason?: string | null
          requested_by?: string | null
          requires_dual_approval?: boolean
          second_approved_at?: string | null
          second_approver_id?: string | null
          status?: string
          tenant_id?: string | null
          threshold_amount?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          comment?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          rejection_reason?: string | null
          requested_by?: string | null
          requires_dual_approval?: boolean
          second_approved_at?: string | null
          second_approver_id?: string | null
          status?: string
          tenant_id?: string | null
          threshold_amount?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_asset_depreciations: {
        Row: {
          amount: number
          asset_id: string
          book_value_after: number
          created_at: string
          created_by: string | null
          datev_account: string | null
          finance_transaction_id: string | null
          id: string
          is_posted: boolean
          method: string
          period: string
          posted_at: string | null
          posting_text: string | null
        }
        Insert: {
          amount: number
          asset_id: string
          book_value_after?: number
          created_at?: string
          created_by?: string | null
          datev_account?: string | null
          finance_transaction_id?: string | null
          id?: string
          is_posted?: boolean
          method: string
          period: string
          posted_at?: string | null
          posting_text?: string | null
        }
        Update: {
          amount?: number
          asset_id?: string
          book_value_after?: number
          created_at?: string
          created_by?: string | null
          datev_account?: string | null
          finance_transaction_id?: string | null
          id?: string
          is_posted?: boolean
          method?: string
          period?: string
          posted_at?: string | null
          posting_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_asset_depreciations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "finance_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_asset_depreciations_finance_transaction_id_fkey"
            columns: ["finance_transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_assets: {
        Row: {
          accumulated_depreciation: number
          acquisition_date: string
          acquisition_value: number
          book_value: number
          category: string
          created_at: string
          created_by: string | null
          datev_account: string | null
          degressive_rate: number | null
          depreciation_method: string
          description: string | null
          disposal_date: string | null
          disposal_reason: string | null
          disposal_value: number | null
          document_id: string | null
          id: string
          incoming_invoice_id: string | null
          inventory_number: string | null
          location: string | null
          meta: Json | null
          name: string
          notes: string | null
          status: string
          supplier_id: string | null
          supplier_name: string | null
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          useful_life_months: number
        }
        Insert: {
          accumulated_depreciation?: number
          acquisition_date: string
          acquisition_value: number
          book_value?: number
          category?: string
          created_at?: string
          created_by?: string | null
          datev_account?: string | null
          degressive_rate?: number | null
          depreciation_method?: string
          description?: string | null
          disposal_date?: string | null
          disposal_reason?: string | null
          disposal_value?: number | null
          document_id?: string | null
          id?: string
          incoming_invoice_id?: string | null
          inventory_number?: string | null
          location?: string | null
          meta?: Json | null
          name: string
          notes?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          useful_life_months?: number
        }
        Update: {
          accumulated_depreciation?: number
          acquisition_date?: string
          acquisition_value?: number
          book_value?: number
          category?: string
          created_at?: string
          created_by?: string | null
          datev_account?: string | null
          degressive_rate?: number | null
          depreciation_method?: string
          description?: string | null
          disposal_date?: string | null
          disposal_reason?: string | null
          disposal_value?: number | null
          document_id?: string | null
          id?: string
          incoming_invoice_id?: string | null
          inventory_number?: string | null
          location?: string | null
          meta?: Json | null
          name?: string
          notes?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          useful_life_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_assets_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "finance_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_assets_incoming_invoice_id_fkey"
            columns: ["incoming_invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_incoming_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_audit_trail: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_table: string
          id: string
          ip_address: string | null
          module: string
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_table: string
          id?: string
          ip_address?: string | null
          module: string
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_table?: string
          id?: string
          ip_address?: string | null
          module?: string
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      finance_automation_runs: {
        Row: {
          automation_id: string | null
          executed_at: string
          id: string
          message: string | null
          payload: Json | null
          status: string
          target_entity: string | null
          target_id: string | null
          trigger_event: string
        }
        Insert: {
          automation_id?: string | null
          executed_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          status?: string
          target_entity?: string | null
          target_id?: string | null
          trigger_event: string
        }
        Update: {
          automation_id?: string | null
          executed_at?: string
          id?: string
          message?: string | null
          payload?: Json | null
          status?: string
          target_entity?: string | null
          target_id?: string | null
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "finance_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_automations: {
        Row: {
          action_config: Json
          action_type: string
          active: boolean
          condition_json: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          last_run_at: string | null
          name: string
          tenant_id: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          active?: boolean
          condition_json?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          tenant_id?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          active?: boolean
          condition_json?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          tenant_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bank_accounts: {
        Row: {
          account_name: string
          available_balance: number | null
          bank_name: string | null
          bic: string | null
          created_at: string
          currency: string
          current_balance: number | null
          iban: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          notes: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          available_balance?: number | null
          bank_name?: string | null
          bic?: string | null
          created_at?: string
          currency?: string
          current_balance?: number | null
          iban?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          notes?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          available_balance?: number | null
          bank_name?: string | null
          bic?: string | null
          created_at?: string
          currency?: string
          current_balance?: number | null
          iban?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          notes?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bank_lines: {
        Row: {
          amount: number
          booking_date: string | null
          counterparty_iban: string | null
          counterparty_name: string | null
          created_at: string
          currency: string | null
          end_to_end_id: string | null
          id: string
          line_hash: string | null
          match_confidence: number | null
          match_method: string | null
          matched_at: string | null
          matched_by: string | null
          matched_customer_id: string | null
          matched_transaction_id: string | null
          purpose: string | null
          statement_id: string
          status: string
          updated_at: string
          value_date: string | null
        }
        Insert: {
          amount: number
          booking_date?: string | null
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          end_to_end_id?: string | null
          id?: string
          line_hash?: string | null
          match_confidence?: number | null
          match_method?: string | null
          matched_at?: string | null
          matched_by?: string | null
          matched_customer_id?: string | null
          matched_transaction_id?: string | null
          purpose?: string | null
          statement_id: string
          status?: string
          updated_at?: string
          value_date?: string | null
        }
        Update: {
          amount?: number
          booking_date?: string | null
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          end_to_end_id?: string | null
          id?: string
          line_hash?: string | null
          match_confidence?: number | null
          match_method?: string | null
          matched_at?: string | null
          matched_by?: string | null
          matched_customer_id?: string | null
          matched_transaction_id?: string | null
          purpose?: string | null
          statement_id?: string
          status?: string
          updated_at?: string
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_bank_lines_matched_customer_id_fkey"
            columns: ["matched_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_bank_lines_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_bank_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bank_postings: {
        Row: {
          amount: number
          bank_account_id: string | null
          counterparty: string | null
          created_at: string
          currency: string
          customer_id: string | null
          iban: string | null
          id: string
          invoice_id: string | null
          posting_date: string
          posting_type: string
          purpose: string | null
          reference: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          user_id: string | null
          value_date: string | null
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          counterparty?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          iban?: string | null
          id?: string
          invoice_id?: string | null
          posting_date?: string
          posting_type: string
          purpose?: string | null
          reference?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
          value_date?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          counterparty?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          iban?: string | null
          id?: string
          invoice_id?: string | null
          posting_date?: string
          posting_type?: string
          purpose?: string | null
          reference?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
          value_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_bank_postings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_bank_postings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bank_statements: {
        Row: {
          account_name: string | null
          closing_balance: number | null
          created_at: string
          currency: string | null
          file_hash: string | null
          filename: string | null
          format: string
          iban: string | null
          id: string
          line_count: number
          matched_count: number
          opening_balance: number | null
          period_from: string | null
          period_to: string | null
          uploaded_by: string | null
        }
        Insert: {
          account_name?: string | null
          closing_balance?: number | null
          created_at?: string
          currency?: string | null
          file_hash?: string | null
          filename?: string | null
          format: string
          iban?: string | null
          id?: string
          line_count?: number
          matched_count?: number
          opening_balance?: number | null
          period_from?: string | null
          period_to?: string | null
          uploaded_by?: string | null
        }
        Update: {
          account_name?: string | null
          closing_balance?: number | null
          created_at?: string
          currency?: string | null
          file_hash?: string | null
          filename?: string | null
          format?: string
          iban?: string | null
          id?: string
          line_count?: number
          matched_count?: number
          opening_balance?: number | null
          period_from?: string | null
          period_to?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      finance_budgets: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          fiscal_year: number
          id: string
          month: number
          notes: string | null
          planned_amount: number
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          fiscal_year: number
          id?: string
          month: number
          notes?: string | null
          planned_amount?: number
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          fiscal_year?: number
          id?: string
          month?: number
          notes?: string | null
          planned_amount?: number
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_cashbook: {
        Row: {
          amount_gross: number
          amount_net: number
          amount_vat: number
          attachment_path: string | null
          booking_date: string
          booking_number: string | null
          booking_time: string
          booking_type: string
          cost_center: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          document_number: string | null
          id: string
          payment_method: string
          reference: string | null
          reverses_id: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          user_id: string | null
          vat_rate: number
        }
        Insert: {
          amount_gross?: number
          amount_net?: number
          amount_vat?: number
          attachment_path?: string | null
          booking_date?: string
          booking_number?: string | null
          booking_time?: string
          booking_type: string
          cost_center?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          document_number?: string | null
          id?: string
          payment_method?: string
          reference?: string | null
          reverses_id?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
          vat_rate?: number
        }
        Update: {
          amount_gross?: number
          amount_net?: number
          amount_vat?: number
          attachment_path?: string | null
          booking_date?: string
          booking_number?: string | null
          booking_time?: string
          booking_type?: string
          cost_center?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          document_number?: string | null
          id?: string
          payment_method?: string
          reference?: string | null
          reverses_id?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_cashbook_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_cashbook_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "finance_cashbook"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_cashbook_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_cashbook_closures: {
        Row: {
          calculated_balance: number
          closure_date: string
          closure_number: string | null
          counted_balance: number
          created_at: string
          difference: number
          id: string
          note: string | null
          opening_balance: number
          released_at: string | null
          released_by: string | null
          signature_data: string | null
          signed_at: string | null
          signed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          calculated_balance?: number
          closure_date: string
          closure_number?: string | null
          counted_balance?: number
          created_at?: string
          difference?: number
          id?: string
          note?: string | null
          opening_balance?: number
          released_at?: string | null
          released_by?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          calculated_balance?: number
          closure_date?: string
          closure_number?: string | null
          counted_balance?: number
          created_at?: string
          difference?: number
          id?: string
          note?: string | null
          opening_balance?: number
          released_at?: string | null
          released_by?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_cashflow_items: {
        Row: {
          actual_amount: number
          category: string
          created_at: string
          description: string | null
          flow_type: string
          id: string
          meta: Json | null
          month: string
          origin_ref: string | null
          plan_id: string
          planned_amount: number
          source: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          category: string
          created_at?: string
          description?: string | null
          flow_type: string
          id?: string
          meta?: Json | null
          month: string
          origin_ref?: string | null
          plan_id: string
          planned_amount?: number
          source?: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          category?: string
          created_at?: string
          description?: string | null
          flow_type?: string
          id?: string
          meta?: Json | null
          month?: string
          origin_ref?: string | null
          plan_id?: string
          planned_amount?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_cashflow_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "finance_cashflow_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_cashflow_plans: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          opening_balance: number
          period_end: string
          period_start: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          opening_balance?: number
          period_end: string
          period_start: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          opening_balance?: number
          period_end?: string
          period_start?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_cashflow_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_consolidation_items: {
        Row: {
          account_code: string | null
          account_label: string | null
          consolidated_amount: number
          created_at: string
          currency: string
          eliminated_amount: number
          gross_amount: number
          id: string
          run_id: string
          tenant_id: string | null
          transaction_type: string | null
        }
        Insert: {
          account_code?: string | null
          account_label?: string | null
          consolidated_amount?: number
          created_at?: string
          currency?: string
          eliminated_amount?: number
          gross_amount?: number
          id?: string
          run_id: string
          tenant_id?: string | null
          transaction_type?: string | null
        }
        Update: {
          account_code?: string | null
          account_label?: string | null
          consolidated_amount?: number
          created_at?: string
          currency?: string
          eliminated_amount?: number
          gross_amount?: number
          id?: string
          run_id?: string
          tenant_id?: string | null
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_consolidation_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "finance_consolidation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_consolidation_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_consolidation_runs: {
        Row: {
          consolidated_total: number
          created_at: string
          eliminated_total: number
          gross_total: number
          id: string
          notes: string | null
          period_month: string
          prepared_by: string | null
          status: string
          tenant_count: number
          totals: Json
          updated_at: string
        }
        Insert: {
          consolidated_total?: number
          created_at?: string
          eliminated_total?: number
          gross_total?: number
          id?: string
          notes?: string | null
          period_month: string
          prepared_by?: string | null
          status?: string
          tenant_count?: number
          totals?: Json
          updated_at?: string
        }
        Update: {
          consolidated_total?: number
          created_at?: string
          eliminated_total?: number
          gross_total?: number
          id?: string
          notes?: string | null
          period_month?: string
          prepared_by?: string | null
          status?: string
          tenant_count?: number
          totals?: Json
          updated_at?: string
        }
        Relationships: []
      }
      finance_contracts: {
        Row: {
          contract_number: string | null
          contract_type: string
          created_at: string
          customer_id: string
          device_id: string | null
          end_date: string | null
          id: string
          monthly_rate: number | null
          notes: string | null
          order_id: string | null
          remaining_amount: number | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contract_number?: string | null
          contract_type?: string
          created_at?: string
          customer_id: string
          device_id?: string | null
          end_date?: string | null
          id?: string
          monthly_rate?: number | null
          notes?: string | null
          order_id?: string | null
          remaining_amount?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contract_number?: string | null
          contract_type?: string
          created_at?: string
          customer_id?: string
          device_id?: string | null
          end_date?: string | null
          id?: string
          monthly_rate?: number | null
          notes?: string | null
          order_id?: string | null
          remaining_amount?: number | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_contracts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "lager_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_contracts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_deposit_bookings: {
        Row: {
          booked_by: string | null
          booking_date: string
          created_at: string
          deposit_id: string
          id: string
          note: string | null
          paid_amount: number
          payment_method: string
          payment_reference: string | null
          proof_file_path: string | null
        }
        Insert: {
          booked_by?: string | null
          booking_date?: string
          created_at?: string
          deposit_id: string
          id?: string
          note?: string | null
          paid_amount: number
          payment_method: string
          payment_reference?: string | null
          proof_file_path?: string | null
        }
        Update: {
          booked_by?: string | null
          booking_date?: string
          created_at?: string
          deposit_id?: string
          id?: string
          note?: string | null
          paid_amount?: number
          payment_method?: string
          payment_reference?: string | null
          proof_file_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_deposit_bookings_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "finance_deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_deposit_history: {
        Row: {
          action: string
          created_at: string
          deposit_id: string
          id: string
          meta: Json | null
          new_release_status: string | null
          new_status: string | null
          note: string | null
          old_release_status: string | null
          old_status: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          deposit_id: string
          id?: string
          meta?: Json | null
          new_release_status?: string | null
          new_status?: string | null
          note?: string | null
          old_release_status?: string | null
          old_status?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          deposit_id?: string
          id?: string
          meta?: Json | null
          new_release_status?: string | null
          new_status?: string | null
          note?: string | null
          old_release_status?: string | null
          old_status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_deposit_history_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "finance_deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_deposit_notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          deposit_id: string
          error: string | null
          id: string
          meta: Json | null
          recipient: string | null
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          deposit_id: string
          error?: string | null
          id?: string
          meta?: Json | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          deposit_id?: string
          error?: string | null
          id?: string
          meta?: Json | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_deposit_notifications_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "finance_deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_deposits: {
        Row: {
          company_name: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          deposit_number: string | null
          due_date: string | null
          finance_lock: boolean
          gross_amount: number
          id: string
          invoice_id: string | null
          invoice_number: string | null
          issue_date: string | null
          meta: Json | null
          net_amount: number
          note: string | null
          offer_id: string | null
          offer_number: string | null
          open_amount: number | null
          order_id: string | null
          order_number: string | null
          paid_amount: number
          release_status: string
          released_at: string | null
          released_by: string | null
          responsible_user_id: string | null
          source: string
          source_ref: string | null
          status: string
          updated_at: string
          updated_by: string | null
          vat_amount: number
        }
        Insert: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          deposit_number?: string | null
          due_date?: string | null
          finance_lock?: boolean
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          issue_date?: string | null
          meta?: Json | null
          net_amount?: number
          note?: string | null
          offer_id?: string | null
          offer_number?: string | null
          open_amount?: number | null
          order_id?: string | null
          order_number?: string | null
          paid_amount?: number
          release_status?: string
          released_at?: string | null
          released_by?: string | null
          responsible_user_id?: string | null
          source: string
          source_ref?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number
        }
        Update: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          deposit_number?: string | null
          due_date?: string | null
          finance_lock?: boolean
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          issue_date?: string | null
          meta?: Json | null
          net_amount?: number
          note?: string | null
          offer_id?: string | null
          offer_number?: string | null
          open_amount?: number | null
          order_id?: string | null
          order_number?: string | null
          paid_amount?: number
          release_status?: string
          released_at?: string | null
          released_by?: string | null
          responsible_user_id?: string | null
          source?: string
          source_ref?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number
        }
        Relationships: []
      }
      finance_documents: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          document_date: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          hash_sha256: string | null
          id: string
          meta: Json | null
          mime_type: string | null
          reference: string | null
          retention_until: string
          source_system: string | null
          supplier_id: string | null
          tenant_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          document_date?: string
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          hash_sha256?: string | null
          id?: string
          meta?: Json | null
          mime_type?: string | null
          reference?: string | null
          retention_until?: string
          source_system?: string | null
          supplier_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          document_date?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          hash_sha256?: string | null
          id?: string
          meta?: Json | null
          mime_type?: string | null
          reference?: string | null
          retention_until?: string
          source_system?: string | null
          supplier_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_forecasts: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          forecast_amount: number
          id: string
          notes: string | null
          period_date: string
          scenario: string
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          forecast_amount?: number
          id?: string
          notes?: string | null
          period_date: string
          scenario?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          forecast_amount?: number
          id?: string
          notes?: string | null
          period_date?: string
          scenario?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_forecasts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_fx_rates: {
        Row: {
          created_at: string
          currency: string
          id: string
          rate_date: string
          rate_to_eur: number
          source: string | null
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          rate_date: string
          rate_to_eur: number
          source?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          rate_date?: string
          rate_to_eur?: number
          source?: string | null
        }
        Relationships: []
      }
      finance_goods_receipts: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          po_id: string
          po_item_id: string | null
          quantity: number
          received_at: string
          received_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          po_id: string
          po_item_id?: string | null
          quantity?: number
          received_at?: string
          received_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          po_id?: string
          po_item_id?: string | null
          quantity?: number
          received_at?: string
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_goods_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "finance_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_goods_receipts_po_item_id_fkey"
            columns: ["po_item_id"]
            isOneToOne: false
            referencedRelation: "finance_purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_history: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      finance_incoming_invoices: {
        Row: {
          amount_gross: number
          amount_net: number | null
          amount_tax: number | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          due_date: string | null
          einvoice_format: string | null
          file_path: string | null
          id: string
          internal_number: string
          invoice_date: string
          invoice_number: string
          is_einvoice: boolean
          notes: string | null
          paid_at: string | null
          parsed_data: Json | null
          payment_reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          supplier_iban: string | null
          supplier_id: string | null
          supplier_name: string
          supplier_vat_id: string | null
          tax_rate: number | null
          tenant_id: string | null
          updated_at: string
          xml_path: string | null
        }
        Insert: {
          amount_gross: number
          amount_net?: number | null
          amount_tax?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          einvoice_format?: string | null
          file_path?: string | null
          id?: string
          internal_number: string
          invoice_date: string
          invoice_number: string
          is_einvoice?: boolean
          notes?: string | null
          paid_at?: string | null
          parsed_data?: Json | null
          payment_reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supplier_iban?: string | null
          supplier_id?: string | null
          supplier_name: string
          supplier_vat_id?: string | null
          tax_rate?: number | null
          tenant_id?: string | null
          updated_at?: string
          xml_path?: string | null
        }
        Update: {
          amount_gross?: number
          amount_net?: number | null
          amount_tax?: number | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          einvoice_format?: string | null
          file_path?: string | null
          id?: string
          internal_number?: string
          invoice_date?: string
          invoice_number?: string
          is_einvoice?: boolean
          notes?: string | null
          paid_at?: string | null
          parsed_data?: Json | null
          payment_reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supplier_iban?: string | null
          supplier_id?: string | null
          supplier_name?: string
          supplier_vat_id?: string | null
          tax_rate?: number | null
          tenant_id?: string | null
          updated_at?: string
          xml_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_incoming_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_incoming_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_intercompany_matches: {
        Row: {
          amount: number
          currency: string
          id: string
          matched_at: string
          matched_by: string | null
          notes: string | null
          period_month: string | null
          source_tenant_id: string | null
          source_tx_id: string
          status: string
          target_tenant_id: string | null
          target_tx_id: string
        }
        Insert: {
          amount?: number
          currency?: string
          id?: string
          matched_at?: string
          matched_by?: string | null
          notes?: string | null
          period_month?: string | null
          source_tenant_id?: string | null
          source_tx_id: string
          status?: string
          target_tenant_id?: string | null
          target_tx_id: string
        }
        Update: {
          amount?: number
          currency?: string
          id?: string
          matched_at?: string
          matched_by?: string | null
          notes?: string | null
          period_month?: string | null
          source_tenant_id?: string | null
          source_tx_id?: string
          status?: string
          target_tenant_id?: string | null
          target_tx_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_intercompany_matches_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_intercompany_matches_source_tx_id_fkey"
            columns: ["source_tx_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_intercompany_matches_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_intercompany_matches_target_tx_id_fkey"
            columns: ["target_tx_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_intercompany_relations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string | null
          notes: string | null
          source_tenant_id: string
          target_tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          source_tenant_id: string
          target_tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          source_tenant_id?: string
          target_tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_intercompany_relations_source_tenant_id_fkey"
            columns: ["source_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_intercompany_relations_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_journal: {
        Row: {
          account: string | null
          amount_gross: number | null
          amount_net: number | null
          amount_vat: number | null
          booking_date: string
          booking_time: string
          contra_account: string | null
          corrects_journal_id: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          document_number: string | null
          id: string
          invoice_number: string | null
          journal_number: string | null
          order_number: string | null
          payment_method: string | null
          reference: string | null
          source_id: string | null
          source_module: string
          source_table: string | null
          status: string
          supplier_id: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string | null
          vorgang: string | null
        }
        Insert: {
          account?: string | null
          amount_gross?: number | null
          amount_net?: number | null
          amount_vat?: number | null
          booking_date?: string
          booking_time?: string
          contra_account?: string | null
          corrects_journal_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          document_number?: string | null
          id?: string
          invoice_number?: string | null
          journal_number?: string | null
          order_number?: string | null
          payment_method?: string | null
          reference?: string | null
          source_id?: string | null
          source_module: string
          source_table?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
          vorgang?: string | null
        }
        Update: {
          account?: string | null
          amount_gross?: number | null
          amount_net?: number | null
          amount_vat?: number | null
          booking_date?: string
          booking_time?: string
          contra_account?: string | null
          corrects_journal_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          document_number?: string | null
          id?: string
          invoice_number?: string | null
          journal_number?: string | null
          order_number?: string | null
          payment_method?: string | null
          reference?: string | null
          source_id?: string | null
          source_module?: string
          source_table?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string | null
          vorgang?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_journal_corrects_journal_id_fkey"
            columns: ["corrects_journal_id"]
            isOneToOne: false
            referencedRelation: "finance_journal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_journal_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_journal_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_liquidity_entries: {
        Row: {
          bank_account_id: string | null
          closing_balance: number | null
          created_at: string
          currency: string
          entry_date: string
          expected_inflow: number | null
          expected_outflow: number | null
          id: string
          notes: string | null
          opening_balance: number | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          closing_balance?: number | null
          created_at?: string
          currency?: string
          entry_date: string
          expected_inflow?: number | null
          expected_outflow?: number | null
          id?: string
          notes?: string | null
          opening_balance?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          closing_balance?: number | null
          created_at?: string
          currency?: string
          entry_date?: string
          expected_inflow?: number | null
          expected_outflow?: number | null
          id?: string
          notes?: string | null
          opening_balance?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_liquidity_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_liquidity_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_management_packs: {
        Row: {
          created_at: string
          created_by: string | null
          generated_at: string | null
          id: string
          name: string
          pdf_url: string | null
          period_end: string
          period_start: string
          sections: Json
          sent_at: string | null
          sent_to: Json
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          generated_at?: string | null
          id?: string
          name: string
          pdf_url?: string | null
          period_end: string
          period_start: string
          sections?: Json
          sent_at?: string | null
          sent_to?: Json
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          generated_at?: string | null
          id?: string
          name?: string
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          sections?: Json
          sent_at?: string | null
          sent_to?: Json
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_management_packs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payment_approvals: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bank_account_id: string | null
          created_at: string
          currency: string
          due_date: string | null
          id: string
          paid_at: string | null
          payee_iban: string | null
          payee_name: string
          purpose: string | null
          reference: string | null
          rejection_reason: string | null
          requested_by: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payee_iban?: string | null
          payee_name: string
          purpose?: string | null
          reference?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payee_iban?: string | null
          payee_name?: string
          purpose?: string | null
          reference?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payment_approvals_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "finance_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payment_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_purchase_order_items: {
        Row: {
          account_code: string | null
          created_at: string
          description: string
          id: string
          po_id: string
          quantity: number
          received_quantity: number
          total_amount: number | null
          unit_price: number
        }
        Insert: {
          account_code?: string | null
          created_at?: string
          description: string
          id?: string
          po_id: string
          quantity?: number
          received_quantity?: number
          total_amount?: number | null
          unit_price?: number
        }
        Update: {
          account_code?: string | null
          created_at?: string
          description?: string
          id?: string
          po_id?: string
          quantity?: number
          received_quantity?: number
          total_amount?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "finance_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_purchase_orders: {
        Row: {
          created_at: string
          currency: string
          expected_delivery: string | null
          id: string
          notes: string | null
          ordered_at: string | null
          po_number: string | null
          requisition_id: string | null
          status: string
          supplier_id: string | null
          tenant_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          po_number?: string | null
          requisition_id?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          po_number?: string | null
          requisition_id?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_purchase_orders_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "finance_purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_purchase_requisition_items: {
        Row: {
          account_code: string | null
          created_at: string
          description: string
          id: string
          quantity: number
          requisition_id: string
          total_amount: number | null
          unit_price: number
        }
        Insert: {
          account_code?: string | null
          created_at?: string
          description: string
          id?: string
          quantity?: number
          requisition_id: string
          total_amount?: number | null
          unit_price?: number
        }
        Update: {
          account_code?: string | null
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          requisition_id?: string
          total_amount?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_purchase_requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "finance_purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_purchase_requisitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          id: string
          needed_by: string | null
          notes: string | null
          requester_id: string | null
          requisition_number: string | null
          status: string
          supplier_id: string | null
          tenant_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          needed_by?: string | null
          notes?: string | null
          requester_id?: string | null
          requisition_number?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          needed_by?: string | null
          notes?: string | null
          requester_id?: string | null
          requisition_number?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_purchase_requisitions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_purchase_requisitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      finance_reminder_items: {
        Row: {
          amount: number
          created_at: string
          days_overdue: number | null
          due_date: string | null
          id: string
          invoice_number: string | null
          reminder_id: string
          transaction_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          days_overdue?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          reminder_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          days_overdue?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          reminder_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_reminder_items_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "finance_reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_reminder_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_reminders: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          customer_name: string | null
          due_date: string | null
          email_message_id: string | null
          fee: number
          id: string
          interest: number
          level: number
          notes: string | null
          pdf_url: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_id: string
          customer_name?: string | null
          due_date?: string | null
          email_message_id?: string | null
          fee?: number
          id?: string
          interest?: number
          level: number
          notes?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          customer_name?: string | null
          due_date?: string | null
          email_message_id?: string | null
          fee?: number
          id?: string
          interest?: number
          level?: number
          notes?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_report_schedules: {
        Row: {
          created_at: string
          created_by: string | null
          cron_expression: string
          enabled: boolean
          id: string
          last_run_at: string | null
          last_status: string | null
          name: string
          next_run_at: string | null
          output_format: string
          recipients: Json
          report_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cron_expression: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_status?: string | null
          name: string
          next_run_at?: string | null
          output_format?: string
          recipients?: Json
          report_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cron_expression?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          next_run_at?: string | null
          output_format?: string
          recipients?: Json
          report_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_report_schedules_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "finance_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_report_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_reports: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          dimensions: Json
          filters: Json
          id: string
          is_shared: boolean
          metrics: Json
          name: string
          report_type: string
          tenant_id: string | null
          updated_at: string
          visualization: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          dimensions?: Json
          filters?: Json
          id?: string
          is_shared?: boolean
          metrics?: Json
          name: string
          report_type?: string
          tenant_id?: string | null
          updated_at?: string
          visualization?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          dimensions?: Json
          filters?: Json
          id?: string
          is_shared?: boolean
          metrics?: Json
          name?: string
          report_type?: string
          tenant_id?: string | null
          updated_at?: string
          visualization?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_sepa_mandates: {
        Row: {
          account_holder: string | null
          bic: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          iban: string
          id: string
          last_used_at: string | null
          mandate_reference: string
          notes: string | null
          scheme: string
          sequence_type: string
          signed_at: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          bic?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          iban: string
          id?: string
          last_used_at?: string | null
          mandate_reference: string
          notes?: string | null
          scheme?: string
          sequence_type?: string
          signed_at: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          bic?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          iban?: string
          id?: string
          last_used_at?: string | null
          mandate_reference?: string
          notes?: string | null
          scheme?: string
          sequence_type?: string
          signed_at?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_sepa_mandates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_sepa_mandates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_sepa_run_items: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          end_to_end_id: string | null
          id: string
          mandate_id: string
          reference: string | null
          remittance_info: string | null
          run_id: string
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          end_to_end_id?: string | null
          id?: string
          mandate_id: string
          reference?: string | null
          remittance_info?: string | null
          run_id: string
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          end_to_end_id?: string | null
          id?: string
          mandate_id?: string
          reference?: string | null
          remittance_info?: string | null
          run_id?: string
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_sepa_run_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_sepa_run_items_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "finance_sepa_mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_sepa_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "finance_sepa_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_sepa_run_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_sepa_runs: {
        Row: {
          collection_date: string
          created_at: string
          created_by: string | null
          creditor_bic: string | null
          creditor_iban: string
          creditor_id: string
          creditor_name: string
          execution_date: string
          exported_at: string | null
          id: string
          item_count: number
          notes: string | null
          run_number: string
          source_system: string | null
          status: string
          tenant_id: string | null
          total_amount: number
          updated_at: string
          xml_path: string | null
        }
        Insert: {
          collection_date: string
          created_at?: string
          created_by?: string | null
          creditor_bic?: string | null
          creditor_iban: string
          creditor_id: string
          creditor_name: string
          execution_date: string
          exported_at?: string | null
          id?: string
          item_count?: number
          notes?: string | null
          run_number: string
          source_system?: string | null
          status?: string
          tenant_id?: string | null
          total_amount?: number
          updated_at?: string
          xml_path?: string | null
        }
        Update: {
          collection_date?: string
          created_at?: string
          created_by?: string | null
          creditor_bic?: string | null
          creditor_iban?: string
          creditor_id?: string
          creditor_name?: string
          execution_date?: string
          exported_at?: string | null
          id?: string
          item_count?: number
          notes?: string | null
          run_number?: string
          source_system?: string | null
          status?: string
          tenant_id?: string | null
          total_amount?: number
          updated_at?: string
          xml_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_sepa_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_stakeholder_access_logs: {
        Row: {
          accessed_at: string
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          stakeholder_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          stakeholder_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          stakeholder_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_stakeholder_access_logs_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "finance_stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_stakeholders: {
        Row: {
          access_count: number
          access_token_hash: string
          allowed_reports: Json
          created_at: string
          created_by: string | null
          email: string
          enabled: boolean
          expires_at: string | null
          id: string
          last_access_at: string | null
          name: string
          role: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          access_count?: number
          access_token_hash: string
          allowed_reports?: Json
          created_at?: string
          created_by?: string | null
          email: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          last_access_at?: string | null
          name: string
          role?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          access_count?: number
          access_token_hash?: string
          allowed_reports?: Json
          created_at?: string
          created_by?: string | null
          email?: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          last_access_at?: string | null
          name?: string
          role?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_stakeholders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_tax_filing_lines: {
        Row: {
          amount: number
          base_amount: number | null
          country_code: string | null
          created_at: string
          filing_id: string
          id: string
          line_code: string
          line_label: string | null
          meta: Json | null
          tax_rate: number | null
          vat_id: string | null
        }
        Insert: {
          amount?: number
          base_amount?: number | null
          country_code?: string | null
          created_at?: string
          filing_id: string
          id?: string
          line_code: string
          line_label?: string | null
          meta?: Json | null
          tax_rate?: number | null
          vat_id?: string | null
        }
        Update: {
          amount?: number
          base_amount?: number | null
          country_code?: string | null
          created_at?: string
          filing_id?: string
          id?: string
          line_code?: string
          line_label?: string | null
          meta?: Json | null
          tax_rate?: number | null
          vat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_tax_filing_lines_filing_id_fkey"
            columns: ["filing_id"]
            isOneToOne: false
            referencedRelation: "finance_tax_filings"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_tax_filings: {
        Row: {
          created_at: string
          currency: string
          export_content: string | null
          export_format: string | null
          filing_type: string
          id: string
          notes: string | null
          payload: Json | null
          period_value: string
          period_year: number
          prepared_at: string | null
          prepared_by: string | null
          status: string
          submitted_at: string | null
          tenant_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          export_content?: string | null
          export_format?: string | null
          filing_type: string
          id?: string
          notes?: string | null
          payload?: Json | null
          period_value: string
          period_year: number
          prepared_at?: string | null
          prepared_by?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          export_content?: string | null
          export_format?: string | null
          filing_type?: string
          id?: string
          notes?: string | null
          payload?: Json | null
          period_value?: string
          period_year?: number
          prepared_at?: string | null
          prepared_by?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_tax_filings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_three_way_matches: {
        Row: {
          created_at: string
          currency: string
          id: string
          invoice_id: string | null
          invoiced_amount: number | null
          match_status: string
          matched_at: string | null
          matched_by: string | null
          notes: string | null
          po_amount: number | null
          po_id: string | null
          received_amount: number | null
          updated_at: string
          variance_amount: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          invoiced_amount?: number | null
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          notes?: string | null
          po_amount?: number | null
          po_id?: string | null
          received_amount?: number | null
          updated_at?: string
          variance_amount?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          invoiced_amount?: number | null
          match_status?: string
          matched_at?: string | null
          matched_by?: string | null
          notes?: string | null
          po_amount?: number | null
          po_id?: string | null
          received_amount?: number | null
          updated_at?: string
          variance_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_three_way_matches_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_incoming_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_three_way_matches_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "finance_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          amount: number
          booking_date: string
          contract_id: string | null
          counterparty_tenant_id: string | null
          created_at: string
          currency: string
          customer_id: string | null
          device_id: string | null
          id: string
          is_intercompany: boolean
          notes: string | null
          order_id: string | null
          reference: string | null
          tenant_id: string | null
          transaction_type: string
        }
        Insert: {
          amount?: number
          booking_date?: string
          contract_id?: string | null
          counterparty_tenant_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          device_id?: string | null
          id?: string
          is_intercompany?: boolean
          notes?: string | null
          order_id?: string | null
          reference?: string | null
          tenant_id?: string | null
          transaction_type?: string
        }
        Update: {
          amount?: number
          booking_date?: string
          contract_id?: string | null
          counterparty_tenant_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          device_id?: string | null
          id?: string
          is_intercompany?: boolean
          notes?: string | null
          order_id?: string | null
          reference?: string | null
          tenant_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "finance_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_counterparty_tenant_id_fkey"
            columns: ["counterparty_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "lager_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_year_end_runs: {
        Row: {
          checklist: Json
          closed_at: string | null
          closed_by: string | null
          closing_date: string | null
          created_at: string
          created_by: string | null
          fiscal_year: number
          id: string
          notes: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          checklist?: Json
          closed_at?: string | null
          closed_by?: string | null
          closing_date?: string | null
          created_at?: string
          created_by?: string | null
          fiscal_year: number
          id?: string
          notes?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          checklist?: Json
          closed_at?: string | null
          closed_by?: string | null
          closing_date?: string | null
          created_at?: string
          created_by?: string | null
          fiscal_year?: number
          id?: string
          notes?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_year_end_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      integration_logs: {
        Row: {
          created_at: string
          event: string
          external_id: string | null
          id: string
          message: string | null
          payload: Json | null
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          external_id?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          source: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          external_id?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          source?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
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
          delivered_order_id: string | null
          device_status: string | null
          entry_date: string
          finance_block_status: string | null
          finance_contract_number: string | null
          finance_invoice_status: string | null
          finance_open_amount: number | null
          finance_payment_status: string | null
          finance_status: string | null
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
          delivered_order_id?: string | null
          device_status?: string | null
          entry_date?: string
          finance_block_status?: string | null
          finance_contract_number?: string | null
          finance_invoice_status?: string | null
          finance_open_amount?: number | null
          finance_payment_status?: string | null
          finance_status?: string | null
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
          delivered_order_id?: string | null
          device_status?: string | null
          entry_date?: string
          finance_block_status?: string | null
          finance_contract_number?: string | null
          finance_invoice_status?: string | null
          finance_open_amount?: number | null
          finance_payment_status?: string | null
          finance_status?: string | null
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
      number_ranges: {
        Row: {
          active: boolean
          code: string
          created_at: string
          current_value: number
          include_year: boolean
          inherit_case: boolean
          label: string
          last_reset_year: number | null
          notes: string | null
          padding: number
          prefix: string
          reset_yearly: boolean
          separator: string
          start_value: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          current_value?: number
          include_year?: boolean
          inherit_case?: boolean
          label: string
          last_reset_year?: number | null
          notes?: string | null
          padding?: number
          prefix?: string
          reset_yearly?: boolean
          separator?: string
          start_value?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          current_value?: number
          include_year?: boolean
          inherit_case?: boolean
          label?: string
          last_reset_year?: number | null
          notes?: string | null
          padding?: number
          prefix?: string
          reset_yearly?: boolean
          separator?: string
          start_value?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      offer_contact_log: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          customer_id: string | null
          id: string
          offer_number: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          customer_id?: string | null
          id?: string
          offer_number: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          offer_number?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      offer_followup_settings: {
        Row: {
          customer_email_enabled: boolean
          customer_sms_enabled: boolean
          escalation_amount: number
          escalation_days: number
          escalation_role_names: string[]
          id: number
          stage_days: number[]
          updated_at: string
        }
        Insert: {
          customer_email_enabled?: boolean
          customer_sms_enabled?: boolean
          escalation_amount?: number
          escalation_days?: number
          escalation_role_names?: string[]
          id?: number
          stage_days?: number[]
          updated_at?: string
        }
        Update: {
          customer_email_enabled?: boolean
          customer_sms_enabled?: boolean
          escalation_amount?: number
          escalation_days?: number
          escalation_role_names?: string[]
          id?: number
          stage_days?: number[]
          updated_at?: string
        }
        Relationships: []
      }
      offer_followup_tasks: {
        Row: {
          ai_score: number | null
          channel_done: string | null
          created_at: string
          customer_id: string | null
          done_at: string | null
          due_at: string
          id: string
          offer_number: string
          owner_user_id: string | null
          priority: string
          reminder_sent_at: string | null
          stage: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_score?: number | null
          channel_done?: string | null
          created_at?: string
          customer_id?: string | null
          done_at?: string | null
          due_at: string
          id?: string
          offer_number: string
          owner_user_id?: string | null
          priority?: string
          reminder_sent_at?: string | null
          stage: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_score?: number | null
          channel_done?: string | null
          created_at?: string
          customer_id?: string | null
          done_at?: string | null
          due_at?: string
          id?: string
          offer_number?: string
          owner_user_id?: string | null
          priority?: string
          reminder_sent_at?: string | null
          stage?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      offer_outcomes: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          offer_number: string
          outcome: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          offer_number: string
          outcome?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          offer_number?: string
          outcome?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          approval_note: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          case_number: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          offer_date: string | null
          offer_number: string
          payload: Json
          signed_at: string | null
          status: string
          total_gross: number | null
          total_net: number | null
          total_tax: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          case_number?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          offer_date?: string | null
          offer_number: string
          payload?: Json
          signed_at?: string | null
          status?: string
          total_gross?: number | null
          total_net?: number | null
          total_tax?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          approval_note?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          case_number?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          offer_date?: string | null
          offer_number?: string
          payload?: Json
          signed_at?: string | null
          status?: string
          total_gross?: number | null
          total_net?: number | null
          total_tax?: number | null
          updated_at?: string
          valid_until?: string | null
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
          download_token: string | null
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
          download_token?: string | null
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
          download_token?: string | null
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
          az_tax_percentage: number | null
          billing_address: Json | null
          case_number: string | null
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
          finance_deposit_amount: number | null
          finance_open_amount: number | null
          finance_overdue_amount: number | null
          finance_paid_amount: number | null
          finance_payment_status: string | null
          finance_remaining_amount: number | null
          finance_total_amount: number | null
          id: string
          internal_number: string | null
          invoiced_flag: boolean
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
          az_tax_percentage?: number | null
          billing_address?: Json | null
          case_number?: string | null
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
          finance_deposit_amount?: number | null
          finance_open_amount?: number | null
          finance_overdue_amount?: number | null
          finance_paid_amount?: number | null
          finance_payment_status?: string | null
          finance_remaining_amount?: number | null
          finance_total_amount?: number | null
          id?: string
          internal_number?: string | null
          invoiced_flag?: boolean
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
          az_tax_percentage?: number | null
          billing_address?: Json | null
          case_number?: string | null
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
          finance_deposit_amount?: number | null
          finance_open_amount?: number | null
          finance_overdue_amount?: number | null
          finance_paid_amount?: number | null
          finance_payment_status?: string | null
          finance_remaining_amount?: number | null
          finance_total_amount?: number | null
          id?: string
          internal_number?: string | null
          invoiced_flag?: boolean
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
      restore_jobs: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          message: string | null
          requested_by: string | null
          safety_backup_id: string | null
          scope: string
          source_backup_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          message?: string | null
          requested_by?: string | null
          safety_backup_id?: string | null
          scope: string
          source_backup_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          message?: string | null
          requested_by?: string | null
          safety_backup_id?: string | null
          scope?: string
          source_backup_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restore_jobs_safety_backup_id_fkey"
            columns: ["safety_backup_id"]
            isOneToOne: false
            referencedRelation: "backups_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restore_jobs_source_backup_id_fkey"
            columns: ["source_backup_id"]
            isOneToOne: false
            referencedRelation: "backups_metadata"
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
      sales_followups: {
        Row: {
          assigned_user: string | null
          created_at: string
          created_by: string | null
          description: string | null
          done_at: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_user?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          assigned_user?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_lead_history: {
        Row: {
          action: string
          created_at: string
          id: string
          lead_id: string
          note: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          lead_id: string
          note?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          lead_id?: string
          note?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "sales_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_leads: {
        Row: {
          additional_interests: Json | null
          additional_services: Json | null
          ai_priority: string | null
          ai_summary: string | null
          archived: boolean
          assigned_user: string | null
          city: string | null
          company: string | null
          consent_contact: boolean | null
          consent_data: boolean | null
          consultation_type: string | null
          converted_customer_id: string | null
          converted_offer_id: string | null
          country: string | null
          country_code: string | null
          created_at: string
          customer_goal: string | null
          delivery_preference: string | null
          device_category: string | null
          email: string | null
          external_id: string | null
          first_name: string | null
          form_name: string | null
          id: string
          implementation_period: string | null
          interests: Json | null
          last_name: string | null
          lead_number: string | null
          lead_score: number | null
          lead_status: string
          message: string | null
          metadata: Json
          notes: string | null
          phone: string | null
          requested_products: string | null
          score_category: string | null
          service_rating: number | null
          source: string
          street: string | null
          suggested_assignee: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          additional_interests?: Json | null
          additional_services?: Json | null
          ai_priority?: string | null
          ai_summary?: string | null
          archived?: boolean
          assigned_user?: string | null
          city?: string | null
          company?: string | null
          consent_contact?: boolean | null
          consent_data?: boolean | null
          consultation_type?: string | null
          converted_customer_id?: string | null
          converted_offer_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          customer_goal?: string | null
          delivery_preference?: string | null
          device_category?: string | null
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          form_name?: string | null
          id?: string
          implementation_period?: string | null
          interests?: Json | null
          last_name?: string | null
          lead_number?: string | null
          lead_score?: number | null
          lead_status?: string
          message?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          requested_products?: string | null
          score_category?: string | null
          service_rating?: number | null
          source?: string
          street?: string | null
          suggested_assignee?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          additional_interests?: Json | null
          additional_services?: Json | null
          ai_priority?: string | null
          ai_summary?: string | null
          archived?: boolean
          assigned_user?: string | null
          city?: string | null
          company?: string | null
          consent_contact?: boolean | null
          consent_data?: boolean | null
          consultation_type?: string | null
          converted_customer_id?: string | null
          converted_offer_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          customer_goal?: string | null
          delivery_preference?: string | null
          device_category?: string | null
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          form_name?: string | null
          id?: string
          implementation_period?: string | null
          interests?: Json | null
          last_name?: string | null
          lead_number?: string | null
          lead_score?: number | null
          lead_status?: string
          message?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          requested_products?: string | null
          score_category?: string | null
          service_rating?: number | null
          source?: string
          street?: string | null
          suggested_assignee?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      sms_settings: {
        Row: {
          account_sid: string | null
          auth_token: string | null
          from_number: string | null
          id: boolean
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_sid?: string | null
          auth_token?: string | null
          from_number?: string | null
          id?: boolean
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_sid?: string | null
          auth_token?: string | null
          from_number?: string | null
          id?: boolean
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          sort_order: number
          template_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          sort_order?: number
          template_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          sort_order?: number
          template_key?: string
          updated_at?: string
          updated_by?: string | null
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
          subject: string | null
          suggested_technician_id: string | null
          ticket_number: string | null
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
          subject?: string | null
          suggested_technician_id?: string | null
          ticket_number?: string | null
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
          subject?: string | null
          suggested_technician_id?: string | null
          ticket_number?: string | null
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
      as_cases_list_v: {
        Row: {
          assignee_id: string | null
          closed_at: string | null
          created_at: string | null
          currency: string | null
          customer_company: string | null
          customer_contact: string | null
          customer_email: string | null
          customer_id: string | null
          customer_number: string | null
          customer_phone: string | null
          device_id: string | null
          device_model: string | null
          device_serial: string | null
          expected_shipment_date: string | null
          health_score: number | null
          id: string | null
          internal_number: string | null
          is_vip: boolean | null
          last_contact_at: string | null
          next_callback_at: string | null
          order_date: string | null
          order_id: string | null
          order_number: string | null
          order_status: string | null
          priority: Database["public"]["Enums"]["as_priority"] | null
          progress_pct: number | null
          sales_user_name: string | null
          satisfaction_rating: number | null
          status: Database["public"]["Enums"]["as_case_status"] | null
          total_amount: number | null
          traffic_light: Database["public"]["Enums"]["as_traffic_light"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "as_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "as_cases_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "lager_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "as_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
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
      as_force_close_case: {
        Args: { _case_id: string; _reason?: string }
        Returns: {
          assignee_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          customer_id: string | null
          device_id: string | null
          health_score: number | null
          id: string
          last_contact_at: string | null
          metadata: Json
          next_callback_at: string | null
          order_id: string
          priority: Database["public"]["Enums"]["as_priority"]
          progress_pct: number
          sales_user_name: string | null
          satisfaction_note: string | null
          satisfaction_rating: number | null
          status: Database["public"]["Enums"]["as_case_status"]
          tenant_id: string | null
          traffic_light: Database["public"]["Enums"]["as_traffic_light"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "as_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      as_seed_default_checklists: {
        Args: { p_case: string }
        Returns: undefined
      }
      can_access_ai_service: { Args: never; Returns: boolean }
      can_access_finance: { Args: never; Returns: boolean }
      can_access_finance_module: { Args: never; Returns: boolean }
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
      can_manage_backups: { Args: never; Returns: boolean }
      can_manage_copilot_config: { Args: never; Returns: boolean }
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
      can_send_customer_sms: { Args: never; Returns: boolean }
      can_send_whatsapp: { Args: never; Returns: boolean }
      can_upload_factory_invoice: { Args: never; Returns: boolean }
      can_use_alix_sign: { Args: never; Returns: boolean }
      can_view_backups: { Args: never; Returns: boolean }
      can_view_finance_module: { Args: never; Returns: boolean }
      can_view_mail_audit: { Args: never; Returns: boolean }
      cashbook_reverse: {
        Args: { _id: string; _reason?: string }
        Returns: string
      }
      check_rate_limit: {
        Args: { _bucket: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      clear_factory_invoice_pdf: {
        Args: { _production_order_id: string }
        Returns: undefined
      }
      complete_password_setup: { Args: never; Returns: undefined }
      create_finance_stakeholder: {
        Args: {
          p_allowed_reports?: Json
          p_email: string
          p_expires_at?: string
          p_name: string
          p_role: string
        }
        Returns: {
          access_token: string
          id: string
        }[]
      }
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
      esc_generate_token: { Args: never; Returns: string }
      esc_is_admin: { Args: never; Returns: boolean }
      esc_is_department_lead: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      esc_user_department_ids: { Args: { _user_id: string }; Returns: string[] }
      finance_deposit_book: {
        Args: {
          p_amount: number
          p_booking_date?: string
          p_deposit_id: string
          p_method: string
          p_note?: string
          p_proof_path?: string
          p_reference?: string
        }
        Returns: string
      }
      finance_deposit_manual_release: {
        Args: { p_deposit_id: string; p_note?: string }
        Returns: undefined
      }
      finance_deposit_recalc: {
        Args: { _deposit_id: string }
        Returns: undefined
      }
      finance_deposit_set_lock: {
        Args: { p_deposit_id: string; p_lock: boolean; p_note?: string }
        Returns: undefined
      }
      format_document_number: {
        Args: {
          _include_year: boolean
          _padding: number
          _prefix: string
          _separator: string
          _value: number
          _year: number
        }
        Returns: string
      }
      get_current_user_role_names: { Args: never; Returns: string[] }
      get_customer_bank_details: {
        Args: { _customer_id: string }
        Returns: {
          bank_name: string
          bic: string
          iban: string
        }[]
      }
      get_table_columns: { Args: { _table: string }; Returns: string[] }
      has_role: { Args: { check_role: string }; Returns: boolean }
      has_tenant_access: { Args: { _tenant_id: string }; Returns: boolean }
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
      merge_customers: {
        Args: { _duplicate_ids: string[]; _primary_id: string }
        Returns: Json
      }
      next_case_number: { Args: never; Returns: string }
      next_document_number:
        | { Args: { p_code: string }; Returns: string }
        | { Args: { p_case_number: string; p_code: string }; Returns: string }
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
      peek_document_number: { Args: { p_code: string }; Returns: string }
      recompute_device_health: { Args: { _serial: string }; Returns: undefined }
      refresh_warranty_and_maintenance_status: {
        Args: never
        Returns: undefined
      }
      requires_reauth: { Args: never; Returns: boolean }
      resolve_frei_bestellung_assignment: {
        Args: { _order_id: string }
        Returns: undefined
      }
      rotate_finance_stakeholder_token: {
        Args: { p_id: string }
        Returns: string
      }
      session_requires_reauth: { Args: never; Returns: boolean }
      set_factory_invoice_payment_ok: {
        Args: { _ok: boolean; _production_order_id: string }
        Returns: undefined
      }
      set_factory_invoice_pdf: {
        Args: { _path: string; _production_order_id: string }
        Returns: undefined
      }
      set_order_lawyer: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      tenant_id_for_source: { Args: { _source: string }; Returns: string }
      user_has_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      user_mailboxes: { Args: never; Returns: string[] }
    }
    Enums: {
      as_case_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "blocked"
        | "completed"
      as_mediapaket_stage:
        | "not_started"
        | "in_progress"
        | "data_requested"
        | "data_received"
        | "graphics_done"
        | "homepage_done"
        | "social_done"
        | "google_done"
        | "done"
        | "skipped"
      as_priority: "low" | "normal" | "high" | "urgent"
      as_reminder_kind:
        | "login"
        | "app"
        | "nisv"
        | "schulung"
        | "mediapaket"
        | "callback"
        | "custom"
      as_section:
        | "erstkontakt"
        | "geraet"
        | "nisv"
        | "app"
        | "mediapaket"
        | "schulung"
        | "marketing"
        | "zufriedenheit"
        | "rueckruf"
        | "upselling"
      as_traffic_light: "green" | "yellow" | "red"
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
      as_case_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "blocked",
        "completed",
      ],
      as_mediapaket_stage: [
        "not_started",
        "in_progress",
        "data_requested",
        "data_received",
        "graphics_done",
        "homepage_done",
        "social_done",
        "google_done",
        "done",
        "skipped",
      ],
      as_priority: ["low", "normal", "high", "urgent"],
      as_reminder_kind: [
        "login",
        "app",
        "nisv",
        "schulung",
        "mediapaket",
        "callback",
        "custom",
      ],
      as_section: [
        "erstkontakt",
        "geraet",
        "nisv",
        "app",
        "mediapaket",
        "schulung",
        "marketing",
        "zufriedenheit",
        "rueckruf",
        "upselling",
      ],
      as_traffic_light: ["green", "yellow", "red"],
    },
  },
} as const
