export interface DbExpense {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  category: string;
  note: string;
  date: string;
  mode?: string | null;
  created_at: string;
}

export interface DbBudget {
  id: string;
  user_id: string;
  monthly: number;
  currency: string;
  updated_at: string;
}

export interface DbInvoice {
  id: string;
  user_id: string;
  client_name: string;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  status: string;
  note: string;
  created_at: string;
}

export interface DbProfile {
  id: string;
  email: string;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      expenses: {
        Row: DbExpense;
        Insert: Omit<DbExpense, 'created_at'>;
        Update: Partial<Omit<DbExpense, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      budgets: {
        Row: DbBudget;
        Insert: Omit<DbBudget, 'id' | 'updated_at'>;
        Update: Partial<Omit<DbBudget, 'id' | 'user_id'>>;
        Relationships: [];
      };
      invoices: {
        Row: DbInvoice;
        Insert: Omit<DbInvoice, 'created_at'>;
        Update: Partial<Omit<DbInvoice, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      profiles: {
        Row: DbProfile;
        Insert: Omit<DbProfile, 'created_at'>;
        Update: Partial<Omit<DbProfile, 'id'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
