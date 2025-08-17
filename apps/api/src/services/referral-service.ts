import { getDatabaseClient } from './database.js'
import type { AuthorizationContext } from '@app/shared'
import type {
  CreateReferralRequest,
  UpdateReferralRequest,
  SearchReferralsQuery,
  RespondToReferralRequest,
  ReferralResponse,
  SearchReferralsResponse,
  ServiceMatch
} from '../schemas/referrals.js'

/**
 * Referral Service
 * 
 * Implements referral workflow with PHI detection, consent validation,
 * visibility scope controls, and service matching functionality.
 */
export class ReferralService {
  private _database?: ReturnType<typeof getDatabaseClient>
  
  private get database() {
    if (!this._database) {
      this._database = getDatabaseClient()
    }
    return this._database
  }
  
  /**
   * Create a new referral with PHI detection and consent validation
   */
  async createReferral(
    userId: string,
    request: CreateReferralRequest
  ): Promise<{ id: string }> {
    try {
      const result = await this.database.rpc('rpc_create_referral', {
        p_to_location_id: request.to_location_id,
        p_client_id: request.client_id || null,
        p_referral_type: request.referral_type || 'direct',
        p_title: request.title,
        p_description: request.description,
        p_urgency: request.urgency || 'routine',
        p_visibility_scope: request.visibility_scope || 'organization',
        p_consent_id: request.consent_id || null
      })

      return { id: result }
    } catch (error) {
      console.error('Error creating referral:', error)
      throw error
    }
  }

  /**
   * Search referrals with visibility controls
   */
  async searchReferrals(
    userId: string,
    query: SearchReferralsQuery
  ): Promise<SearchReferralsResponse> {
    try {
      const result = await this.database.rpc('rpc_search_referrals', {
        p_status: query.status || null,
        p_urgency: query.urgency || null,
        p_referral_type: query.referral_type || null,
        p_from_location_id: query.from_location_id || null,
        p_to_location_id: query.to_location_id || null,
        p_search_term: query.search_term || null,
        p_limit: query.limit || 50,
        p_offset: query.offset || 0
      })

      return result as SearchReferralsResponse
    } catch (error) {
      console.error('Error searching referrals:', error)
      throw error
    }
  }

  /**
   * Get a specific referral with authorization
   */
  async getReferral(
    userId: string,
    referralId: string,
    context: AuthorizationContext
  ): Promise<ReferralResponse> {
    try {
      // Use search to leverage existing authorization
      const searchResult = await this.searchReferrals(userId, {
        limit: 1000, // Large limit to find the specific referral
        offset: 0
      })

      const referral = searchResult.referrals.find(r => r.id === referralId)
      
      if (!referral) {
        throw new Error('Referral not found or access denied')
      }

      return referral
    } catch (error) {
      console.error('Error getting referral:', error)
      throw error
    }
  }

  /**
   * Update a referral (only creator can update pending referrals)
   */
  async updateReferral(
    userId: string,
    referralId: string,
    request: UpdateReferralRequest,
    context: AuthorizationContext
  ): Promise<void> {
    try {
      // First verify the user is the creator and referral is pending
      const referral = await this.getReferral(userId, referralId, context)
      
      if (referral.from_user_id !== userId) {
        throw new Error('Only the referral creator can update the referral')
      }

      if (referral.status !== 'pending') {
        throw new Error('Only pending referrals can be updated')
      }

      // Build update query dynamically
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1

      if (request.title !== undefined) {
        updates.push(`title = $${paramIndex++}`)
        values.push(request.title)
      }

      if (request.description !== undefined) {
        updates.push(`description = $${paramIndex++}`)
        values.push(request.description)
      }

      if (request.urgency !== undefined) {
        updates.push(`urgency = $${paramIndex++}`)
        values.push(request.urgency)
      }

      if (request.visibility_scope !== undefined) {
        updates.push(`visibility_scope = $${paramIndex++}`)
        values.push(request.visibility_scope)
      }

      if (updates.length === 0) {
        return // Nothing to update
      }

      updates.push(`updated_at = now()`)
      values.push(referralId)

      const query = `
        UPDATE app.referrals 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND from_user_id = $${paramIndex + 1} AND status = 'pending'
      `
      values.push(userId)

      // Use the RPC function for updates
      await this.database.rpc('rpc_update_referral', {
        p_referral_id: referralId,
        p_title: request.title || null,
        p_description: request.description || null,
        p_urgency: request.urgency || null,
        p_visibility_scope: request.visibility_scope || null
      })

    } catch (error) {
      console.error('Error updating referral:', error)
      throw error
    }
  }

  /**
   * Respond to a referral (accept/decline)
   */
  async respondToReferral(
    userId: string,
    referralId: string,
    request: RespondToReferralRequest
  ): Promise<void> {
    try {
      await this.database.rpc('rpc_respond_to_referral', {
        p_referral_id: referralId,
        p_status: request.status,
        p_response_notes: request.response_notes || null
      })
    } catch (error) {
      console.error('Error responding to referral:', error)
      throw error
    }
  }

  /**
   * Cancel a referral (only creator can cancel pending referrals)
   */
  async cancelReferral(
    userId: string,
    referralId: string,
    reason: string,
    context: AuthorizationContext
  ): Promise<void> {
    try {
      // First verify the user is the creator and referral is pending
      const referral = await this.getReferral(userId, referralId, context)
      
      if (referral.from_user_id !== userId) {
        throw new Error('Only the referral creator can cancel the referral')
      }

      if (referral.status !== 'pending') {
        throw new Error('Only pending referrals can be cancelled')
      }

      // Use the RPC function for cancellation
      await this.database.rpc('rpc_cancel_referral', {
        p_referral_id: referralId,
        p_reason: reason
      })

    } catch (error) {
      console.error('Error cancelling referral:', error)
      throw error
    }
  }

  /**
   * Match referral to available services
   */
  async matchReferralServices(
    userId: string,
    referralId: string
  ): Promise<ServiceMatch[]> {
    try {
      const result = await this.database.rpc('rpc_match_referral_services', {
        p_referral_id: referralId
      })

      return result as ServiceMatch[]
    } catch (error) {
      console.error('Error matching referral services:', error)
      throw error
    }
  }

  /**
   * Get referrals sent by user
   */
  async getSentReferrals(
    userId: string,
    status?: string,
    limit: number = 50
  ): Promise<SearchReferralsResponse> {
    try {
      // For now, use the search function to get sent referrals
      return this.searchReferrals(userId, {
        status: status as any,
        limit,
        offset: 0
      })
    } catch (error) {
      console.error('Error getting sent referrals:', error)
      throw error
    }
  }

  /**
   * Get referrals received by user's locations
   */
  async getReceivedReferrals(
    userId: string,
    status?: string,
    limit: number = 50
  ): Promise<SearchReferralsResponse> {
    return this.searchReferrals(userId, {
      status: status as any,
      limit,
      offset: 0
    })
  }

  /**
   * Get referral statistics for user
   */
  async getReferralStats(userId: string): Promise<{
    sent: { total: number; pending: number; accepted: number; declined: number }
    received: { total: number; pending: number; accepted: number; declined: number }
  }> {
    try {
      const result = await this.database.rpc('rpc_get_referral_stats')
      return result as {
        sent: { total: number; pending: number; accepted: number; declined: number }
        received: { total: number; pending: number; accepted: number; declined: number }
      }
    } catch (error) {
      console.error('Error getting referral stats:', error)
      throw error
    }
  }
}

// Export singleton instance
export const referralService = new ReferralService()