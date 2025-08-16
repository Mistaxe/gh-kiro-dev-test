// Context builders for different resource types
export { BaseContextBuilder, createContextBuilder, createLegacyContextBuilder } from './base-context-builder.js';
export { ClientContextBuilder, createClientContextBuilder } from './client-context-builder.js';
export { NoteContextBuilder, createNoteContextBuilder } from './note-context-builder.js';
export { ReferralContextBuilder, createReferralContextBuilder } from './referral-context-builder.js';
export { CaseContextBuilder, createCaseContextBuilder } from './case-context-builder.js';
export { ServiceProfileContextBuilder } from './service-profile-context-builder.js';
export { AvailabilityContextBuilder } from './availability-context-builder.js';
// Import classes for factory function
import { BaseContextBuilder } from './base-context-builder.js';
import { ClientContextBuilder } from './client-context-builder.js';
import { NoteContextBuilder } from './note-context-builder.js';
import { ReferralContextBuilder } from './referral-context-builder.js';
import { CaseContextBuilder } from './case-context-builder.js';
import { ServiceProfileContextBuilder } from './service-profile-context-builder.js';
import { AvailabilityContextBuilder } from './availability-context-builder.js';
// Factory function to create appropriate context builder for resource type
export function createResourceContextBuilder(resourceType) {
    switch (resourceType) {
        case 'client':
            return new ClientContextBuilder();
        case 'note':
            return new NoteContextBuilder();
        case 'referral':
            return new ReferralContextBuilder();
        case 'case':
            return new CaseContextBuilder();
        case 'service_profile':
            return new ServiceProfileContextBuilder();
        case 'availability':
            return new AvailabilityContextBuilder();
        case 'report':
            return new BaseContextBuilder(); // Use base builder for reports
        default:
            throw new Error(`Unknown resource type: ${resourceType}`);
    }
}
//# sourceMappingURL=index.js.map