/**
 * Authorization Context - Shared contract between API and Lab
 *
 * This interface defines the complete context object used for authorization
 * decisions across the platform. It includes all possible fields that may
 * be evaluated by Casbin policies.
 */
export interface AuthorizationContext {
    purpose?: 'care' | 'billing' | 'QA' | 'oversight' | 'research';
    legal_basis?: boolean;
    dataset?: {
        deidentified: boolean;
    };
    identified_ok?: boolean;
    contains_phi?: boolean;
    org_scope?: boolean;
    same_org?: boolean;
    same_location?: boolean;
    in_network?: boolean;
    tenant_root_id: string;
    delegated_fields?: string[];
    field?: string;
    service?: {
        claimed: boolean;
    };
    assigned_to_user?: boolean;
    shares_program?: boolean;
    program_access_level?: 'view' | 'write' | 'full' | null;
    consent_ok?: boolean;
    consent_id?: string | null;
    self_scope?: boolean;
    affiliated?: boolean;
    temp_grant?: boolean;
    two_person_rule?: boolean;
    bg?: boolean;
    bg_expires_at?: string | null;
    policy_version?: string;
    correlation_id?: string;
}
/**
 * Context Builder Interface
 *
 * Defines the contract for building authorization contexts for different
 * resource types. Each resource type may have specific context requirements.
 */
export interface ContextBuilder {
    /**
     * Build context for client-related operations
     */
    buildClientContext(userId: string, clientId: string, action: string, additionalContext?: Partial<AuthorizationContext>): Promise<AuthorizationContext>;
    /**
     * Build context for note-related operations
     */
    buildNoteContext(userId: string, noteId: string, action: string, additionalContext?: Partial<AuthorizationContext>): Promise<AuthorizationContext>;
    /**
     * Build context for referral-related operations
     */
    buildReferralContext(userId: string, referralId: string, action: string, additionalContext?: Partial<AuthorizationContext>): Promise<AuthorizationContext>;
    /**
     * Build context for report-related operations
     */
    buildReportContext(userId: string, reportType: string, action: string, additionalContext?: Partial<AuthorizationContext>): Promise<AuthorizationContext>;
    /**
     * Build base context with common fields
     */
    buildBaseContext(userId: string, additionalContext?: Partial<AuthorizationContext>): Promise<Partial<AuthorizationContext>>;
}
/**
 * Authorization Decision Result
 *
 * Represents the result of an authorization decision with full context
 * for audit logging and debugging.
 */
export interface AuthorizationDecision {
    decision: 'allow' | 'deny';
    subject: {
        role: string;
        user_id: string;
    };
    object: {
        type: string;
        id: string;
    };
    action: string;
    context: AuthorizationContext;
    matched_policy?: string;
    reasoning: string;
    policy_version: string;
    timestamp: string;
    correlation_id: string;
}
/**
 * Policy Simulation Result
 *
 * Extended result for policy simulation that includes additional
 * debugging information.
 */
export interface PolicySimulationResult extends AuthorizationDecision {
    context_snapshot: AuthorizationContext;
    evaluation_steps?: string[];
    warnings?: string[];
}
/**
 * Consent Evaluation Result
 *
 * Result of consent evaluation for PHI access decisions.
 */
export interface ConsentResult {
    consent_ok: boolean;
    consent_id?: string;
    reason: string;
    grace_period_active?: boolean;
    expires_at?: string;
    scope_type?: 'platform' | 'organization' | 'location' | 'helper' | 'company';
    allowed_purposes?: string[];
}
/**
 * Validation helpers for AuthorizationContext
 */
export declare class AuthorizationContextValidator {
    /**
     * Validate that mandatory fields are present in the context
     */
    static validateMandatoryFields(context: AuthorizationContext): string[];
    /**
     * Validate context consistency
     */
    static validateConsistency(context: AuthorizationContext): string[];
}
