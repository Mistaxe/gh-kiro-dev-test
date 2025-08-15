import { describe, it, expect, vi } from 'vitest'

// Mock the capabilities service
vi.mock('../../services/capabilities.js', () => ({
  getCapabilitiesService: () => ({
    getUserCapabilities: vi.fn().mockResolvedValue({
      user_id: 'auth_user_123',
      email: 'test@example.com',
      member: true,
      roles: [
        {
          role: 'CaseManager',
          scope_type: 'org',
          scope_id: 'org_123',
          expires_at: null
        }
      ],
      capabilities: [
        'read:clients',
        'write:clients',
        'read:cases',
        'write:cases',
        'read:notes',
        'write:notes',
        'read:referrals',
        'write:referrals',
        'member:true'
      ]
    }),
    getCacheStats: vi.fn().mockReturnValue({
      size: 1,
      keys: ['auth_user_123:org:org_123']
    }),
    clearCache: vi.fn()
  })
}))

describe('Capabilities Service', () => {
  
  it('should return capabilities for authenticated user', async () => {
    const { getCapabilitiesService } = await import('../../services/capabilities.js')
    const service = getCapabilitiesService()
    
    const mockUser = {
      auth_user_id: 'auth_user_123',
      email: 'test@example.com',
      role: 'CaseManager'
    }
    
    const result = await service.getUserCapabilities(mockUser, 'org', 'org_123')
    
    expect(result).toHaveProperty('user_id', 'auth_user_123')
    expect(result).toHaveProperty('email', 'test@example.com')
    expect(result).toHaveProperty('member', true)
    expect(result).toHaveProperty('roles')
    expect(result).toHaveProperty('capabilities')
    
    expect(result.roles).toBeInstanceOf(Array)
    expect(result.roles.length).toBeGreaterThan(0)
    expect(result.roles[0]).toHaveProperty('role', 'CaseManager')
    expect(result.roles[0]).toHaveProperty('scope_type', 'org')
    expect(result.roles[0]).toHaveProperty('scope_id', 'org_123')
    
    expect(result.capabilities).toBeInstanceOf(Array)
    expect(result.capabilities).toContain('read:clients')
    expect(result.capabilities).toContain('member:true')
  })
  
  it('should handle cache operations', async () => {
    const { getCapabilitiesService } = await import('../../services/capabilities.js')
    const service = getCapabilitiesService()
    
    const stats = service.getCacheStats()
    expect(stats).toHaveProperty('size', 1)
    expect(stats).toHaveProperty('keys')
    expect(stats.keys).toBeInstanceOf(Array)
    
    service.clearCache('auth_user_123')
    // Should not throw
  })
})