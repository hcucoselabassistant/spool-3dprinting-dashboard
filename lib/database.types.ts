// PLACEHOLDER -- REGENERATE BEFORE PHASE 2.
//
// CLAUDE.md requires this file to be generated, never hand-written. It cannot be
// generated until a Supabase project is linked, so this stub covers only the one
// table Phase 1 touches (app_user) to keep `npm run build` green.
//
// Once you have linked a project, overwrite this file wholesale:
//
//   npm run db:types
//
// Do not extend this stub by hand. Anything you add here will drift from the
// schema and the drift will surface as a runtime error, not a type error.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "operator";

export type Database = {
  public: {
    Tables: {
      app_user: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: UserRole;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<never, never>;
  };
};
