import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';

interface SeederConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  regions?: number;
  networksPerRegion?: number;
  orgsPerNetwork?: number;
  locationsPerOrg?: number;
  usersPerOrg?: number;
  clientsPerOrg?: number;
  casesPerClient?: number;
  availabilityPerLocation?: number;
  referralsPerOrg?: number;
}

interface SeederProgress {
  step: string;
  current: number;
  total: number;
  message: string;
}

export class DataSeeder {
  private supabase: any;
  private config: SeederConfig;
  private progressCallback?: (progress: SeederProgress) => void;

  constructor(config: SeederConfig, progressCallback?: (progress: SeederProgress) => void) {
    this.config = {
      regions: 3,
      networksPerRegion: 2,
      orgsPerNetwork: 4,
      locationsPerOrg: 2,
      usersPerOrg: 8,
      clientsPerOrg: 15,
      casesPerClient: 1,
      availabilityPerLocation: 3,
      referralsPerOrg: 5,
      ...config
    };
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.progressCallback = progressCallback;
  }

  private reportProgress(step: string, current: number, total: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ step, current, total, message });
    }
  }

  async seedAll(): Promise<void> {
    console.log('Starting comprehensive data seeding...');
    
    try {
      // Step 1: Seed regions
      const regions = await this.seedRegions();
      
      // Step 2: Seed networks
      const networks = await this.seedNetworks(regions);
      
      // Step 3: Seed organizations
      const organizations = await this.seedOrganizations(networks);
      
      // Step 4: Seed service locations
      const locations = await this.seedServiceLocations(organizations);
      
      // Step 5: Seed users with role assignments
      const users = await this.seedUsers(organizations);
      
      // Step 6: Seed clients
      const clients = await this.seedClients(organizations, users);
      
      // Step 7: Seed client cases
      await this.seedClientCases(clients, locations, users);
      
      // Step 8: Seed availability data
      await this.seedAvailability(locations, users);
      
      // Step 9: Seed referrals
      await this.seedReferrals(organizations, clients, locations, users);
      
      // Step 10: Seed consent data
      await this.seedConsents(clients, organizations, users);
      
      console.log('Data seeding completed successfully!');
    } catch (error) {
      console.error('Seeding failed:', error);
      throw error;
    }
  }

  async seedRegions(): Promise<any[]> {
    this.reportProgress('regions', 0, this.config.regions!, 'Creating regions...');
    
    const regions = [];
    for (let i = 0; i < this.config.regions!; i++) {
      const region = {
        id: faker.string.uuid(),
        name: faker.location.state(),
        jurisdiction: {
          state: faker.location.state(),
          country: 'US',
          timezone: faker.location.timeZone()
        },
        attributes: {
          population: faker.number.int({ min: 100000, max: 5000000 }),
          area_sq_miles: faker.number.int({ min: 1000, max: 50000 })
        }
      };
      
      const { error } = await this.supabase
        .from('regions')
        .insert(region);
      
      if (error) throw error;
      regions.push(region);
      
      this.reportProgress('regions', i + 1, this.config.regions!, `Created region: ${region.name}`);
    }
    
    return regions;
  }

  async seedNetworks(regions: any[]): Promise<any[]> {
    const totalNetworks = regions.length * this.config.networksPerRegion!;
    this.reportProgress('networks', 0, totalNetworks, 'Creating networks...');
    
    const networks = [];
    let current = 0;
    
    for (const region of regions) {
      for (let i = 0; i < this.config.networksPerRegion!; i++) {
        const network = {
          id: faker.string.uuid(),
          region_id: region.id,
          name: `${region.name} ${faker.company.name()} Network`,
          attributes: {
            type: faker.helpers.arrayElement(['healthcare', 'behavioral_health', 'social_services']),
            established: faker.date.past({ years: 20 }).getFullYear(),
            member_count: faker.number.int({ min: 5, max: 50 })
          }
        };
        
        const { error } = await this.supabase
          .schema('app')
          .from('networks')
          .insert(network);
        
        if (error) throw error;
        networks.push({ ...network, region });
        
        current++;
        this.reportProgress('networks', current, totalNetworks, `Created network: ${network.name}`);
      }
    }
    
    return networks;
  }

  async seedOrganizations(networks: any[]): Promise<any[]> {
    const totalOrgs = networks.length * this.config.orgsPerNetwork!;
    this.reportProgress('organizations', 0, totalOrgs, 'Creating organizations...');
    
    const organizations = [];
    let current = 0;
    
    for (const network of networks) {
      for (let i = 0; i < this.config.orgsPerNetwork!; i++) {
        const orgId = faker.string.uuid();
        const organization = {
          id: orgId,
          region_id: network.region_id,
          name: faker.company.name(),
          org_type: faker.helpers.arrayElement(['hospital', 'clinic', 'community_center', 'nonprofit']),
          dba: faker.company.name(),
          tenant_root_id: orgId, // Self-referencing for tenant isolation
          attributes: {
            license_number: faker.string.alphanumeric(10).toUpperCase(),
            established: faker.date.past({ years: 30 }).getFullYear(),
            staff_count: faker.number.int({ min: 10, max: 200 }),
            specialties: faker.helpers.arrayElements([
              'substance_abuse', 'mental_health', 'family_services', 
              'crisis_intervention', 'outpatient', 'residential'
            ], { min: 1, max: 3 })
          }
        };
        
        const { error } = await this.supabase
          .schema('app')
          .from('organizations')
          .insert(organization);
        
        if (error) throw error;
        organizations.push({ ...organization, network });
        
        current++;
        this.reportProgress('organizations', current, totalOrgs, `Created organization: ${organization.name}`);
      }
    }
    
    return organizations;
  }

  async seedServiceLocations(organizations: any[]): Promise<any[]> {
    const totalLocations = organizations.length * this.config.locationsPerOrg!;
    this.reportProgress('locations', 0, totalLocations, 'Creating service locations...');
    
    const locations = [];
    let current = 0;
    
    for (const org of organizations) {
      for (let i = 0; i < this.config.locationsPerOrg!; i++) {
        const location = {
          id: faker.string.uuid(),
          org_id: org.id,
          name: `${org.name} - ${faker.helpers.arrayElement(['Main Campus', 'North Branch', 'South Branch', 'Downtown', 'Outreach Center'])}`,
          claimed: faker.datatype.boolean(0.7), // 70% claimed
          claim_owner_user_id: null, // Will be set when we create users
          attributes: {
            address: {
              street: faker.location.streetAddress(),
              city: faker.location.city(),
              state: faker.location.state(),
              zip: faker.location.zipCode()
            },
            phone: faker.phone.number(),
            capacity: faker.number.int({ min: 20, max: 100 }),
            services: faker.helpers.arrayElements([
              'individual_therapy', 'group_therapy', 'crisis_intervention',
              'case_management', 'peer_support', 'medication_management'
            ], { min: 2, max: 4 })
          }
        };
        
        const { error } = await this.supabase
          .schema('app')
          .from('service_locations')
          .insert(location);
        
        if (error) throw error;
        locations.push({ ...location, organization: org });
        
        current++;
        this.reportProgress('locations', current, totalLocations, `Created location: ${location.name}`);
      }
    }
    
    return locations;
  }

  async seedUsers(organizations: any[]): Promise<any[]> {
    const totalUsers = organizations.length * this.config.usersPerOrg!;
    this.reportProgress('users', 0, totalUsers, 'Creating users and role assignments...');
    
    const users = [];
    let current = 0;
    
    // First, get available roles
    const { data: roles, error: rolesError } = await this.supabase
      .schema('app')
      .from('roles')
      .select('*');
    
    if (rolesError) throw rolesError;
    
    for (const org of organizations) {
      for (let i = 0; i < this.config.usersPerOrg!; i++) {
        const userId = faker.string.uuid();
        const authUserId = faker.string.uuid();
        const isHelper = faker.datatype.boolean(0.3); // 30% helpers
        
        const user = {
          id: userId,
          auth_user_id: authUserId,
          email: faker.internet.email(),
          display_name: faker.person.fullName(),
          phone: faker.phone.number(),
          is_helper: isHelper
        };
        
        const { error: userError } = await this.supabase
          .schema('app')
          .from('users_profile')
          .insert(user);
        
        if (userError) throw userError;
        
        // Assign roles based on user type
        const roleAssignments = [];
        if (isHelper) {
          // Helper roles
          const helperRole = faker.helpers.arrayElement(
            roles.filter((r: any) => r.name.includes('Helper'))
          );
          if (helperRole) {
            roleAssignments.push({
              id: faker.string.uuid(),
              user_id: userId,
              role_id: helperRole.id,
              scope_type: 'org',
              scope_id: org.id,
              source: 'seeder'
            });
          }
        } else {
          // Provider roles
          const providerRoles = roles.filter((r: any) => 
            ['CaseManager', 'Provider', 'OrgAdmin', 'LocationManager'].includes(r.name)
          );
          const assignedRole = faker.helpers.arrayElement(providerRoles);
          
          if (assignedRole) {
            roleAssignments.push({
              id: faker.string.uuid(),
              user_id: userId,
              role_id: assignedRole.id,
              scope_type: assignedRole.name === 'LocationManager' ? 'location' : 'org',
              scope_id: org.id,
              source: 'seeder'
            });
          }
        }
        
        // Insert role assignments
        if (roleAssignments.length > 0) {
          const { error: roleError } = await this.supabase
            .schema('app')
            .from('role_assignments')
            .insert(roleAssignments);
          
          if (roleError) throw roleError;
        }
        
        users.push({ ...user, organization: org, roleAssignments });
        
        current++;
        this.reportProgress('users', current, totalUsers, `Created user: ${user.display_name}`);
      }
    }
    
    return users;
  }

  async seedClients(organizations: any[], users: any[]): Promise<any[]> {
    const totalClients = organizations.length * this.config.clientsPerOrg!;
    this.reportProgress('clients', 0, totalClients, 'Creating clients...');
    
    const clients = [];
    let current = 0;
    
    for (const org of organizations) {
      for (let i = 0; i < this.config.clientsPerOrg!; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const dob = faker.date.birthdate({ min: 18, max: 80, mode: 'age' });
        
        const client = {
          id: faker.string.uuid(),
          tenant_root_id: org.id,
          owner_org_id: org.id,
          primary_location_id: null, // Will be set when creating cases
          pii_ref: {
            first_name: firstName,
            last_name: lastName,
            dob: dob.toISOString().split('T')[0],
            ssn_last4: faker.string.numeric(4),
            phone: faker.phone.number(),
            email: faker.internet.email({ firstName, lastName })
          },
          flags: {
            high_risk: faker.datatype.boolean(0.2),
            requires_interpreter: faker.datatype.boolean(0.1),
            preferred_language: faker.helpers.arrayElement(['en', 'es', 'fr', 'zh']),
            emergency_contact: {
              name: faker.person.fullName(),
              phone: faker.phone.number(),
              relationship: faker.helpers.arrayElement(['spouse', 'parent', 'sibling', 'friend'])
            }
          },
          fingerprint: null // Will be generated by the database function
        };
        
        const { error } = await this.supabase
          .schema('app')
          .from('clients')
          .insert(client);
        
        if (error) throw error;
        clients.push({ ...client, organization: org });
        
        current++;
        this.reportProgress('clients', current, totalClients, `Created client: ${firstName} ${lastName}`);
      }
    }
    
    return clients;
  }

  async seedClientCases(clients: any[], locations: any[], users: any[]): Promise<void> {
    const totalCases = clients.length * this.config.casesPerClient!;
    this.reportProgress('cases', 0, totalCases, 'Creating client cases...');
    
    let current = 0;
    
    for (const client of clients) {
      // Find locations in the same org as the client
      const orgLocations = locations.filter(l => l.organization.id === client.organization.id);
      // Find users in the same org as the client
      const orgUsers = users.filter(u => u.organization.id === client.organization.id);
      
      if (orgLocations.length === 0 || orgUsers.length === 0) continue;
      
      for (let i = 0; i < this.config.casesPerClient!; i++) {
        const location = faker.helpers.arrayElement(orgLocations);
        const assignedUsers = faker.helpers.arrayElements(
          orgUsers.filter(u => !u.is_helper), 
          { min: 1, max: 2 }
        );
        
        const clientCase = {
          id: faker.string.uuid(),
          client_id: client.id,
          location_id: location.id,
          status: faker.helpers.arrayElement(['open', 'active', 'pending', 'closed']),
          program_ids: [faker.string.uuid()], // Mock program IDs
          assigned_user_ids: assignedUsers.map(u => u.id),
          opened_at: faker.date.recent({ days: 90 }),
          closed_at: faker.datatype.boolean(0.3) ? faker.date.recent({ days: 30 }) : null
        };
        
        const { error } = await this.supabase
          .schema('app')
          .from('client_cases')
          .insert(clientCase);
        
        if (error) throw error;
        
        current++;
        this.reportProgress('cases', current, totalCases, `Created case for client: ${client.pii_ref.first_name}`);
      }
    }
  }

  async seedAvailability(locations: any[], users: any[]): Promise<void> {
    const totalAvailability = locations.length * this.config.availabilityPerLocation!;
    this.reportProgress('availability', 0, totalAvailability, 'Creating availability records...');
    
    let current = 0;
    
    for (const location of locations) {
      // Find a user from the same org to be the updater
      const orgUsers = users.filter(u => u.organization.id === location.organization.id);
      if (orgUsers.length === 0) continue;
      
      const updater = faker.helpers.arrayElement(orgUsers);
      
      for (let i = 0; i < this.config.availabilityPerLocation!; i++) {
        const type = faker.helpers.arrayElement(['beds', 'slots', 'appointments']);
        const total = faker.number.int({ min: 5, max: 50 });
        const available = faker.number.int({ min: 0, max: total });
        
        const availability = {
          id: faker.string.uuid(),
          location_id: location.id,
          type,
          attributes: {
            // Boolean attributes for matching
            female: faker.datatype.boolean(),
            pregnant: faker.datatype.boolean(0.1),
            substance_use: faker.datatype.boolean(0.6),
            mental_health: faker.datatype.boolean(0.8),
            crisis: faker.datatype.boolean(0.3),
            // Range attributes
            min_age: faker.number.int({ min: 12, max: 18 }),
            max_age: faker.number.int({ min: 65, max: 99 }),
            // Service attributes
            service_type: faker.helpers.arrayElement(['inpatient', 'outpatient', 'residential', 'intensive_outpatient']),
            insurance_accepted: faker.helpers.arrayElements(['medicaid', 'medicare', 'private', 'self_pay'], { min: 1, max: 3 })
          },
          total,
          available,
          version: 1,
          updated_by: updater.id,
          updated_at: faker.date.recent({ days: 7 }),
          created_at: faker.date.recent({ days: 30 })
        };
        
        const { error } = await this.supabase
          .schema('app')
          .from('availability')
          .insert(availability);
        
        if (error) throw error;
        
        current++;
        this.reportProgress('availability', current, totalAvailability, `Created ${type} availability for ${location.name}`);
      }
    }
  }

  async seedReferrals(organizations: any[], clients: any[], locations: any[], users: any[]): Promise<void> {
    const totalReferrals = organizations.length * this.config.referralsPerOrg!;
    this.reportProgress('referrals', 0, totalReferrals, 'Creating referrals...');
    
    let current = 0;
    
    for (const org of organizations) {
      const orgClients = clients.filter(c => c.organization.id === org.id);
      const orgUsers = users.filter(u => u.organization.id === org.id);
      const orgLocations = locations.filter(l => l.organization.id === org.id);
      
      if (orgClients.length === 0 || orgUsers.length === 0 || orgLocations.length === 0) continue;
      
      for (let i = 0; i < this.config.referralsPerOrg!; i++) {
        const client = faker.helpers.arrayElement(orgClients);
        const fromUser = faker.helpers.arrayElement(orgUsers);
        const toLocation = faker.helpers.arrayElement(locations); // Can be any location
        
        const referral = {
          id: faker.string.uuid(),
          from_user_id: fromUser.id,
          to_location_id: toLocation.id,
          client_id: client.id,
          type: faker.helpers.arrayElement(['direct', 'record_keeping']),
          visibility_scope: faker.helpers.arrayElement(['public', 'network', 'organization']),
          status: faker.helpers.arrayElement(['pending', 'accepted', 'declined', 'completed']),
          priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
          reason: faker.lorem.sentence(),
          notes: faker.lorem.paragraph(),
          contains_phi: faker.datatype.boolean(0.7),
          created_at: faker.date.recent({ days: 30 }),
          updated_at: faker.date.recent({ days: 15 })
        };
        
        const { error } = await this.supabase
          .schema('app')
          .from('referrals')
          .insert(referral);
        
        if (error) throw error;
        
        current++;
        this.reportProgress('referrals', current, totalReferrals, `Created referral from ${fromUser.display_name}`);
      }
    }
  }

  async seedConsents(clients: any[], organizations: any[], users: any[]): Promise<void> {
    const totalConsents = clients.length * 2; // Platform + org consent per client
    this.reportProgress('consents', 0, totalConsents, 'Creating consent records...');
    
    let current = 0;
    
    for (const client of clients) {
      const orgUsers = users.filter(u => u.organization.id === client.organization.id);
      if (orgUsers.length === 0) continue;
      
      const grantedBy = faker.helpers.arrayElement(orgUsers);
      
      // Platform consent
      const platformConsent = {
        id: faker.string.uuid(),
        client_id: client.id,
        scope_type: 'platform',
        scope_id: null,
        allowed_purposes: ['care', 'billing'],
        method: faker.helpers.arrayElement(['verbal', 'signature']),
        evidence_uri: faker.datatype.boolean(0.3) ? faker.internet.url() : null,
        granted_by: grantedBy.id,
        granted_at: faker.date.recent({ days: 60 }),
        expires_at: faker.date.future({ years: 1 }),
        grace_period_minutes: 0
      };
      
      const { error: platformError } = await this.supabase
        .schema('app')
        .from('client_consents')
        .insert(platformConsent);
      
      if (platformError) throw platformError;
      current++;
      
      // Organization consent
      const orgConsent = {
        id: faker.string.uuid(),
        client_id: client.id,
        scope_type: 'organization',
        scope_id: client.organization.id,
        allowed_purposes: faker.helpers.arrayElements(['care', 'billing', 'QA', 'oversight'], { min: 1, max: 3 }),
        method: faker.helpers.arrayElement(['verbal', 'signature']),
        evidence_uri: faker.datatype.boolean(0.3) ? faker.internet.url() : null,
        granted_by: grantedBy.id,
        granted_at: faker.date.recent({ days: 60 }),
        expires_at: faker.date.future({ years: 1 }),
        grace_period_minutes: faker.helpers.arrayElement([0, 15, 30])
      };
      
      const { error: orgError } = await this.supabase
        .schema('app')
        .from('client_consents')
        .insert(orgConsent);
      
      if (orgError) throw orgError;
      current++;
      
      this.reportProgress('consents', current, totalConsents, `Created consents for ${client.pii_ref.first_name}`);
    }
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up seeded data...');
    
    const tables = [
      'client_consents',
      'client_cases', 
      'clients',
      'referrals',
      'availability',
      'role_assignments',
      'users_profile',
      'service_locations',
      'organizations',
      'networks',
      'regions'
    ];
    
    for (const table of tables) {
      this.reportProgress('cleanup', 0, tables.length, `Cleaning ${table}...`);
      
      const { error } = await this.supabase
        .schema('app')
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except impossible ID
      
      if (error && !error.message.includes('No rows found')) {
        console.warn(`Warning cleaning ${table}:`, error.message);
      }
    }
    
    console.log('Cleanup completed!');
  }

  async validateSeededData(): Promise<any> {
    console.log('Validating seeded data...');
    
    const validation = {
      regions: 0,
      networks: 0,
      organizations: 0,
      locations: 0,
      users: 0,
      clients: 0,
      cases: 0,
      availability: 0,
      referrals: 0,
      consents: 0
    };
    
    const tables = Object.keys(validation);
    const tableMap: Record<string, string> = {
      regions: 'regions',
      networks: 'networks', 
      organizations: 'organizations',
      locations: 'service_locations',
      users: 'users_profile',
      clients: 'clients',
      cases: 'client_cases',
      availability: 'availability',
      referrals: 'referrals',
      consents: 'client_consents'
    };
    
    for (const key of tables) {
      const { count, error } = await this.supabase
        .schema('app')
        .from(tableMap[key])
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.warn(`Error counting ${key}:`, error.message);
      } else {
        validation[key as keyof typeof validation] = count || 0;
      }
    }
    
    console.log('Validation results:', validation);
    return validation;
  }
}