import { describe, it, expect, beforeEach } from 'vitest';
import { AvailabilityService } from '../availability-service.js';

// Mock Supabase client for testing
let updateCallCount = 0;

const mockSupabase = {
  rpc: async (functionName: string, params: any) => {
    // Mock implementation for testing concurrent updates
    if (functionName === 'rpc_update_availability') {
      updateCallCount++;
      
      // First call succeeds, second call with same version fails
      if (updateCallCount === 1) {
        return {
          data: {
            success: true,
            version: 2,
            total: params.p_total || 10,
            available: params.p_available || 5,
            updated_at: new Date().toISOString()
          },
          error: null
        };
      } else {
        return {
          data: {
            success: false,
            error: 'version_conflict',
            current_version: 2,
            provided_version: params.p_version,
            message: 'Availability record has been modified by another user'
          },
          error: null
        };
      }
    }
    
    if (functionName === 'rpc_create_availability') {
      return {
        data: 'test-availability-id',
        error: null
      };
    }
    
    return { data: null, error: { message: 'Not implemented' } };
  }
} as any;

describe('Availability Concurrency Control', () => {
  let availabilityService: AvailabilityService;

  beforeEach(() => {
    updateCallCount = 0; // Reset call count
    availabilityService = new AvailabilityService(mockSupabase);
  });

  it('should successfully update availability with correct version', async () => {
    const result = await availabilityService.updateAvailability('test-id', {
      total: 10,
      available: 5,
      version: 1
    });

    expect(result.success).toBe(true);
    expect(result.version).toBe(2);
    expect(result.total).toBe(10);
    expect(result.available).toBe(5);
  });

  it('should return version conflict when version is outdated', async () => {
    const result = await availabilityService.updateAvailability('test-id', {
      total: 10,
      available: 5,
      version: 1 // This will be treated as outdated by our mock
    });

    // First update succeeds
    expect(result.success).toBe(true);

    // Second update with same version should fail
    const conflictResult = await availabilityService.updateAvailability('test-id', {
      total: 12,
      available: 6,
      version: 1 // Outdated version
    });

    expect(conflictResult.success).toBe(false);
    expect(conflictResult.error).toBe('version_conflict');
    expect(conflictResult.current_version).toBe(2);
    expect(conflictResult.provided_version).toBe(1);
  });

  it('should create availability record successfully', async () => {
    const availabilityId = await availabilityService.createAvailability({
      location_id: 'test-location-id',
      type: 'beds',
      attributes: { female: true },
      total: 10,
      available: 8
    });

    expect(availabilityId).toBe('test-availability-id');
  });
});

describe('Availability JSON Predicate Matching', () => {
  it('should demonstrate JSON predicate matching logic', () => {
    // Example client needs
    const clientNeeds = {
      gender: 'female',
      pregnant: true,
      age: 25,
      substance_use: true
    };

    // Example availability attributes
    const availabilityAttributes = {
      female: true,
      pregnant: true,
      substance_use: true,
      min_age: 18,
      max_age: 65
    };

    // In the actual implementation, this would be handled by PostgreSQL's JSONB operators
    // @> (contains) and range checks would be used in SQL
    
    // Simulate the matching logic
    const matches = (needs: any, attributes: any) => {
      // Boolean attribute matching
      if (needs.gender === 'female' && !attributes.female) return false;
      if (needs.pregnant && !attributes.pregnant) return false;
      if (needs.substance_use && !attributes.substance_use) return false;
      
      // Range matching
      if (attributes.min_age && needs.age < attributes.min_age) return false;
      if (attributes.max_age && needs.age > attributes.max_age) return false;
      
      return true;
    };

    expect(matches(clientNeeds, availabilityAttributes)).toBe(true);
    
    // Test non-matching case
    const nonMatchingAttributes = {
      female: false, // Doesn't match female client
      substance_use: true
    };
    
    expect(matches(clientNeeds, nonMatchingAttributes)).toBe(false);
  });
});

export {};