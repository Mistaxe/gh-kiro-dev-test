import { getDatabaseClient } from './database.js'
import { Persona, PersonaSession, PersonaListResponse } from '@app/shared'

export class PersonaService {
  private db = getDatabaseClient()
  private activeSessions = new Map<string, PersonaSession>()

  /**
   * List all available personas for testing
   */
  async listPersonas(): Promise<PersonaListResponse> {
    try {
      // Get all users with their roles and organizational context
      const personas = await this.db.rpc('get_lab_personas')
      
      return {
        personas: personas || [],
        total: personas?.length || 0
      }
    } catch (error) {
      // Fallback to direct query if RPC doesn't exist yet
      console.warn('get_lab_personas RPC not found, using fallback query')
      return this.getPersonasFallback()
    }
  }

  /**
   * Fallback method to get personas using direct Supabase queries
   */
  private async getPersonasFallback(): Promise<PersonaListResponse> {
    const client = (this.db as any).client
    
    // Get users with their role assignments
    const { data: users, error: usersError } = await client
      .from('users_profile')
      .select(`
        id,
        auth_user_id,
        email,
        display_name,
        phone,
        is_helper,
        created_at,
        updated_at
      `)
      .limit(50)

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

    const personas: Persona[] = []

    for (const user of users || []) {
      // Get role assignments for this user
      const { data: roleAssignments, error: rolesError } = await client
        .from('role_assignments')
        .select(`
          id,
          scope_type,
          scope_id,
          expires_at,
          source,
          metadata,
          roles!inner(name)
        `)
        .eq('user_id', user.id)

      if (rolesError) {
        console.warn(`Failed to fetch roles for user ${user.id}:`, rolesError.message)
        continue
      }

      // Get organizations this user has access to
      const orgIds = roleAssignments
        ?.filter((ra: any) => ra.scope_type === 'org')
        .map((ra: any) => ra.scope_id) || []

      let organizations: any[] = []
      if (orgIds.length > 0) {
        const { data: orgs, error: orgsError } = await client
          .from('organizations')
          .select(`
            id,
            name,
            org_type,
            dba,
            tenant_root_id,
            region_id,
            regions(name)
          `)
          .in('id', orgIds)

        if (!orgsError) {
          organizations = orgs || []
        }
      }

      // Get locations this user has access to
      const locationIds = roleAssignments
        ?.filter((ra: any) => ra.scope_type === 'location')
        .map((ra: any) => ra.scope_id) || []

      let locations: any[] = []
      if (locationIds.length > 0) {
        const { data: locs, error: locsError } = await client
          .from('service_locations')
          .select(`
            id,
            name,
            org_id,
            claimed,
            claim_owner_user_id,
            organizations(name)
          `)
          .in('id', locationIds)

        if (!locsError) {
          locations = locs || []
        }
      }

      // Transform role assignments
      const roles = roleAssignments?.map((ra: any) => ({
        id: ra.id,
        role: ra.roles.name,
        scope_type: ra.scope_type,
        scope_id: ra.scope_id,
        expires_at: ra.expires_at,
        source: ra.source,
        metadata: ra.metadata
      })) || []

      personas.push({
        id: user.id,
        auth_user_id: user.auth_user_id,
        email: user.email,
        display_name: user.display_name,
        phone: user.phone,
        is_helper: user.is_helper,
        roles,
        organizations: organizations.map(org => ({
          id: org.id,
          name: org.name,
          org_type: org.org_type,
          dba: org.dba,
          tenant_root_id: org.tenant_root_id,
          region_id: org.region_id,
          region_name: org.regions?.name
        })),
        locations: locations.map(loc => ({
          id: loc.id,
          name: loc.name,
          org_id: loc.org_id,
          org_name: loc.organizations?.name,
          claimed: loc.claimed,
          claim_owner_user_id: loc.claim_owner_user_id
        })),
        created_at: user.created_at,
        updated_at: user.updated_at
      })
    }

    return {
      personas,
      total: personas.length
    }
  }

  /**
   * Start impersonation session for a persona
   */
  async startImpersonation(
    personaId: string,
    activeOrgId?: string,
    activeLocationId?: string,
    purpose?: string
  ): Promise<PersonaSession> {
    // Validate persona exists
    const personas = await this.listPersonas()
    const persona = personas.personas.find(p => p.id === personaId)
    
    if (!persona) {
      throw new Error(`Persona not found: ${personaId}`)
    }

    // Validate organization access if specified
    if (activeOrgId && !persona.organizations.some(org => org.id === activeOrgId)) {
      throw new Error(`Persona does not have access to organization: ${activeOrgId}`)
    }

    // Validate location access if specified
    if (activeLocationId && !persona.locations.some(loc => loc.id === activeLocationId)) {
      throw new Error(`Persona does not have access to location: ${activeLocationId}`)
    }

    const session: PersonaSession = {
      persona_id: personaId,
      active_org_id: activeOrgId,
      active_location_id: activeLocationId,
      purpose: purpose as any,
      session_started_at: new Date().toISOString()
    }

    // Store session in memory (in production, this would be in Redis or database)
    const sessionKey = `session_${personaId}`
    this.activeSessions.set(sessionKey, session)

    return session
  }

  /**
   * Update scope selection for current session
   */
  async updateScopeSelection(
    personaId: string,
    activeOrgId?: string,
    activeLocationId?: string,
    purpose?: string
  ): Promise<PersonaSession> {
    const sessionKey = `session_${personaId}`
    const existingSession = this.activeSessions.get(sessionKey)

    if (!existingSession) {
      throw new Error('No active session found for persona')
    }

    const updatedSession: PersonaSession = {
      ...existingSession,
      active_org_id: activeOrgId,
      active_location_id: activeLocationId,
      purpose: purpose as any
    }

    this.activeSessions.set(sessionKey, updatedSession)
    return updatedSession
  }

  /**
   * Get current session for a persona
   */
  async getCurrentSession(personaId: string): Promise<PersonaSession | null> {
    const sessionKey = `session_${personaId}`
    return this.activeSessions.get(sessionKey) || null
  }

  /**
   * End impersonation session
   */
  async endImpersonation(personaId: string): Promise<void> {
    const sessionKey = `session_${personaId}`
    this.activeSessions.delete(sessionKey)
  }

  /**
   * Get all active sessions (for debugging)
   */
  async getActiveSessions(): Promise<PersonaSession[]> {
    return Array.from(this.activeSessions.values())
  }
}