'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Play, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Code, 
  Eye,
  Settings,
  Clock,
  FileText
} from 'lucide-react'

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
  const [reloadSuccess, setReloadSuccess] = useState<string | null>(null)
  const [realTimeMode, setRealTimeMode] = useState(false)
  const [contextPresets, setContextPresets] = useState<Record<string, any>>({})

  // Real-time simulation when enabled
  useEffect(() => {
    if (realTimeMode && !loading) {
      const timeoutId = setTimeout(() => {
        handleSimulate()
      }, 500) // Debounce for 500ms
      
      return () => clearTimeout(timeoutId)
    }
  }, [request, realTimeMode])

  // Context presets for common scenarios
  const loadContextPreset = (presetName: string) => {
    const presets = {
      'phi-with-consent': {
        purpose: 'care',
        consent_ok: true,
        contains_phi: true,
        same_org: true,
        tenant_root_id: 'org_456'
      },
      'phi-no-consent': {
        purpose: 'care',
        consent_ok: false,
        contains_phi: true,
        same_org: true,
        tenant_root_id: 'org_456'
      },
      'break-glass': {
        purpose: 'care',
        consent_ok: false,
        contains_phi: true,
        bg: true,
        bg_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        same_org: true,
        tenant_root_id: 'org_456'
      },
      'cross-org-access': {
        purpose: 'care',
        consent_ok: true,
        contains_phi: true,
        same_org: false,
        tenant_root_id: 'org_456'
      },
      'helper-basic': {
        purpose: 'care',
        consent_ok: false,
        contains_phi: true,
        affiliated: false,
        tenant_root_id: 'org_456'
      },
      'deidentified-report': {
        purpose: 'oversight',
        dataset: { deidentified: true },
        contains_phi: false,
        legal_basis: true,
        tenant_root_id: 'org_456'
      }
    }
    
    const preset = presets[presetName as keyof typeof presets]
    if (preset) {
      setRequest(prev => ({ ...prev, context: preset }))
    }
  }
  
  const handleSimulate = async () => {
    setLoading(true)
    setError(null)
    setReloadSuccess(null)
    
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const response = await fetch(`${API_BASE_URL}/dev/policy/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.reason || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }
  
  const handleReloadPolicies = async () => {
    setLoading(true)
    setError(null)
    setReloadSuccess(null)
    
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const response = await fetch(`${API_BASE_URL}/dev/policy/reload`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.reason || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setReloadSuccess(`Policies reloaded successfully. New version: ${data.policy_version}`)
      
      // Auto-clear success message after 5 seconds
      setTimeout(() => setReloadSuccess(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Simulation Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {reloadSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Policy Reload Success</AlertTitle>
          <AlertDescription>{reloadSuccess}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Configuration */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Simulation Configuration
              </CardTitle>
              <CardDescription>
                Configure the authorization scenario to test
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Real-time Mode Toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Real-time Evaluation</Label>
                <Button
                  variant={realTimeMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRealTimeMode(!realTimeMode)}
                >
                  {realTimeMode ? "ON" : "OFF"}
                </Button>
              </div>
              
              <Separator />

              {/* Subject Configuration */}
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
                    <SelectItem value="SuperAdmin">SuperAdmin</SelectItem>
                    <SelectItem value="OrgAdmin">OrgAdmin</SelectItem>
                    <SelectItem value="CaseManager">CaseManager</SelectItem>
                    <SelectItem value="Provider">Provider</SelectItem>
                    <SelectItem value="LocationManager">LocationManager</SelectItem>
                    <SelectItem value="HelperVerified">HelperVerified</SelectItem>
                    <SelectItem value="HelperBasic">HelperBasic</SelectItem>
                    <SelectItem value="BasicAccount">BasicAccount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Object Configuration */}
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
                      <SelectItem value="ServiceProfile">ServiceProfile</SelectItem>
                      <SelectItem value="Availability">Availability</SelectItem>
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

              {/* Action Configuration */}
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
                    <SelectItem value="create">create</SelectItem>
                    <SelectItem value="update">update</SelectItem>
                    <SelectItem value="delete">delete</SelectItem>
                    <SelectItem value="search">search</SelectItem>
                    <SelectItem value="claim">claim</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSimulate} 
                  disabled={loading || realTimeMode} 
                  className="flex-1"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {loading ? 'Simulating...' : 'Simulate Policy'}
                </Button>
                <Button 
                  onClick={handleReloadPolicies} 
                  variant="outline" 
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Context Builder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Context Builder
              </CardTitle>
              <CardDescription>
                Build authorization context for testing scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="presets" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="presets">Presets</TabsTrigger>
                  <TabsTrigger value="custom">Custom JSON</TabsTrigger>
                </TabsList>
                
                <TabsContent value="presets" className="space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadContextPreset('phi-with-consent')}
                      className="justify-start"
                    >
                      PHI with Consent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadContextPreset('phi-no-consent')}
                      className="justify-start"
                    >
                      PHI without Consent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadContextPreset('break-glass')}
                      className="justify-start"
                    >
                      Break-glass Access
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadContextPreset('cross-org-access')}
                      className="justify-start"
                    >
                      Cross-org Access
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadContextPreset('helper-basic')}
                      className="justify-start"
                    >
                      Helper Basic Access
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadContextPreset('deidentified-report')}
                      className="justify-start"
                    >
                      De-identified Report
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="custom" className="space-y-3">
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
                    rows={10}
                    className="font-mono text-sm"
                    placeholder="Enter custom context JSON..."
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Results Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Policy Decision
              {realTimeMode && (
                <Badge variant="secondary" className="ml-2">
                  Real-time
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Authorization decision with detailed explanation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>Evaluating policy...</span>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-6">
                {/* Decision Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {result.decision === 'allow' ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                    <div>
                      <Badge 
                        variant={result.decision === 'allow' ? 'default' : 'destructive'}
                        className="text-sm"
                      >
                        {result.decision.toUpperCase()}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        Policy v{result.policy_version}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </div>
                    <div>ID: {result.correlation_id.slice(-8)}</div>
                  </div>
                </div>

                <Separator />

                {/* Matched Policy */}
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Matched Policy Rule
                  </Label>
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    {result.matched_policy ? (
                      <code className="text-sm">{result.matched_policy}</code>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">
                        No specific policy rule matched
                      </span>
                    )}
                  </div>
                </div>

                {/* Reasoning */}
                <div>
                  <Label className="text-sm font-medium">Decision Reasoning</Label>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {result.reasoning}
                  </p>
                </div>

                {/* Evaluation Steps */}
                {result.evaluation_steps && result.evaluation_steps.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Evaluation Steps</Label>
                    <div className="mt-2 space-y-1">
                      {result.evaluation_steps.map((step, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs">
                          <span className="flex-shrink-0 w-5 h-5 bg-muted rounded-full flex items-center justify-center text-[10px] font-medium">
                            {index + 1}
                          </span>
                          <span className="text-muted-foreground font-mono leading-relaxed">
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Context Snapshot */}
                <div>
                  <Label className="text-sm font-medium">Context Snapshot</Label>
                  <div className="mt-2 p-3 bg-muted rounded-lg overflow-auto">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(result.context_snapshot, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {!result && !loading && (
              <div className="text-center text-muted-foreground py-12">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">
                  {realTimeMode 
                    ? "Real-time mode enabled. Results will appear as you modify the configuration."
                    : "Click 'Simulate Policy' to test authorization decisions."
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}