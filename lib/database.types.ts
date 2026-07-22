export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_user: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      attempt: {
        Row: {
          actual_grams: number | null
          ended_at: string | null
          expected_end: string
          failure_reason: Database["public"]["Enums"]["failure_reason"] | null
          id: string
          job_id: string
          notes: string | null
          outcome: Database["public"]["Enums"]["attempt_outcome"] | null
          printer_id: string
          spool_id: string
          started_at: string
          started_by: string
        }
        Insert: {
          actual_grams?: number | null
          ended_at?: string | null
          expected_end: string
          failure_reason?: Database["public"]["Enums"]["failure_reason"] | null
          id?: string
          job_id: string
          notes?: string | null
          outcome?: Database["public"]["Enums"]["attempt_outcome"] | null
          printer_id: string
          spool_id: string
          started_at?: string
          started_by: string
        }
        Update: {
          actual_grams?: number | null
          ended_at?: string | null
          expected_end?: string
          failure_reason?: Database["public"]["Enums"]["failure_reason"] | null
          id?: string
          job_id?: string
          notes?: string | null
          outcome?: Database["public"]["Enums"]["attempt_outcome"] | null
          printer_id?: string
          spool_id?: string
          started_at?: string
          started_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_reliability"
            referencedColumns: ["printer_id"]
          },
          {
            foreignKeyName: "attempt_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_service_status"
            referencedColumns: ["printer_id"]
          },
          {
            foreignKeyName: "attempt_spool_id_fkey"
            columns: ["spool_id"]
            isOneToOne: false
            referencedRelation: "spool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      job: {
        Row: {
          collected_at: string | null
          color_preference: string | null
          created_at: string
          est_grams: number | null
          est_minutes: number | null
          file_path: string | null
          id: string
          material: string
          needed_by: string | null
          notes: string | null
          owner_id: string
          priority: number
          shelf_location: string | null
          status: Database["public"]["Enums"]["job_status"]
          submitted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          collected_at?: string | null
          color_preference?: string | null
          created_at?: string
          est_grams?: number | null
          est_minutes?: number | null
          file_path?: string | null
          id?: string
          material: string
          needed_by?: string | null
          notes?: string | null
          owner_id: string
          priority?: number
          shelf_location?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          submitted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          collected_at?: string | null
          color_preference?: string | null
          created_at?: string
          est_grams?: number | null
          est_minutes?: number | null
          file_path?: string | null
          id?: string
          material?: string
          needed_by?: string | null
          notes?: string | null
          owner_id?: string
          priority?: number
          shelf_location?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          submitted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner_usage"
            referencedColumns: ["owner_id"]
          },
          {
            foreignKeyName: "job_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_log: {
        Row: {
          action: string
          hours_at_service: number | null
          id: string
          notes: string | null
          performed_at: string
          performed_by: string
          printer_id: string
        }
        Insert: {
          action: string
          hours_at_service?: number | null
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by: string
          printer_id: string
        }
        Update: {
          action?: string
          hours_at_service?: number | null
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string
          printer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_log_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_log_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_reliability"
            referencedColumns: ["printer_id"]
          },
          {
            foreignKeyName: "maintenance_log_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_service_status"
            referencedColumns: ["printer_id"]
          },
        ]
      }
      owner: {
        Row: {
          active: boolean
          course_code: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["owner_kind"]
          quota_grams: number | null
        }
        Insert: {
          active?: boolean
          course_code?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["owner_kind"]
          quota_grams?: number | null
        }
        Update: {
          active?: boolean
          course_code?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["owner_kind"]
          quota_grams?: number | null
        }
        Relationships: []
      }
      printer: {
        Row: {
          build_volume: string | null
          created_at: string
          id: string
          model: string
          name: string
          notes: string | null
          nozzle_mm: number
          service_interval_hours: number
          state: Database["public"]["Enums"]["printer_state"]
        }
        Insert: {
          build_volume?: string | null
          created_at?: string
          id?: string
          model: string
          name: string
          notes?: string | null
          nozzle_mm?: number
          service_interval_hours?: number
          state?: Database["public"]["Enums"]["printer_state"]
        }
        Update: {
          build_volume?: string | null
          created_at?: string
          id?: string
          model?: string
          name?: string
          notes?: string | null
          nozzle_mm?: number
          service_interval_hours?: number
          state?: Database["public"]["Enums"]["printer_state"]
        }
        Relationships: []
      }
      spool: {
        Row: {
          brand: string | null
          color_hex: string | null
          color_name: string
          cost_cents: number
          created_at: string
          id: string
          material: string
          opened_on: string | null
          remaining_grams: number
          retired: boolean
          total_grams: number
        }
        Insert: {
          brand?: string | null
          color_hex?: string | null
          color_name: string
          cost_cents?: number
          created_at?: string
          id?: string
          material: string
          opened_on?: string | null
          remaining_grams: number
          retired?: boolean
          total_grams: number
        }
        Update: {
          brand?: string | null
          color_hex?: string | null
          color_name?: string
          cost_cents?: number
          created_at?: string
          id?: string
          material?: string
          opened_on?: string | null
          remaining_grams?: number
          retired?: boolean
          total_grams?: number
        }
        Relationships: []
      }
    }
    Views: {
      owner_usage: {
        Row: {
          cost_cents: number | null
          course_code: string | null
          display_name: string | null
          grams_failed: number | null
          grams_success: number | null
          owner_id: string | null
          quota_grams: number | null
        }
        Relationships: []
      }
      printer_reliability: {
        Row: {
          attempts: number | null
          failure_rate_pct: number | null
          failures: number | null
          name: string | null
          printer_id: string | null
          wasted_grams: number | null
        }
        Relationships: []
      }
      printer_service_status: {
        Row: {
          hours_since_service: number | null
          last_service_at: string | null
          name: string | null
          printer_id: string | null
          service_interval_hours: number | null
          state: Database["public"]["Enums"]["printer_state"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_operate: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      attempt_outcome: "success" | "failed" | "cancelled"
      failure_reason:
        | "adhesion"
        | "layer_shift"
        | "clog"
        | "filament_runout"
        | "power_loss"
        | "model_error"
        | "operator_error"
        | "other"
      job_status:
        | "submitted"
        | "queued"
        | "printing"
        | "post_processing"
        | "ready_for_pickup"
        | "collected"
        | "cancelled"
      owner_kind: "student" | "course" | "faculty" | "department"
      printer_state: "available" | "printing" | "maintenance" | "retired"
      user_role: "admin" | "operator" | "ta"
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
      attempt_outcome: ["success", "failed", "cancelled"],
      failure_reason: [
        "adhesion",
        "layer_shift",
        "clog",
        "filament_runout",
        "power_loss",
        "model_error",
        "operator_error",
        "other",
      ],
      job_status: [
        "submitted",
        "queued",
        "printing",
        "post_processing",
        "ready_for_pickup",
        "collected",
        "cancelled",
      ],
      owner_kind: ["student", "course", "faculty", "department"],
      printer_state: ["available", "printing", "maintenance", "retired"],
      user_role: ["admin", "operator", "ta"],
    },
  },
} as const

