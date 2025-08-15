import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CaseService } from '../case-service.js'
import type { AuthorizationContext } from '@app/shared'

// Mock the database service
vi.mock('../database.js', () => ({
  getDatabaseClient: vi.fn(() => ({
    rpc: vi.fn()
  }))
}))

describe('CaseService', () => {
  let service: CaseService
  let mockDatabase: any

  beforeEach(async () => {
    service = new CaseService()
    const { getDatabaseClient } = await import('../database.js')
    mockDatabase = getDatabaseClient()
    vi.clearAllMocks()
  })

  describe('createCase', () => {
    it('should create a case with assignment validation', async () => {
      const mockCaseId = 'case-123'
      mockDatabase.rpc.mockResolvedValue(mockCaseId)

      const caseData = {
        client_id: 'client-123',
        location_id: 'location-123',
        program_ids: ['program-123'],
        assigned_user_ids: ['user-123'],
        status: 'open' as const
      }

      const result = await service.createCase('user-123', caseData)

      expect(mockDatabase.rpc).toHaveBeenCalledWith('rpc_create_case', {
        p_client_id: caseData.client_id,
        p_location_id: caseData.location_id,
        p_program_ids: caseData.program_ids,
        p_assigned_user_ids: caseData.assigned_user_ids,
        p_status: caseData.status
      })

      expect(result).toEqual({ id: mockCaseId })
    })

    it('should handle creation errors', async () => {
      mockDatabase.rpc.mockRejectedValue(new Error('insufficient_permissions'))

      const caseData = {
        client_id: 'client-123',
        location_id: 'location-123'
      }

      await expect(service.createCase('user-123', caseData))
        .rejects.toThrow('Failed to create case: insufficient_permissions')
    })
  })

  describe('getCase', () => {
    it('should return case details with full access when consent is OK', async () => {
      const mockCaseData = {
        id: 'case-123',
        client_id: 'client-123',
        location_id: 'location-123',
        status: 'open',
        program_ids: ['program-123'],
        assigned_user_ids: ['user-123'],
        opened_at: '2024-01-01T00:00:00Z',
        closed_at: null,
        client_info: {
          id: 'client-123',
          pii_ref: { first_name: 'John', last_name: 'Doe' },
          flags: { high_risk: false }
        },
        location_info: {
          id: 'location-123',
          name: 'Test Location',
          org_id: 'org-123'
        },
        assigned_users: [
          { id: 'user-123', display_name: 'John Smith', role: 'CaseManager' }
        ]
      }

      mockDatabase.rpc.mockResolvedValue([mockCaseData])

      const context: AuthorizationContext = {
        tenant_root_id: 'org-123',
        consent_ok: true,
        assigned_to_user: true,
        purpose: 'care'
      }

      const result = await service.getCase('user-123', 'case-123', context)

      expect(mockDatabase.rpc).toHaveBeenCalledWith('rpc_get_case', {
        p_case_id: 'case-123'
      })

      expect(result).toEqual({
        ...mockCaseData,
        access_level: 'full'
      })
    })

    it('should return case details with limited access when consent is missing', async () => {
      const mockCaseData = {
        id: 'case-123',
        client_id: 'client-123',
        location_id: 'location-123',
        status: 'open',
        program_ids: ['program-123'],
        assigned_user_ids: ['user-123'],
        opened_at: '2024-01-01T00:00:00Z',
        closed_at: null,
        client_info: {
          id: 'client-123',
          pii_ref: { first_name: 'John', last_name: 'Doe', dob: '1990-01-01' },
          flags: { high_risk: false }
        },
        location_info: {
          id: 'location-123',
          name: 'Test Location',
          org_id: 'org-123'
        },
        assigned_users: []
      }

      mockDatabase.rpc.mockResolvedValue([mockCaseData])

      const context: AuthorizationContext = {
        tenant_root_id: 'org-123',
        consent_ok: false,
        shares_program: true,
        purpose: 'care'
      }

      const result = await service.getCase('user-123', 'case-123', context)

      expect(result.access_level).toBe('limited')
      expect(result.client_info).toEqual({
        id: 'client-123',
        initials: 'JD',
        approximate_age: 30 // Approximate age based on 1990 birth year
      })
    })

    it('should handle case not found', async () => {
      mockDatabase.rpc.mockResolvedValue([])

      const context: AuthorizationContext = {
        tenant_root_id: 'org-123',
        consent_ok: true,
        purpose: 'care'
      }

      await expect(service.getCase('user-123', 'case-123', context))
        .rejects.toThrow('Failed to get case: Case not found')
    })
  })

  describe('updateCase', () => {
    it('should update case with assignment validation', async () => {
      mockDatabase.rpc.mockResolvedValue(undefined)

      const updates = {
        status: 'active' as const,
        program_ids: ['program-456'],
        assigned_user_ids: ['user-456']
      }

      const context: AuthorizationContext = {
        tenant_root_id: 'org-123',
        assigned_to_user: true,
        purpose: 'care'
      }

      await service.updateCase('user-123', 'case-123', updates, context)

      expect(mockDatabase.rpc).toHaveBeenCalledWith('rpc_update_case', {
        p_case_id: 'case-123',
        p_status: updates.status,
        p_program_ids: updates.program_ids,
        p_assigned_user_ids: updates.assigned_user_ids
      })
    })
  })

  describe('closeCase', () => {
    it('should close case with audit trail', async () => {
      mockDatabase.rpc.mockResolvedValue(undefined)

      const context: AuthorizationContext = {
        tenant_root_id: 'org-123',
        assigned_to_user: true,
        purpose: 'care'
      }

      await service.closeCase('user-123', 'case-123', 'Case resolved', context)

      expect(mockDatabase.rpc).toHaveBeenCalledWith('rpc_close_case', {
        p_case_id: 'case-123',
        p_reason: 'Case resolved'
      })
    })
  })

  describe('getUserCaseload', () => {
    it('should return user caseload with pagination', async () => {
      const mockCaseload = {
        cases: [
          {
            id: 'case-123',
            location_id: 'location-123',
            status: 'open',
            program_ids: ['program-123'],
            assigned_user_ids: ['user-123'],
            opened_at: '2024-01-01T00:00:00Z',
            closed_at: null,
            location_info: {
              id: 'location-123',
              name: 'Test Location',
              org_id: 'org-123'
            }
          }
        ],
        total_count: 1,
        has_more: false
      }

      mockDatabase.rpc.mockResolvedValue(mockCaseload)

      const filters = {
        status: 'open' as const,
        limit: 10,
        offset: 0
      }

      const result = await service.getUserCaseload('user-123', filters)

      expect(mockDatabase.rpc).toHaveBeenCalledWith('rpc_get_user_caseload', {
        p_status: filters.status,
        p_program_ids: [],
        p_location_id: undefined,
        p_limit: filters.limit,
        p_offset: filters.offset
      })

      expect(result).toEqual(mockCaseload)
    })
  })

  describe('getClientCases', () => {
    it('should return cases for a specific client', async () => {
      const mockCases = [
        {
          id: 'case-123',
          location_id: 'location-123',
          status: 'open',
          program_ids: ['program-123'],
          assigned_user_ids: ['user-123'],
          opened_at: '2024-01-01T00:00:00Z',
          closed_at: null,
          location_info: {
            id: 'location-123',
            name: 'Test Location',
            org_id: 'org-123'
          }
        }
      ]

      mockDatabase.rpc.mockResolvedValue(mockCases)

      const context: AuthorizationContext = {
        tenant_root_id: 'org-123',
        consent_ok: true,
        purpose: 'care'
      }

      const result = await service.getClientCases('user-123', 'client-123', context)

      expect(mockDatabase.rpc).toHaveBeenCalledWith('rpc_get_client_cases', {
        p_client_id: 'client-123'
      })

      expect(result).toEqual(mockCases.map(caseData => ({
        ...caseData,
        access_level: 'full'
      })))
    })
  })

  describe('assignUsersToCase', () => {
    it('should assign users to case with validation', async () => {
      mockDatabase.rpc.mockResolvedValue(undefined)

      await service.assignUsersToCase('user-123', 'case-123', ['user-456'], 'Adding specialist')

      expect(mockDatabase.rpc).toHaveBeenCalledWith('rpc_assign_users_to_case', {
        p_case_id: 'case-123',
        p_user_ids: ['user-456'],
        p_reason: 'Adding specialist'
      })
    })
  })

  describe('unassignUsersFromCase', () => {
    it('should unassign users from case with audit trail', async () => {
      mockDatabase.rpc.mockResolvedValue(undefined)

      await service.unassignUsersFromCase('user-123', 'case-123', ['user-456'], 'Case transfer')

      expect(mockDatabase.rpc).toHaveBeenCalledWith('rpc_unassign_users_from_case', {
        p_case_id: 'case-123',
        p_user_ids: ['user-456'],
        p_reason: 'Case transfer'
      })
    })
  })

  describe('utility methods', () => {
    it('should determine access level correctly', async () => {
      const service = new CaseService()
      
      // Access private method for testing
      const determineAccessLevel = (service as any).determineAccessLevel.bind(service)
      
      expect(determineAccessLevel({ assigned_to_user: true, consent_ok: true })).toBe('full')
      expect(determineAccessLevel({ shares_program: true })).toBe('limited')
      expect(determineAccessLevel({ same_location: true })).toBe('limited')
      expect(determineAccessLevel({})).toBe('minimal')
    })

    it('should generate initials correctly', async () => {
      const service = new CaseService()
      
      // Access private method for testing
      const generateInitials = (service as any).generateInitials.bind(service)
      
      expect(generateInitials({ first_name: 'John', last_name: 'Doe' })).toBe('JD')
      expect(generateInitials({ first_name: 'Jane' })).toBe('N/A')
      expect(generateInitials({})).toBe('N/A')
      expect(generateInitials(null)).toBe('N/A')
    })

    it('should calculate approximate age correctly', async () => {
      const service = new CaseService()
      
      // Access private method for testing
      const calculateApproximateAge = (service as any).calculateApproximateAge.bind(service)
      
      expect(calculateApproximateAge('1990-01-01')).toBe(30) // Rounded to 5-year band
      expect(calculateApproximateAge('1985-01-01')).toBe(35) // Rounded to 5-year band
      expect(calculateApproximateAge(null)).toBe(null)
      expect(calculateApproximateAge(undefined)).toBe(null)
    })
  })
})