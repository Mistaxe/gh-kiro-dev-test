/**
 * Validation helpers for AuthorizationContext
 */
export class AuthorizationContextValidator {
    /**
     * Validate that mandatory fields are present in the context
     */
    static validateMandatoryFields(context) {
        const errors = [];
        // tenant_root_id is always required for tenant isolation
        if (!context.tenant_root_id) {
            errors.push('tenant_root_id is required for all authorization contexts');
        }
        // PHI access requires consent validation
        if (context.contains_phi && context.consent_ok === undefined) {
            errors.push('consent_ok must be evaluated when contains_phi is true');
        }
        // Break-glass access requires expiration timestamp
        if (context.bg && !context.bg_expires_at) {
            errors.push('bg_expires_at is required when break-glass is active');
        }
        // Purpose is required for PHI access
        if (context.contains_phi && !context.purpose) {
            errors.push('purpose is required for PHI access');
        }
        return errors;
    }
    /**
     * Validate context consistency
     */
    static validateConsistency(context) {
        const errors = [];
        // Break-glass expiration should be in the future
        if (context.bg && context.bg_expires_at) {
            const expiresAt = new Date(context.bg_expires_at);
            if (expiresAt <= new Date()) {
                errors.push('break-glass access has expired');
            }
        }
        // Consent should have an ID if it's OK
        if (context.consent_ok && !context.consent_id) {
            errors.push('consent_id should be provided when consent_ok is true');
        }
        return errors;
    }
}
