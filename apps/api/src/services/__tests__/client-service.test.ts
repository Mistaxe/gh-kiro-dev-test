import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clientService, ClientService } from '../client-service.js'

// Mock the database service
vi.mock('../database.js', () => ({
  database: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        })),
        or: vi.fn(() => ({
          limit: vi.fn()
        })),
        order: vi.fn(() => ({}))
      })),
      update: vi.fn(() => ({
        eq: vi.fn()
      }))
    }))
  }
}))

// Mock the consent evaluator
vi.mock('../consent-evaluator.js', () => ({
  consentEvaluator: {
    evaluateConsent: vi.fn()
  }
}))

describe('ClientService', () => {
  let service: ClientService

  beforeEach(() => {
    service = new ClientService()
    vi.clearAllMocks()
  })

  describe('createClient', () => {
    it('should create a client with fingerprint generation', async () => {
      const mockDatabase = await import('../database.js')
      
      // Mock RPC call for client creation
      vi.mocked(mockDatabase.database.rpc).mockResolvedValueOnce({
        data: 'client-123',
        error: null
      })

      // Mock client fetch after creation
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'client-123',
              fingerprint: 'fp_abc123'
            },
            error: null
          })
        })
      })
      
      vi.mocked(mockDatabase.database.from).mockReturnValue({
        select: mockSelect
      } as any)

      const result = await service.createClient('user-123', {
        pii_ref: {
          first_name: 'John',
          last_name: 'Doe',
          dob: '1990-01-01'
        },
        flags: { high_risk: false }
      })

      expect(result).toEqual({
        id: 'client-123',
        fingerprint: 'fp_abc123'
      })

      expect(mockDatabase.database.rpc).toHaveBeenCalledWith('rpc_create_client', {
        p_pii_ref: {
          first_name: 'John',
          last_name: 'Doe',
          dob: '1990-01-01'
        },
        p_flags: { high_risk: false },
        p_primary_location_id: null
      })
    })

    it('should handle creation errors', async () => {
      const mockDatabase = await import('../database.js')
      
      vi.mocked(mockDatabase.database.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'insufficient_permissions' }
      })

      await expect(service.createClient('user-123', {})).rejects.toThrow(
        'Failed to create client: insufficient_permissions'
      )
    })
  })

  describe('searchClients', () => {
    it('should search clients with minimal candidate info', async () => {
      const mockDatabase = await import('../database.js')
      
      const mockResults = [
        {
          id: 'client-123',
          initials: 'JD',
          approximate_age: 30,
          fingerprint_match: false,
          same_org: true,
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      vi.mocked(mockDatabase.database.rpc).mockResolvedValueOnce({
        data: mockResults,
        error: null
      })

      const result = await service.searchClients('user-123', {
        search_term: 'John',
        limit: 10
      })

      expect(result).toEqual(mockResults)
      expect(mockDatabase.database.rpc).toHaveBeenCalledWith('rpc_search_clients', {
        p_search_term: 'John',
        p_fingerprint: null,
        p_limit: 10
      })
    })
  })

  describe('getClient', () => {
    it('should return full client details with valid consent', async () => {
      const mockDatabase = await import('../database.js')
      
      const mockClient = {
        id: 'client-123',
        tenant_root_id: 'org-123',
        owner_org_id: 'org-123',
        primary_location_id: null,
        pii_ref: { first_name: 'John', last_name: 'Doe' },
        flags: { high_risk: false },
        fingerprint: 'fp_abc123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockClient,
            error: null
          })
        })
      })
      
      vi.mocked(mockDatabase.database.from).mockReturnValue({
        select: mockSelect
      } as any)

      // Mock tenant access validation
      vi.spyOn(service as any, 'validateTenantAccess').mockResolvedValue(true)

      const context = {
        consent_ok: true,
        tenant_root_id: 'org-123'
      }

      const result = await service.getClient('user-123', 'client-123', context as any)

      expect(result).toEqual({
        ...mockClient,
        access_level: 'full'
      })
    })

    it('should return minimal client info without consent', async () => {
      const mockDatabase = await import('../database.js')
      
      const mockClient = {
        id: 'client-123',
        tenant_root_id: 'org-123',
        owner_org_id: 'org-123',
        pii_ref: { first_name: 'John', last_name: 'Doe', dob: '1990-01-01' },
        fingerprint: 'fp_abc123'
      }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockClient,
            error: null
          })
        })
      })
      
      vi.mocked(mockDatabase.database.from).mockReturnValue({
        select: mockSelect
      } as any)

      // Mock tenant access validation
      vi.spyOn(service as any, 'validateTenantAccess').mockResolvedValue(true)

      const context = {
        consent_ok: false,
        tenant_root_id: 'org-123'
      }

      const result = await service.getClient('user-123', 'client-123', context as any)

      expect(result).toEqual({
        id: 'client-123',
        initials: 'JD',
        approximate_age: 35, // Calculated from 1990 DOB (2024 - 1990 = 34, rounded to 35)
        fingerprint: 'fp_abc123',
        access_level: 'minimal',
        consent_required: true
      })
    })
  })

  describe('linkClient', () => {
    it('should link client between organizations', async () => {
      const mockDatabase = await import('../database.js')
      
      vi.mocked(mockDatabase.database.rpc).mockResolvedValueOnce({
        data: 'link-123',
        error: null
      })

      const result = await service.linkClient(
        'user-123',
        'client-123',
        'org-456',
        'Care coordination',
        'consent-123'
      )

      expect(result).toEqual({ link_id: 'link-123' })
      expect(mockDatabase.database.rpc).toHaveBeenCalledWith('rpc_link_client', {
        p_client_id: 'client-123',
        p_to_org_id: 'org-456',
        p_reason: 'Care coordination',
        p_consent_id: 'consent-123'
      })
    })
  })

  describe('detectDuplicates', () => {
    it('should detect duplicate clients by fingerprint', async () => {
      const mockDatabase = await import('../database.js')
      
      const mockResults = [
        {
          id: 'client-456',
          initials: 'JD',
          approximate_age: 30,
          fingerprint_match: true,
          same_org: false,
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      vi.mocked(mockDatabase.database.rpc).mockResolvedValueOnce({
        data: mockResults,
        error: null
      })

      const result = await service.detectDuplicates('user-123', 'fp_abc123')

      expect(result).toEqual(mockResults)
      expect(mockDatabase.database.rpc).toHaveBeenCalledWith('rpc_search_clients', {
        p_search_term: null,
        p_fingerprint: 'fp_abc123',
        p_limit: 10
      })
    })
  })

  describe('utility methods', () => {
    it('should generate initials correctly', () => {
      const service = new ClientService()
      
      // Access private method for testing
      const generateInitials = (service as any).generateInitials
      
      expect(generateInitials({ first_name: 'John', last_name: 'Doe' })).toBe('JD')
      expect(generateInitials({ first_name: 'jane', last_name: 'smith' })).toBe('JS')
      expect(generateInitials({})).toBe('N/A')
      expect(generateInitials(null)).toBe('N/A')
    })

    it('should calculate approximate age correctly', () => {
      const service = new ClientService()
      
      // Access private method for testing
      const calculateApproximateAge = (service as any).calculateApproximateAge
      
      // Test with actual current date calculation
      const currentYear = new Date().getFullYear()
      const age1990 = Math.floor((currentYear - 1990) / 5) * 5
      const age2000 = Math.floor((currentYear - 2000) / 5) * 5
      
      expect(calculateApproximateAge('1990-01-01')).toBe(age1990)
      expect(calculateApproximateAge('2000-01-01')).toBe(age2000)
      expect(calculateApproximateAge(null)).toBe(null)
    })
  })
})

/**
 * Test utilities for client service testing
 */
export const createMockClient = (overrides = {}) => ({
  id: 'client-123',
  tenant_root_id: 'org-123',
  owner_org_id: 'org-123',
  primary_location_id: null,
  pii_ref: {
    first_name: 'John',
    last_name: 'Doe',
    dob: '1990-01-01'
  },
  flags: { high_risk: false },
  fingerprint: 'fp_abc123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockAuthContext = (overrides = {}) => ({
  purpose: 'care' as const,
  consent_ok: true,
  contains_phi: true,
  tenant_root_id: 'org-123',
  ...overrides
})