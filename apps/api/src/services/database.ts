import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  return supabaseClient;
}

export interface DatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  rpc<T = any>(functionName: string, params?: Record<string, any>): Promise<T>;
}

export class SupabaseDatabaseClient implements DatabaseClient {
  public client: SupabaseClient; // Make public for direct access when needed
  
  constructor() {
    this.client = getSupabaseClient();
  }
  
  /**
   * Set the JWT context for RLS policies
   */
  setJWTContext(jwt: string): void {
    // For service role client, we need to set the JWT in the headers
    // This is a simplified approach - in production you'd handle this differently
    (this.client as any).supabaseKey = jwt;
  }
  
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    // For Supabase, we'll use the from() method with select() for most queries
    // This is a simplified implementation - for complex queries, we'd need specific RPC functions
    throw new Error('Raw SQL queries not supported. Use table-specific methods or RPC functions.');
  }
  
  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }
  
  async rpc<T = any>(functionName: string, params: Record<string, any> = {}): Promise<T> {
    const { data, error } = await this.client.rpc(functionName, params);
    
    if (error) {
      throw new Error(`RPC call failed: ${error.message}`);
    }
    
    return data;
  }
}

// Singleton instance
let dbClient: DatabaseClient | null = null;

export function getDatabaseClient(): DatabaseClient {
  if (!dbClient) {
    dbClient = new SupabaseDatabaseClient();
  }
  return dbClient;
}