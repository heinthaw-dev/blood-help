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
      blood_requests: {
        Row: {
          alerted_count: number | null
          blood_type: Database["public"]["Enums"]["blood_type"]
          closed_at: string | null
          contact_phone: string
          created_at: string | null
          current_address: string
          expires_at: string
          extended: boolean
          id: string
          lat: number | null
          lng: number | null
          requester_id: string
          status: Database["public"]["Enums"]["request_status"] | null
          units_collected: number
          units_needed: number
          urgency: Database["public"]["Enums"]["urgency"] | null
        }
        Insert: {
          alerted_count?: number | null
          blood_type: Database["public"]["Enums"]["blood_type"]
          closed_at?: string | null
          contact_phone: string
          created_at?: string | null
          current_address: string
          expires_at: string
          extended?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          requester_id: string
          status?: Database["public"]["Enums"]["request_status"] | null
          units_collected?: number
          units_needed?: number
          urgency?: Database["public"]["Enums"]["urgency"] | null
        }
        Update: {
          alerted_count?: number | null
          blood_type?: Database["public"]["Enums"]["blood_type"]
          closed_at?: string | null
          contact_phone?: string
          created_at?: string | null
          current_address?: string
          expires_at?: string
          extended?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          requester_id?: string
          status?: Database["public"]["Enums"]["request_status"] | null
          units_collected?: number
          units_needed?: number
          urgency?: Database["public"]["Enums"]["urgency"] | null
        }
        Relationships: [
          {
            foreignKeyName: "blood_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string | null
          fcm_token: string
          id: string
          platform: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          fcm_token: string
          id?: string
          platform?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string | null
          fcm_token?: string
          id?: string
          platform?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          blood_type: Database["public"]["Enums"]["blood_type"] | null
          confirmed_via: string | null
          created_at: string | null
          donated_on: string | null
          donor_id: string
          id: string
          recipient_id: string | null
          request_id: string | null
        }
        Insert: {
          blood_type?: Database["public"]["Enums"]["blood_type"] | null
          confirmed_via?: string | null
          created_at?: string | null
          donated_on?: string | null
          donor_id: string
          id?: string
          recipient_id?: string | null
          request_id?: string | null
        }
        Update: {
          blood_type?: Database["public"]["Enums"]["blood_type"] | null
          confirmed_via?: string | null
          created_at?: string | null
          donated_on?: string | null
          donor_id?: string
          id?: string
          recipient_id?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      donors: {
        Row: {
          available_after: string | null
          blood_type: Database["public"]["Enums"]["blood_type"]
          created_at: string
          donation_count: number
          donor_code: string | null
          emergency_callable: boolean
          id: string
          is_available: boolean
          last_donation_date: string | null
          lat: number | null
          lng: number | null
          location_updated_at: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          available_after?: string | null
          blood_type: Database["public"]["Enums"]["blood_type"]
          created_at?: string
          donation_count?: number
          donor_code?: string | null
          emergency_callable?: boolean
          id?: string
          is_available?: boolean
          last_donation_date?: string | null
          lat?: number | null
          lng?: number | null
          location_updated_at?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          available_after?: string | null
          blood_type?: Database["public"]["Enums"]["blood_type"]
          created_at?: string
          donation_count?: number
          donor_code?: string | null
          emergency_callable?: boolean
          id?: string
          is_available?: boolean
          last_donation_date?: string | null
          lat?: number | null
          lng?: number | null
          location_updated_at?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          language: Database["public"]["Enums"]["lang"] | null
          name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          language?: Database["public"]["Enums"]["lang"] | null
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          language?: Database["public"]["Enums"]["lang"] | null
          name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      request_responses: {
        Row: {
          created_at: string | null
          donor_id: string
          id: string
          request_id: string
          status: Database["public"]["Enums"]["response_status"]
        }
        Insert: {
          created_at?: string | null
          donor_id: string
          id?: string
          request_id: string
          status?: Database["public"]["Enums"]["response_status"]
        }
        Update: {
          created_at?: string | null
          donor_id?: string
          id?: string
          request_id?: string
          status?: Database["public"]["Enums"]["response_status"]
        }
        Relationships: [
          {
            foreignKeyName: "request_responses_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_donation: {
        Args: { p_donor_code: string; p_request_id: string; p_via: string }
        Returns: Json
      }
      donors_within_radius: {
        Args: { lat: number; lng: number; radius_km: number }
        Returns: {
          blood_type: Database["public"]["Enums"]["blood_type"]
          dist_meters: number
          donation_count: number
          id: string
          lat: number
          lng: number
          profile_id: string
        }[]
      }
      generate_donor_code: { Args: never; Returns: string }
      requests_within_radius: {
        Args: { lat: number; lng: number; radius_km: number }
        Returns: {
          blood_type: Database["public"]["Enums"]["blood_type"]
          contact_phone: string
          created_at: string
          current_address: string
          dist_meters: number
          expires_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["request_status"]
          units_collected: number
          units_needed: number
          urgency: Database["public"]["Enums"]["urgency"]
        }[]
      }
      responders_for_request: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          dist_meters: number
          donor_id: string
          name: string
          phone: string
        }[]
      }
    }
    Enums: {
      blood_type: "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-"
      lang: "my" | "en"
      request_status: "active" | "fulfilled" | "cancelled" | "expired"
      response_status: "responding" | "declined"
      urgency: "urgent" | "today"
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
      blood_type: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
      lang: ["my", "en"],
      request_status: ["active", "fulfilled", "cancelled", "expired"],
      response_status: ["responding", "declined"],
      urgency: ["urgent", "today"],
    },
  },
} as const
