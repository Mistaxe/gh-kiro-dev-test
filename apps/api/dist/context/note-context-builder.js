import { BaseContextBuilder } from './base-context-builder.js';
/**
 * Note Context Builder
 *
 * Specialized context builder for note-related operations with
 * assignment and program sharing logic, plus helper journal separation.
 */
export class NoteContextBuilder extends BaseContextBuilder {
    /**
     * Build context for note operations with assignment and classification logic
     */
    async buildNoteContext(userId, noteId, action, additionalContext) {
        const baseContext = await this.buildBaseContext(userId, additionalContext);
        // Get note information and classification
        const noteInfo = await this.getNoteInfo(noteId);
        // Check if user is the author
        const isAuthor = noteInfo.author_user_id === userId;
        // Get assignment context for the note's subject
        const assignmentInfo = await this.getNoteAssignmentContext(noteId, userId);
        // Check organizational relationships
        const orgRelationships = await this.getNoteOrganizationalContext(noteId, userId);
        // Determine access requirements based on note classification
        const accessRequirements = this.determineAccessRequirements(noteInfo, isAuthor, action);
        return {
            tenant_root_id: noteInfo.tenant_root_id,
            ...baseContext,
            // PHI and content classification
            contains_phi: noteInfo.contains_phi,
            // Author context
            self_scope: isAuthor,
            // Assignment context (for case notes)
            assigned_to_user: assignmentInfo.assigned_to_user,
            shares_program: assignmentInfo.shares_program,
            program_access_level: assignmentInfo.program_access_level,
            // Organizational scope
            same_org: orgRelationships.same_org,
            same_location: orgRelationships.same_location,
            org_scope: orgRelationships.same_org,
            // Special access requirements
            temp_grant: accessRequirements.requires_temp_grant,
            // Helper journal separation
            ...(noteInfo.is_helper_journal && {
                // Helper journals have different access patterns
                affiliated: assignmentInfo.helper_affiliated
            })
        };
    }
    /**
     * Get note information including classification and authorship
     */
    async getNoteInfo(noteId) {
        // TODO: Replace with actual database query
        // SELECT 
        //   c.tenant_root_id,
        //   n.author_user_id,
        //   n.classification,
        //   n.is_helper_journal,
        //   n.contains_phi,
        //   n.subject_type,
        //   n.subject_id
        // FROM app.notes n
        // JOIN app.clients c ON c.id = n.subject_id AND n.subject_type = 'client'
        // WHERE n.id = $1
        return {
            tenant_root_id: 'org_123',
            author_user_id: 'user_456',
            classification: 'standard',
            is_helper_journal: false,
            contains_phi: true,
            subject_type: 'client',
            subject_id: 'client_789'
        };
    }
    /**
     * Get assignment context for the note's subject (typically a client)
     */
    async getNoteAssignmentContext(noteId, userId) {
        // TODO: Replace with actual database queries
        // This would:
        // 1. Get the note's subject (client)
        // 2. Check if user is assigned to that client's cases
        // 3. Check program sharing relationships
        // 4. For helper journals, check helper affiliation
        const noteInfo = await this.getNoteInfo(noteId);
        if (noteInfo.subject_type === 'client') {
            // Check assignment to client cases
            return this.getClientAssignmentInfo(noteInfo.subject_id, userId);
        }
        // For other subject types, return default
        return {
            assigned_to_user: false,
            shares_program: false,
            program_access_level: null
        };
    }
    /**
     * Get client assignment information
     */
    async getClientAssignmentInfo(clientId, userId) {
        // TODO: Replace with actual database queries
        // SELECT 
        //   CASE WHEN $2 = ANY(assigned_user_ids) THEN true ELSE false END as assigned,
        //   program_ids
        // FROM app.client_cases 
        // WHERE client_id = $1
        return {
            assigned_to_user: true,
            shares_program: false,
            program_access_level: 'full',
            helper_affiliated: false
        };
    }
    /**
     * Get organizational context for the note
     */
    async getNoteOrganizationalContext(noteId, userId) {
        // TODO: Replace with actual database queries
        // This would check:
        // 1. Note's tenant organization
        // 2. User's organizational memberships
        // 3. Location relationships
        return {
            same_org: true,
            same_location: false
        };
    }
    /**
     * Determine access requirements based on note classification
     */
    determineAccessRequirements(noteInfo, isAuthor, action) {
        // Confidential notes require temporary grants for non-authors
        const requires_temp_grant = noteInfo.classification === 'confidential' &&
            !isAuthor &&
            action === 'read';
        return {
            requires_temp_grant
        };
    }
}
/**
 * Factory function for note context builder
 */
export function createNoteContextBuilder() {
    return new NoteContextBuilder();
}
//# sourceMappingURL=note-context-builder.js.map