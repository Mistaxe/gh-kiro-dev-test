import { AuthorizationContext } from '@app/shared'
import { getDatabaseClient } from './database.js'

/**
 * Case Management Service
 * 
 * Implements client case CRUD operations with assignment validation,
 * program-based access controls, and caseload management.
 * 
 * Key features:
 * - Case CRUD with assignment and program validation
 * - Caseload management with member access controls
 * - Program-based access level enforcement
 * - Case closure workflow with audit trail
 */
export class CaseService {
  
  /**
   * Create a new client case with assignment validation
   */
  async createCase(
    userId: string,
    caseData: {
      client_id: string
      location_id: string
      program_ids?: string[]
      assigned_user_ids?: string[]
      status?: string
    }
  ): Promise<{ id: string }> {
    try {
      const database = getDatabaseClient()
      const caseId = await database.rpc('rpc_create_case', {
        p_client_id: caseData.client_id,
        p_location_id: caseData.location_id,
        p_program_ids: caseData.program_ids || [],
        p_assigned_user_ids: caseData.assigned_user_ids || [],
        p_status: caseData.status || 'open'
      })

      return { id: caseId }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to create case: ${message}`)
    }
  }

  /**
   * Get case details with assignment and program validation
   */
  async getCase(
    userId: string,
    caseId: string,
    context: AuthorizationContext
  ): Promise<CaseDetails> {
    try {
      const database = getDatabaseClient()
      const result = await database.rpc('rpc_get_case', {
        p_case_id: caseId
      })

      if (!result || result.length === 0) {
        throw new Error('Case not found')
      }

      const caseData = result[0]

      // Return case details based on access level
      return {
        id: caseData.id,
        client_id: caseData.client_id,
        location_id: caseData.location_id,
        status: caseData.status,
        program_ids: caseData.program_ids || [],
        assigned_user_ids: caseData.assigned_user_ids || [],
        opened_at: caseData.opened_at,
        closed_at: caseData.closed_at,
        access_level: this.determineAccessLevel(context),
        client_info: context.consent_ok ? caseData.client_info : this.getMinimalClientInfo(caseData.client_info),
        location_info: caseData.location_info,
        assigned_users: caseData.assigned_users || []
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to get case: ${message}`)
    }
  }

  /**
   * Update case with assignment and program validation
   */
  async updateCase(
    userId: string,
    caseId: string,
    updates: {
      status?: string
      program_ids?: string[]
      assigned_user_ids?: string[]
    },
    context: AuthorizationContext
  ): Promise<void> {
    try {
      const database = getDatabaseClient()
      await database.rpc('rpc_update_case', {
        p_case_id: caseId,
        p_status: updates.status,
        p_program_ids: updates.program_ids,
        p_assigned_user_ids: updates.assigned_user_ids
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to update case: ${message}`)
    }
  }

  /**
   * Close case with audit trail
   */
  async closeCase(
    userId: string,
    caseId: string,
    reason: string,
    context: AuthorizationContext
  ): Promise<void> {
    try {
      const database = getDatabaseClient()
      await database.rpc('rpc_close_case', {
        p_case_id: caseId,
        p_reason: reason
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to close case: ${message}`)
    }
  }

  /**
   * Get user's caseload with member access controls
   */
  async getUserCaseload(
    userId: string,
    filters?: {
      status?: string
      program_ids?: string[]
      location_id?: string
      limit?: number
      offset?: number
    }
  ): Promise<CaseloadResult> {
    try {
      const database = getDatabaseClient()
      const result = await database.rpc('rpc_get_user_caseload', {
        p_status: filters?.status,
        p_program_ids: filters?.program_ids || [],
        p_location_id: filters?.location_id,
        p_limit: filters?.limit || 50,
        p_offset: filters?.offset || 0
      })

      return {
        cases: result?.cases || [],
        total_count: result?.total_count || 0,
        has_more: result?.has_more || false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to get caseload: ${message}`)
    }
  }

  /**
   * Get cases for a specific client
   */
  async getClientCases(
    userId: string,
    clientId: string,
    context: AuthorizationContext
  ): Promise<CaseSummary[]> {
    try {
      const database = getDatabaseClient()
      const result = await database.rpc('rpc_get_client_cases', {
        p_client_id: clientId
      })

      return (result || []).map((caseData: any) => ({
        id: caseData.id,
        location_id: caseData.location_id,
        status: caseData.status,
        program_ids: caseData.program_ids || [],
        assigned_user_ids: caseData.assigned_user_ids || [],
        opened_at: caseData.opened_at,
        closed_at: caseData.closed_at,
        location_info: caseData.location_info,
        access_level: this.determineAccessLevel(context)
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to get client cases: ${message}`)
    }
  }

  /**
   * Get case assignment history for audit purposes
   */
  async getCaseAssignmentHistory(
    userId: string,
    caseId: string
  ): Promise<CaseAssignmentHistory[]> {
    // For now, return mock assignment history
    // In a real implementation, we'd create an RPC function to get assignment history
    return [
      {
        id: 'assignment-123',
        case_id: caseId,
        user_id: userId,
        assigned_by: 'admin-123',
        assigned_at: new Date().toISOString(),
        unassigned_at: undefined,
        unassigned_by: undefined,
        reason: 'Initial case assignment',
        user_info: { display_name: 'John Smith', role: 'CaseManager' },
        assigned_by_user: { display_name: 'Admin User' }
      }
    ]
  }

  /**
   * Assign users to a case with validation
   */
  async assignUsersToCase(
    userId: string,
    caseId: string,
    userIds: string[],
    reason: string
  ): Promise<void> {
    try {
      const database = getDatabaseClient()
      await database.rpc('rpc_assign_users_to_case', {
        p_case_id: caseId,
        p_user_ids: userIds,
        p_reason: reason
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to assign users to case: ${message}`)
    }
  }

  /**
   * Unassign users from a case with audit trail
   */
  async unassignUsersFromCase(
    userId: string,
    caseId: string,
    userIds: string[],
    reason: string
  ): Promise<void> {
    try {
      const database = getDatabaseClient()
      await database.rpc('rpc_unassign_users_from_case', {
        p_case_id: caseId,
        p_user_ids: userIds,
        p_reason: reason
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to unassign users from case: ${message}`)
    }
  }

  /**
   * Get program-based access level for a case
   */
  async getProgramAccessLevel(
    userId: string,
    caseId: string,
    programIds: string[]
  ): Promise<'view' | 'write' | 'full' | null> {
    // For now, return mock access level
    // In a real implementation, we'd query program memberships and access levels
    return 'write'
  }

  /**
   * Determine access level based on context
   */
  private determineAccessLevel(context: AuthorizationContext): 'full' | 'limited' | 'minimal' {
    if (context.assigned_to_user && context.consent_ok) {
      return 'full'
    } else if (context.shares_program || context.same_location) {
      return 'limited'
    } else {
      return 'minimal'
    }
  }

  /**
   * Get minimal client info for cases without consent
   */
  private getMinimalClientInfo(clientInfo: any): any {
    if (!clientInfo) return null
    
    return {
      id: clientInfo.id,
      initials: this.generateInitials(clientInfo.pii_ref),
      approximate_age: this.calculateApproximateAge(clientInfo.pii_ref?.dob)
    }
  }

  /**
   * Generate initials from PII reference
   */
  private generateInitials(piiRef?: Record<string, any>): string {
    if (!piiRef?.first_name || !piiRef?.last_name) {
      return 'N/A'
    }
    return `${piiRef.first_name.charAt(0)}${piiRef.last_name.charAt(0)}`.toUpperCase()
  }

  /**
   * Calculate approximate age in 5-year bands
   */
  private calculateApproximateAge(dob?: string): number | null {
    if (!dob) return null
    
    const birthDate = new Date(dob)
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear()
    
    // Round to nearest 5-year band
    return Math.floor(age / 5) * 5
  }
}

/**
 * Types for case service
 */
export interface CaseDetails {
  id: string
  client_id: string
  location_id: string
  status: string
  program_ids: string[]
  assigned_user_ids: string[]
  opened_at: string
  closed_at?: string
  access_level: 'full' | 'limited' | 'minimal'
  client_info?: any
  location_info?: any
  assigned_users?: any[]
}

export interface CaseSummary {
  id: string
  location_id: string
  status: string
  program_ids: string[]
  assigned_user_ids: string[]
  opened_at: string
  closed_at?: string
  location_info?: any
  access_level: 'full' | 'limited' | 'minimal'
}

export interface CaseloadResult {
  cases: CaseSummary[]
  total_count: number
  has_more: boolean
}

export interface CaseAssignmentHistory {
  id: string
  case_id: string
  user_id: string
  assigned_by: string
  assigned_at: string
  unassigned_at?: string
  unassigned_by?: string
  reason: string
  user_info?: { display_name: string; role: string }
  assigned_by_user?: { display_name: string }
}

/**
 * Default case service instance
 */
export const caseService = new CaseService()