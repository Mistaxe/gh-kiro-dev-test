'use client'

import { useState } from 'react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export interface RLSTable {
  name: string
  schema: string
  description: string
  tenant_scoped: boolean
}

export interface RLSQueryRequest {
  table: string
  persona_id: string
  filters?: Record<string, any>
  limit?: number
  columns?: string[]
}

export interface RLSQueryResult {
  success: boolean
  table: string
  persona_id: string
  row_count: number
  total_count: number
  rows: Record<string, any>[]
  query_info: {
    executed_at: string
    execution_time_ms: number
    filters_applied: Record<string, any>
  }
}

export function useRLSTesting() {
  const [tables, setTables] = useState<RLSTable[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTables = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/dev/rls/tables`)
      if (!response.ok) {
        throw new Error(`Failed to fetch tables: ${response.statusText}`)
      }
      
      const data = await response.json()
      setTables(data.tables || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Failed to fetch RLS tables:', err)
    } finally {
      setLoading(false)
    }
  }

  const executeQuery = async (request: RLSQueryRequest): Promise<RLSQueryResult> => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/dev/rls/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.reason || `Failed to execute query: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Failed to execute RLS query:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    tables,
    loading,
    error,
    fetchTables,
    executeQuery
  }
}