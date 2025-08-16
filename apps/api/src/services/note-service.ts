import { getDatabaseClient } from './database.js'
import type { AuthorizationContext } from '@app/shared'
import type {
  CreateNoteRequest,
  UpdateNoteRequest,
  SearchNotesQuery,
  GrantNoteAccessRequest,
  NoteResponse,
  SearchNotesResponse
} from '../schemas/notes.js'

/**
 * Note Service
 * 
 * Implements note management with helper vs provider classification,
 * confidential note access controls, and helper journal separation.
 */
export class NoteService {
  private _database?: ReturnType<typeof getDatabaseClient>
  
  private get database() {
    if (!this._database) {
      this._database = getDatabaseClient()
    }
    return this._database
  }
  
  /**
   * Create a new note with proper classification
   */
  async createNote(
    userId: string,
    request: CreateNoteRequest
  ): Promise<{ id: string }> {
    try {
      const result = await this.database.rpc('rpc_create_note', {
        p_subject_type: request.subject_type,
        p_subject_id: request.subject_id,
        p_title: request.title || null,
        p_content: request.content,
        p_classification: request.classification || 'standard',
        p_tags: request.tags || [],
        p_contains_phi: request.contains_phi || false
      })

      return { id: result }
    } catch (error) {
      console.error('Error creating note:', error)
      throw error
    }
  }

  /**
   * Search notes with authorization filtering
   */
  async searchNotes(
    userId: string,
    query: SearchNotesQuery
  ): Promise<SearchNotesResponse> {
    try {
      const result = await this.database.rpc('rpc_search_notes', {
        p_subject_type: query.subject_type || null,
        p_subject_id: query.subject_id || null,
        p_search_term: query.search_term || null,
        p_tags: query.tags || [],
        p_include_helper_journals: query.include_helper_journals || false,
        p_classification: query.classification || null,
        p_limit: query.limit || 50,
        p_offset: query.offset || 0
      })

      return result as SearchNotesResponse
    } catch (error) {
      console.error('Error searching notes:', error)
      throw error
    }
  }

  /**
   * Get a specific note with authorization
   */
  async getNote(
    userId: string,
    noteId: string,
    context: AuthorizationContext
  ): Promise<NoteResponse> {
    try {
      // Use search with specific note ID to leverage existing authorization
      const searchResult = await this.searchNotes(userId, {
        limit: 1,
        offset: 0
      })

      const note = searchResult.notes.find(n => n.id === noteId)
      
      if (!note) {
        throw new Error('Note not found or access denied')
      }

      return note
    } catch (error) {
      console.error('Error getting note:', error)
      throw error
    }
  }

  /**
   * Update a note (only author can update)
   */
  async updateNote(
    userId: string,
    noteId: string,
    request: UpdateNoteRequest,
    context: AuthorizationContext
  ): Promise<void> {
    try {
      // First verify the user is the author
      const note = await this.getNote(userId, noteId, context)
      
      if (note.author.id !== userId) {
        throw new Error('Only the note author can update the note')
      }

      // Build update query dynamically
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1

      if (request.title !== undefined) {
        updates.push(`title = $${paramIndex++}`)
        values.push(request.title)
      }

      if (request.content !== undefined) {
        updates.push(`content = $${paramIndex++}`)
        values.push(request.content)
      }

      if (request.tags !== undefined) {
        updates.push(`tags = $${paramIndex++}`)
        values.push(request.tags)
      }

      if (request.contains_phi !== undefined) {
        updates.push(`contains_phi = $${paramIndex++}`)
        values.push(request.contains_phi)
      }

      if (updates.length === 0) {
        return // Nothing to update
      }

      updates.push(`updated_at = now()`)
      values.push(noteId)

      const query = `
        UPDATE app.notes 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND author_user_id = $${paramIndex + 1}
      `
      values.push(userId)

      // For now, we'll use a simplified approach since we don't have raw SQL support
      // In a real implementation, we'd create an RPC function for updates
      throw new Error('Note updates not yet implemented - requires RPC function')

    } catch (error) {
      console.error('Error updating note:', error)
      throw error
    }
  }

  /**
   * Delete a note (only author can delete)
   */
  async deleteNote(
    userId: string,
    noteId: string,
    context: AuthorizationContext
  ): Promise<void> {
    try {
      // First verify the user is the author
      const note = await this.getNote(userId, noteId, context)
      
      if (note.author.id !== userId) {
        throw new Error('Only the note author can delete the note')
      }

      // For now, we'll use a simplified approach since we don't have direct table access
      // In a real implementation, we'd create an RPC function for deletes
      throw new Error('Note deletion not yet implemented - requires RPC function')

    } catch (error) {
      console.error('Error deleting note:', error)
      throw error
    }
  }

  /**
   * Grant temporary access to a confidential note
   */
  async grantNoteAccess(
    userId: string,
    noteId: string,
    request: GrantNoteAccessRequest
  ): Promise<{ grant_id: string }> {
    try {
      const result = await this.database.rpc('rpc_grant_note_access', {
        p_note_id: noteId,
        p_granted_to_user_id: request.granted_to_user_id,
        p_reason: request.reason,
        p_duration_hours: request.duration_hours || 24
      })

      return { grant_id: result }
    } catch (error) {
      console.error('Error granting note access:', error)
      throw error
    }
  }

  /**
   * Get notes for a specific subject (client, case, etc.)
   */
  async getNotesForSubject(
    userId: string,
    subjectType: string,
    subjectId: string,
    includeHelperJournals: boolean = false
  ): Promise<SearchNotesResponse> {
    return this.searchNotes(userId, {
      subject_type: subjectType as any,
      subject_id: subjectId,
      include_helper_journals: includeHelperJournals,
      limit: 100,
      offset: 0
    })
  }

  /**
   * Get user's recent notes
   */
  async getUserRecentNotes(
    userId: string,
    limit: number = 20
  ): Promise<SearchNotesResponse> {
    try {
      // For now, use the search function to get user's notes
      return this.searchNotes(userId, {
        limit,
        offset: 0
      })
    } catch (error) {
      console.error('Error getting user recent notes:', error)
      throw error
    }
  }
}

// Export singleton instance
export const noteService = new NoteService()