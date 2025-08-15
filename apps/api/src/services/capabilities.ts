import { getDatabaseClient } from './database.js';
import { User } from '../types/auth.js';

export interface RoleAssignment {
  role: string;
  scope_type: string;
  scope_id: string;
  expires_at?: string;
}

export interface CapabilitiesResult {
  user_id: string;
  email: string;
  member: boolean;
  roles: RoleAssignment[];
  capabilities: string[];
}

export class CapabilitiesService {
  private db = getDatabaseClient();
  private cache = new Map<string, { data: CapabilitiesResult; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get user capabilities and membership status
   */
  async getUserCapabilities(
    user: User,
    scopeType?: string,
    scopeId?: string
  ): Promise<CapabilitiesResult> {
    const cacheKey = `${user.auth_user_id}:${scopeType || 'all'}:${scopeId || 'all'}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // Get user profile ID
    const userProfile = await this.getUserProfile(user.auth_user_id);
    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // Get role assignments
    const roles = await this.getRoleAssignments(userProfile.id, scopeType, scopeId);
    
    // Check membership for requested scope
    const member = this.checkMembership(roles, scopeType, scopeId);
    
    // Get capabilities based on roles and membership
    const capabilities = await this.getCapabilities(userProfile.id, roles, member, scopeType, scopeId);

    const result: CapabilitiesResult = {
      user_id: user.auth_user_id,
      email: user.email,
      member,
      roles,
      capabilities
    };

    // Cache the result
    this.cache.set(cacheKey, {
      data: result,
      expires: Date.now() + this.CACHE_TTL
    });

    return result;
  }

  /**
   * Get user profile by auth_user_id
   */
  private async getUserProfile(authUserId: string): Promise<{ id: string; email: string } | null> {
    const client = (this.db as any).client; // Access underlying Supabase client
    
    const { data, error } = await client
      .from('users_profile')
      .select('id, email')
      .eq('auth_user_id', authUserId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
    
    return data;
  }

  /**
   * Get role assignments for a user
   */
  private async getRoleAssignments(
    userId: string,
    scopeType?: string,
    scopeId?: string
  ): Promise<RoleAssignment[]> {
    const client = (this.db as any).client; // Access underlying Supabase client
    
    let query = client
      .from('role_assignments')
      .select(`
        roles!inner(name),
        scope_type,
        scope_id,
        expires_at
      `)
      .eq('user_id', userId)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false });
    
    if (scopeType && scopeId) {
      query = query.eq('scope_type', scopeType).eq('scope_id', scopeId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get role assignments: ${error.message}`);
    }
    
    return (data || []).map((row: any) => ({
      role: row.roles.name,
      scope_type: row.scope_type,
      scope_id: row.scope_id,
      expires_at: row.expires_at
    }));
  }

  /**
   * Check if user is a member of the requested scope
   */
  private checkMembership(
    roles: RoleAssignment[],
    scopeType?: string,
    scopeId?: string
  ): boolean {
    if (!scopeType || !scopeId) {
      // If no specific scope requested, user is a member if they have any roles
      return roles.length > 0;
    }
    
    // Check if user has any role in the requested scope
    return roles.some(role => 
      role.scope_type === scopeType && role.scope_id === scopeId
    );
  }

  /**
   * Get capabilities based on roles and membership
   */
  private async getCapabilities(
    userId: string,
    roles: RoleAssignment[],
    member: boolean,
    scopeType?: string,
    scopeId?: string
  ): Promise<string[]> {
    if (!member) {
      return [];
    }

    // For now, use role-based capabilities since the database function requires RLS context
    // TODO: Implement database function that accepts user_id parameter
    const roleCapabilities = this.getRoleBasedCapabilities(roles);
    
    // Add membership-based capabilities
    if (member) {
      roleCapabilities.push('member:true');
    }
    
    return roleCapabilities;
  }

  /**
   * Get capabilities based on role names (fallback)
   */
  private getRoleBasedCapabilities(roles: RoleAssignment[]): string[] {
    const capabilities = new Set<string>();
    
    for (const role of roles) {
      switch (role.role) {
        case 'SuperAdmin':
          capabilities.add('admin:all');
          capabilities.add('read:all');
          capabilities.add('write:all');
          capabilities.add('delete:all');
          break;
          
        case 'OrgAdmin':
          capabilities.add('admin:org');
          capabilities.add('read:clients');
          capabilities.add('write:clients');
          capabilities.add('read:cases');
          capabilities.add('write:cases');
          capabilities.add('read:notes');
          capabilities.add('write:notes');
          capabilities.add('read:referrals');
          capabilities.add('write:referrals');
          capabilities.add('read:reports');
          break;
          
        case 'CaseManager':
          capabilities.add('read:clients');
          capabilities.add('write:clients');
          capabilities.add('read:cases');
          capabilities.add('write:cases');
          capabilities.add('read:notes');
          capabilities.add('write:notes');
          capabilities.add('read:referrals');
          capabilities.add('write:referrals');
          break;
          
        case 'Provider':
          capabilities.add('read:clients');
          capabilities.add('read:cases');
          capabilities.add('read:notes');
          capabilities.add('write:notes');
          capabilities.add('read:referrals');
          capabilities.add('write:referrals');
          break;
          
        case 'LocationManager':
          capabilities.add('admin:location');
          capabilities.add('read:availability');
          capabilities.add('write:availability');
          capabilities.add('read:services');
          capabilities.add('write:services');
          break;
          
        case 'HelperVerified':
          capabilities.add('read:clients:minimal');
          capabilities.add('write:notes:journal');
          capabilities.add('write:referrals:record');
          break;
          
        case 'HelperBasic':
          capabilities.add('read:services');
          capabilities.add('write:referrals:record');
          break;
          
        case 'BasicAccount':
          capabilities.add('read:services:public');
          break;
          
        default:
          // Unknown role gets minimal capabilities
          capabilities.add('read:services:public');
          break;
      }
    }
    
    return Array.from(capabilities);
  }

  /**
   * Clear cache for a specific user or all users
   */
  clearCache(userId?: string): void {
    if (userId) {
      // Clear cache entries for specific user
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
let capabilitiesService: CapabilitiesService | null = null;

export function getCapabilitiesService(): CapabilitiesService {
  if (!capabilitiesService) {
    capabilitiesService = new CapabilitiesService();
  }
  return capabilitiesService;
}