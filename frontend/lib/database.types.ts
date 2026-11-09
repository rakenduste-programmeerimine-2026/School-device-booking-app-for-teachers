
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "allowed_emails": {
                  Row: {
                    "email": string,"role": Database["public"]['Enums']["user_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "email"?: string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    
                  ]
                },"booking_changes": {
                  Row: {
                    "action": Database["public"]['Enums']["booking_change_action"],"booking_id": number,"changed_at": string,"changed_by": string | null,"id": number,"new_data": Json | null,"old_data": Json | null,"series_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["booking_change_action"],"booking_id": number,"changed_at"?: string,"changed_by"?: string | null,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"series_id": number
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["booking_change_action"],"booking_id"?: number,"changed_at"?: string,"changed_by"?: string | null,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"series_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_changes_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_changes_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_series": {
                  Row: {
                    "created_at": string,"id": number,"owner_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"owner_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"owner_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_series_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profile_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_series_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "device_type_id": number,"ends_at": string,"id": number,"quantity": number,"series_id": number,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "device_type_id": number,"ends_at": string,"id"?: never,"quantity": number,"series_id": number,"starts_at": string
                  }
                  Update: {
                    "device_type_id"?: number,"ends_at"?: string,"id"?: never,"quantity"?: number,"series_id"?: number,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_device_type_id_fkey"
      columns: ["device_type_id"]
isOneToOne: false
      referencedRelation: "device_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_series_id_fkey"
      columns: ["series_id"]
isOneToOne: false
      referencedRelation: "booking_series"
      referencedColumns: ["id"]
    }
                  ]
                },"device_types": {
                  Row: {
                    "archived_at": string | null,"id": number,"name": string,"total_quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"id"?: never,"name": string,"total_quantity": number
                  }
                  Update: {
                    "archived_at"?: string | null,"id"?: never,"name"?: string,"total_quantity"?: number
                  }
                  Relationships: [
                    
                  ]
                },"lesson_periods": {
                  Row: {
                    "ends_time": string,"id": number,"lesson_number": number,"starts_time": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_time": string,"id"?: never,"lesson_number": number,"starts_time": string
                  }
                  Update: {
                    "ends_time"?: string,"id"?: never,"lesson_number"?: number,"starts_time"?: string
                  }
                  Relationships: [
                    
                  ]
                },"non_teaching_periods": {
                  Row: {
                    "ends_on": string,"id": number,"kind": Database["public"]['Enums']["non_teaching_kind"],"name": string,"school_year_id": number,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_on": string,"id"?: never,"kind": Database["public"]['Enums']["non_teaching_kind"],"name": string,"school_year_id": number,"starts_on": string
                  }
                  Update: {
                    "ends_on"?: string,"id"?: never,"kind"?: Database["public"]['Enums']["non_teaching_kind"],"name"?: string,"school_year_id"?: number,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "non_teaching_periods_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "email": string,"full_name": string | null,"id": string,"role": Database["public"]['Enums']["user_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string,"full_name"?: string | null,"id": string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "email"?: string,"full_name"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    
                  ]
                },"school_years": {
                  Row: {
                    "ends_on": string,"id": number,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_on": string,"id"?: never,"starts_on": string
                  }
                  Update: {
                    "ends_on"?: string,"id"?: never,"starts_on"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "profile_names": {
                  Row: {
                    "full_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "full_name"?: string | null,"id"?: string | null
                         }
                        Update: {
                           "full_name"?: string | null,"id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "available_quantity":
{ Args: { "p_device_type_id": number,"p_ends_at": string,"p_starts_at": string }; Returns: number
                           },
"create_booking":
{ Args: { "p_device_type_id": number,"p_ends_at": string,"p_quantity": number,"p_starts_at": string }; Returns: number
                           },
"device_availability":
{ Args: { "p_date": string,"p_ends": string,"p_starts": string }; Returns: {
                    "free_quantity": number,"id": number,"name": string,"total_quantity": number
                  }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"peak_usage":
{ Args: { "p_device_type_id": number,"p_ends_at": string,"p_starts_at": string }; Returns: number
                           }
          }
          Enums: {
            "booking_change_action": "created"|"updated"|"deleted","non_teaching_kind": "break"|"public_holiday"|"day_off","user_role": "teacher"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "booking_change_action": ["created", "updated", "deleted"],"non_teaching_kind": ["break", "public_holiday", "day_off"],"user_role": ["teacher", "admin"]
          }
        }
} as const
