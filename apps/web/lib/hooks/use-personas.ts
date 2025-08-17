'use client'

import { useState, useEffect } from 'react'
import { 
  Persona, 
  PersonaSession, 
  ImpersonationRequest, 
  ScopeSelectionRequest 
} from '@app/shared'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPersonas = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/dev/personas`)
      if (!response.ok) {
        throw new Error(`Failed to fetch personas: ${response.statusText}`)
      }
      
      const data = await response.json()
      setPersonas(data.personas || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Failed to fetch personas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPersonas()
  }, [])

  return {
    personas,
    loading,
    error,
    refetch: fetchPersonas
  }
}

export function usePersonaSession() {
  const [currentSession, setCurrentSession] = useState<PersonaSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startImpersonation = async (request: ImpersonationRequest) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/dev/personas/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.reason || `Failed to start impersonation: ${response.statusText}`)
      }
      
      const data = await response.json()
      setCurrentSession(data.session)
      
      // Store session in localStorage for persistence
      localStorage.setItem('lab_persona_session', JSON.stringify(data.session))
      
      return data.session
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Failed to start impersonation:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const updateScopeSelection = async (personaId: string, request: ScopeSelectionRequest) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/dev/personas/${personaId}/scope`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.reason || `Failed to update scope: ${response.statusText}`)
      }
      
      const data = await response.json()
      setCurrentSession(data.session)
      
      // Update session in localStorage
      localStorage.setItem('lab_persona_session', JSON.stringify(data.session))
      
      return data.session
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Failed to update scope selection:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const endImpersonation = async (personaId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/dev/personas/${personaId}/session`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.reason || `Failed to end impersonation: ${response.statusText}`)
      }
      
      setCurrentSession(null)
      localStorage.removeItem('lab_persona_session')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Failed to end impersonation:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getCurrentSession = async (personaId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/dev/personas/${personaId}/session`)
      
      if (response.status === 404) {
        setCurrentSession(null)
        localStorage.removeItem('lab_persona_session')
        return null
      }
      
      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.statusText}`)
      }
      
      const data = await response.json()
      setCurrentSession(data.session)
      return data.session
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Failed to get current session:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('lab_persona_session')
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession)
        setCurrentSession(session)
      } catch (err) {
        console.error('Failed to parse saved session:', err)
        localStorage.removeItem('lab_persona_session')
      }
    }
  }, [])

  return {
    currentSession,
    loading,
    error,
    startImpersonation,
    updateScopeSelection,
    endImpersonation,
    getCurrentSession
  }
}