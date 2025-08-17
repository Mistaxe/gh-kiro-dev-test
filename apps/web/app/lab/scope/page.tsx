'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Building, 
  MapPin, 
  Target, 
  CheckCircle,
  AlertCircle,
  Save
} from 'lucide-react'
import { usePersonaSession } from '@/lib/hooks/use-personas'

export default function ScopePage() {
  const { 
    currentSession, 
    loading, 
    error,
    updateScopeSelection
  } = usePersonaSession()

  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [selectedPurpose, setSelectedPurpose] = useState<string>('')
  const [hasChanges, setHasChanges] = useState(false)

  // Update local state when session changes
  useEffect(() => {
    if (currentSession) {
      setSelectedOrgId(currentSession.active_org_id || '')
      setSelectedLocationId(currentSession.active_location_id || '')
      setSelectedPurpose(currentSession.purpose || '')
      setHasChanges(false)
    }
  }, [currentSession])

  // Track changes
  useEffect(() => {
    if (currentSession) {
      const orgChanged = selectedOrgId !== (currentSession.active_org_id || '')
      const locationChanged = selectedLocationId !== (currentSession.active_location_id || '')
      const purposeChanged = selectedPurpose !== (currentSession.purpose || '')
      
      setHasChanges(orgChanged || locationChanged || purposeChanged)
    }
  }, [selectedOrgId, selectedLocationId, selectedPurpose, currentSession])

  const handleSaveChanges = async () => {
    if (!currentSession) return

    try {
      await updateScopeSelection(currentSession.persona_id, {
        active_org_id: selectedOrgId || undefined,
        active_location_id: selectedLocationId || undefined,
        purpose: selectedPurpose as any || undefined
      })
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to update scope:', error)
    }
  }

  if (!currentSession) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Scope Selection
          </h1>
          <p className="text-muted-foreground">
            Manage organizational and location context for testing.
          </p>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Active Session</AlertTitle>
          <AlertDescription>
            You need to start a persona impersonation session before you can manage scope selection.
            Go to the <strong>Personas</strong> tab to start impersonating a user.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Scope Selection
        </h1>
        <p className="text-muted-foreground">
          Manage organizational and location context for testing.
        </p>
      </div>

      {/* Current Session Status */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>Active Session</AlertTitle>
        <AlertDescription>
          Managing scope for persona session started at {new Date(currentSession.session_started_at).toLocaleString()}
        </AlertDescription>
      </Alert>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scope Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Scope Configuration
            </CardTitle>
            <CardDescription>
              Configure the organizational and location context for this session
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Organization Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4" />
                Active Organization
              </label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific organization</SelectItem>
                  {/* Note: In a real implementation, we'd fetch available orgs from the persona */}
                  <SelectItem value="org-1">Sample Organization 1</SelectItem>
                  <SelectItem value="org-2">Sample Organization 2</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Limits data access to the selected organization's tenant scope
              </div>
            </div>

            {/* Location Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Active Location
              </label>
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific location</SelectItem>
                  {/* Note: In a real implementation, we'd filter locations by selected org */}
                  <SelectItem value="loc-1">Sample Location 1</SelectItem>
                  <SelectItem value="loc-2">Sample Location 2</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Further restricts access to location-specific resources
              </div>
            </div>

            {/* Purpose Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Purpose of Use</label>
              <Select value={selectedPurpose} onValueChange={setSelectedPurpose}>
                <SelectTrigger>
                  <SelectValue placeholder="Select purpose (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific purpose</SelectItem>
                  <SelectItem value="care">Care</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="QA">Quality Assurance</SelectItem>
                  <SelectItem value="oversight">Oversight</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Required for PHI access and affects authorization decisions
              </div>
            </div>

            {/* Save Button */}
            {hasChanges && (
              <div className="pt-4">
                <Button 
                  onClick={handleSaveChanges} 
                  disabled={loading}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Scope Changes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Scope Display */}
        <Card>
          <CardHeader>
            <CardTitle>Current Scope</CardTitle>
            <CardDescription>
              Active scope settings for this session
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Organization:</span>
                <Badge variant={currentSession.active_org_id ? "default" : "secondary"}>
                  {currentSession.active_org_id || 'None'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Location:</span>
                <Badge variant={currentSession.active_location_id ? "default" : "secondary"}>
                  {currentSession.active_location_id || 'None'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Purpose:</span>
                <Badge variant={currentSession.purpose ? "default" : "secondary"}>
                  {currentSession.purpose || 'None'}
                </Badge>
              </div>
            </div>

            {hasChanges && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unsaved Changes</AlertTitle>
                <AlertDescription>
                  You have unsaved scope changes. Click "Save Scope Changes" to apply them.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scope Impact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Scope Impact</CardTitle>
          <CardDescription>
            How scope selection affects authorization and data access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="font-medium text-sm">Organization Scope</div>
              <div className="text-sm text-muted-foreground">
                When set, limits all data access to the selected organization's tenant boundary.
                Required for most business operations.
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium text-sm">Location Scope</div>
              <div className="text-sm text-muted-foreground">
                Further restricts access to location-specific resources like availability,
                service profiles, and location-based assignments.
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium text-sm">Purpose of Use</div>
              <div className="text-sm text-muted-foreground">
                Required for PHI access. Different purposes may grant different levels
                of access to sensitive information.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}