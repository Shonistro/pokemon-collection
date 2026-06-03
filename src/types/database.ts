/**
 * Hand-written Supabase schema types (mirrors supabase/migrations).
 *
 * The structure intentionally matches what `supabase gen types typescript`
 * emits (each table has Row/Insert/Update/Relationships; the schema has
 * Views/Functions/Enums/CompositeTypes) so the typed supabase-js client infers
 * query results correctly. If you install the Supabase CLI you can regenerate:
 *   supabase gen types typescript --local > src/types/database.ts
 */

export type GameSource = 'tcgapi' | 'manual';
export type CardSource = 'tcgapi' | 'manual';
export type Condition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          slug: string;
          name: string;
          source: GameSource;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          source?: GameSource;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          source?: GameSource;
          created_at?: string;
        };
        Relationships: [];
      };
      cards: {
        Row: {
          id: string;
          game_id: string;
          name: string;
          set_name: string | null;
          number: string | null;
          image_url: string | null;
          external_id: string | null;
          source: CardSource;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          name: string;
          set_name?: string | null;
          number?: string | null;
          image_url?: string | null;
          external_id?: string | null;
          source?: CardSource;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          name?: string;
          set_name?: string | null;
          number?: string | null;
          image_url?: string | null;
          external_id?: string | null;
          source?: CardSource;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cards_game_id_fkey';
            columns: ['game_id'];
            referencedRelation: 'games';
            referencedColumns: ['id'];
          },
        ];
      };
      collection: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          condition: Condition;
          quantity: number;
          acquired_price: number | null;
          manual_price: number | null;
          last_known_price: number | null;
          previous_price: number | null;
          price_updated_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          card_id: string;
          condition?: Condition;
          quantity?: number;
          acquired_price?: number | null;
          manual_price?: number | null;
          last_known_price?: number | null;
          previous_price?: number | null;
          price_updated_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          condition?: Condition;
          quantity?: number;
          acquired_price?: number | null;
          manual_price?: number | null;
          last_known_price?: number | null;
          previous_price?: number | null;
          price_updated_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collection_card_id_fkey';
            columns: ['card_id'];
            referencedRelation: 'cards';
            referencedColumns: ['id'];
          },
        ];
      };
      portfolio_snapshots: {
        Row: {
          id: string;
          user_id: string;
          captured_on: string;
          total_value: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          captured_on?: string;
          total_value?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          captured_on?: string;
          total_value?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
