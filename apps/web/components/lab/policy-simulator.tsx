'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface SimulationRequest {
  subject: {
    role: string
    scope_type?: string
    scope_id?: string
  }
  object: {
    type: string
    id: string
    tenant_root_id?: string
  }
  action: string
  context?: {
    purpose?: string
    consent_ok?: boolean
    contains_phi?: boolean
    same_org?: boolean
    assigned_to_user?: boolean
    bg?: boolean
    tenant_root_id?: string
  }
}

interface SimulationResult {
  decision: 'allow' | 'deny'
  subject: { role: string; user_id: string }
  object: { type: string; id: string }
  action: string
  context: Record<string, any>
  matched_policy?: string
  reasoning: string
  policy_version: string
  timestamp: string
  correlation_id: string
  context_snapshot: Record<string, any>
  evaluation_steps?: string[]
}

export function PolicySimulator() {
  const [request, setRequest] = useState<SimulationRequest>({
    subject: { role: 'CaseManager' },
    object: { type: 'Client', id: 'client_123' },
    action: 'read',
    context: {
      purpose: 'care',
      consent_ok: true,
      contains_phi: true,
      same_org: true,
      tenant_root_id: 'org_456'
    }
  })
  
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const handleSimulate = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/dev/policy/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }
  
  const handleReloadPolicies = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/dev/policy/reload', {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      alert(`Policies reloaded successfully. New version: ${data.policy_version}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subject */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Subject (Role)</Label>
            <Select
              value={request.subject.role}
              onValueChange={(value) => 
                setRequest(prev => ({ ...prev, subject: { ...prev.subject, role: value } }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CaseManager">CaseManager</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="HelperBasic">HelperBasic</SelectItem>
                <SelectItem value="HelperVerified">HelperVerified</SelectItem>
                <SelectItem value="RegionAdmin">RegionAdmin</SelectItem>
                <SelectItem value="NetworkAdmin">NetworkAdmin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Object */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Object Type</Label>
              <Select
                value={request.object.type}
                onValueChange={(value) => 
                  setRequest(prev => ({ ...prev, object: { ...prev.object, type: value } }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Client">Client</SelectItem>
                  <SelectItem value="Note">Note</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                  <SelectItem value="Report">Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Object ID</Label>
              <Input
                value={request.object.id}
                onChange={(e) => 
                  setRequest(prev => ({ ...prev, object: { ...prev.object, id: e.target.value } }))
                }
                placeholder="client_123"
              />
            </div>
          </div>
          
          {/* Action */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Action</Label>
            <Select
              value={request.action}
              onValueChange={(value) => setRequest(prev => ({ ...prev, action: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">read</SelectItem>
                <SelectItem value="write">write</SelectItem>
                <SelectItem value="delete">delete</SelectItem>
                <SelectItem value="create">create</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Context */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Context (JSON)</Label>
            <Textarea
              value={JSON.stringify(request.context, null, 2)}
              onChange={(e) => {
                try {
                  const context = JSON.parse(e.target.value)
                  setRequest(prev => ({ ...prev, context }))
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
          
          {/* Actions */}
          <div className="flex space-x-2">
            <Button onClick={handleSimulate} disabled={loading} className="flex-1">
              {loading ? 'Simulating...' : 'Simulate Policy'}
            </Button>
            <Button onClick={handleReloadPolicies} variant="outline" disabled={loading}>
              Reload Policies
            </Button>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Result</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4">
              {/* Decision */}
              <div className="flex items-center space-x-2">
                <Badge variant={result.decision === 'allow' ? 'default' : 'destructive'}>
                  {result.decision.toUpperCase()}
                </Badge>
                <span className="text-sm text-gray-600">
                  Policy Version: {result.policy_version}
                </span>
              </div>
              
              {/* Reasoning */}
              <div>
                <Label className="text-sm font-medium">Reasoning</Label>
                <p className="text-sm text-gray-700 mt-1">{result.reasoning}</p>
              </div>
              
              {/* Matched Policy */}
              {result.matched_policy && (
                <div>
                  <Label className="text-sm font-medium">Matched Policy</Label>
                  <p className="text-sm text-gray-700 mt-1 font-mono">{result.matched_policy}</p>
                </div>
              )}
              
              {/* Context Snapshot */}
              <div>
                <Label className="text-sm font-medium">Context Snapshot</Label>
                <pre className="text-xs bg-gray-50 p-3 rounded mt-1 overflow-auto">
                  {JSON.stringify(result.context_snapshot, null, 2)}
                </pre>
              </div>
              
              {/* Evaluation Steps */}
              {result.evaluation_steps && (
                <div>
                  <Label className="text-sm font-medium">Evaluation Steps</Label>
                  <div className="mt-1 space-y-1">
                    {result.evaluation_steps.map((step, index) => (
                      <div key={index} className="text-xs text-gray-600 font-mono">
                        {index + 1}. {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Metadata */}
              <div className="text-xs text-gray-500 pt-2 border-t">
                <div>Correlation ID: {result.correlation_id}</div>
                <div>Timestamp: {new Date(result.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Run a simulation to see results here
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}