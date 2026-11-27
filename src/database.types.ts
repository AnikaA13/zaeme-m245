export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      household_invites: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string;
          household_id: string;
          id: string;
          revoked_at: string | null;
          token_hash: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          household_id: string;
          id?: string;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          household_id?: string;
          id?: string;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_invites_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_invites_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      household_members: {
        Row: {
          generation: string;
          household_id: string;
          joined_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          generation?: string;
          household_id: string;
          joined_at?: string;
          user_id: string;
        };
        Update: {
          generation?: string;
          household_id?: string;
          joined_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'household_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
          version: number;
          warning_days: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          updated_at?: string;
          version?: number;
          warning_days?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
          version?: number;
          warning_days?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'households_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'owner_is_member';
            columns: ['id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'household_members';
            referencedColumns: ['household_id', 'user_id'];
          },
        ];
      };
      inventory_items: {
        Row: {
          barcode: string | null;
          category: string;
          created_at: string;
          created_by: string | null;
          date_type: string | null;
          expiry_date: string | null;
          household_id: string;
          id: string;
          location: string | null;
          name: string;
          quantity: number;
          status: string;
          unit: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          barcode?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          date_type?: string | null;
          expiry_date?: string | null;
          household_id: string;
          id?: string;
          location?: string | null;
          name: string;
          quantity?: number;
          status?: string;
          unit?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          barcode?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          date_type?: string | null;
          expiry_date?: string | null;
          household_id?: string;
          id?: string;
          location?: string | null;
          name?: string;
          quantity?: number;
          status?: string;
          unit?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_items_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      reservations: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          inventory_item_id: string;
          quantity: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          inventory_item_id: string;
          quantity: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          inventory_item_id?: string;
          quantity?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reservations_household_id_inventory_item_id_fkey';
            columns: ['household_id', 'inventory_item_id'];
            isOneToOne: false;
            referencedRelation: 'active_inventory';
            referencedColumns: ['household_id', 'id'];
          },
          {
            foreignKeyName: 'reservations_household_id_inventory_item_id_fkey';
            columns: ['household_id', 'inventory_item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['household_id', 'id'];
          },
          {
            foreignKeyName: 'reservations_household_id_user_id_fkey';
            columns: ['household_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'household_members';
            referencedColumns: ['household_id', 'user_id'];
          },
        ];
      };
    };
    Views: {
      active_inventory: {
        Row: {
          barcode: string | null;
          category: string;
          consumable_quantity: number | null;
          created_at: string;
          created_by: string | null;
          date_type: string | null;
          expiry_date: string | null;
          free_quantity: number | null;
          household_id: string;
          id: string;
          location: string | null;
          name: string;
          own_quantity: number | null;
          quantity: number;
          reserved_quantity: number | null;
          status: string;
          unit: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'inventory_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_items_household_id_fkey';
            columns: ['household_id'];
            isOneToOne: false;
            referencedRelation: 'households';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      consume_item: {
        Args: {
          amount: Json;
          confirm_full: Json;
          confirmed_v?: number;
          g: string;
          h: string;
          id: string;
          op: string;
          unit: string;
        };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_household: {
        Args: { name: string; op: string };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_invite: {
        Args: { g: string; h: string; hash: string; op: string };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_item: {
        Args: { ack: Json; fields: Json; g: string; h: string; op: string };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_item: {
        Args: {
          confirm: Json;
          g: string;
          h: string;
          id: string;
          op: string;
          v: number;
        };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      dissolve_household: {
        Args: { confirm: boolean; g: string; h: string; op: string };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      edit_item: {
        Args: {
          ack: Json;
          fields: Json;
          g: string;
          h: string;
          id: string;
          op: string;
          v: number;
        };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      join_household: {
        Args: { op: string; token: string };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      leave_household: {
        Args: { confirm: boolean; g: string; h: string; op: string };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      list_invites: {
        Args: { h: string };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      preview_invite: {
        Args: { token: string };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      remove_member: {
        Args: {
          g: string;
          h: string;
          op: string;
          target: string;
          target_g: string;
        };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      revoke_invite: {
        Args: { g: string; h: string; id: string; op: string };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_profile: {
        Args: { g?: string; h?: string; name: string; op: string; v: number };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_reservation: {
        Args: {
          desired: Json;
          g: string;
          h: string;
          id: string;
          op: string;
          v: number;
        };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_warning_days: {
        Args: { days: Json; g: string; h: string; op: string; v: number };
        Returns: Database['public']['CompositeTypes']['rpc_result'];
        SetofOptions: {
          from: '*';
          to: 'rpc_result';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      invite_metadata: {
        id: string | null;
        created_at: string | null;
        expires_at: string | null;
        revoked_at: string | null;
      };
      rpc_result: {
        ok: boolean | null;
        code: string | null;
        id: string | null;
        version: number | null;
        expires_at: string | null;
        household_name: string | null;
        invites:
          Database['public']['CompositeTypes']['invite_metadata'][] | null;
        retry_after: number | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
