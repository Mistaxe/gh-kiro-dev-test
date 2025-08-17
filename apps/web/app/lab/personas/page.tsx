'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  User, 
  Users, 
  Building, 
  MapPin, 
  Clock, 
  Play, 
  Square, 
  Settings,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { usePersonas, usePersonaSession } from '@/lib/hooks/use-personas'
import { Persona } from '@app/shared'

export default function PersonasPage() {
  const { personas, loading: personasLoading, error: personasError, refetch } = usePersonas()
  const { 
    currentSession, 
    loading: sessionLoading, 
    error: sessionError,
    startImpersonation,
    updateScopeSelection,
    endImpersonation
  } = usePersonaSession()

  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [selectedPurpose, setSelectedPurpose] = useState<string>('')

  const handleStartImpersonation = async () => {
    if (!selectedPersona) return

    try {
      await startImpersonation({
        persona_id: selectedPersona.id,
        active_org_id: selectedOrgId || undefined,
        active_location_id: selectedLocationId || undefined,
        purpose: selectedPurpose as any || undefined
      })
    } catch (error) {
      console.error('Failed to start impersonation:', error)
    }
  }

  const handleEndImpersonation = async () => {
    if (!currentSession) return

    try {
      await endImpersonation(currentSession.persona_id)
      setSelectedPersona(null)
      setSelectedOrgId('')
      setSelectedLocationId('')
      setSelectedPurpose('')
    } catch (error) {
      console.error('Failed to end impersonation:', error)
    }
  }

  const handleUpdateScope = async () => {
    if (!currentSession) return

    try {
      await updateScopeSelection(currentSession.persona_id, {
        active_org_id: selectedOrgId || undefined,
        active_location_id: selectedLocationId || undefined,
        purpose: selectedPurpose as any || undefined
      })
    } catch (error) {
      console.error('Failed to update scope:', error)
    }
  }

  const currentPersona = personas.find(p => p.id === currentSession?.persona_id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Persona Management
        </h1>
        <p className="text-muted-foreground">
          Switch between different user personas for comprehensive testing.
        </p>
      </div>

      {/* Current Session Status */}
      {currentSession && currentPersona && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Active Impersonation Session</AlertTitle>
          <AlertDescription>
            Currently impersonating <strong>{currentPersona.display_name || currentPersona.email}</strong>
            {currentSession.active_org_id && (
              <span> in organization <strong>{currentPersona.organizations.find(o => o.id === currentSession.active_org_id)?.name}</strong></span>
            )}
            {currentSession.purpose && (
              <span> for <strong>{currentSession.purpose}</strong> purposes</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {(personasError || sessionError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {personasError || sessionError}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Persona Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Available Personas
            </CardTitle>
            <CardDescription>
              Select a persona to impersonate for testing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {personasLoading ? (
              <div className="text-center py-4">Loading personas...</div>
            ) : personas.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No personas available. Make sure the database is seeded with test users.
              </div>
            ) : (
              <div className="space-y-3">
                {personas.map((persona) => (
                  <div
                    key={persona.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedPersona?.id === persona.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedPersona(persona)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">
                            {persona.display_name || persona.email}
                          </span>
                          {persona.is_helper && (
                            <Badge variant="secondary">Helper</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {persona.email}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {persona.roles.map((role) => (
                            <Badge key={role.id} variant="outline" className="text-xs">
                              {role.role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Session Controls
            </CardTitle>
            <CardDescription>
              Configure impersonation session settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPersona && (
              <>
                {/* Organization Selection */}
                {selectedPersona.organizations.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Organization
                    </label>
                    <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No specific organization</SelectItem>
                        {selectedPersona.organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Location Selection */}
                {selectedPersona.locations.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </label>
                    <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No specific location</SelectItem>
                        {selectedPersona.locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name} ({location.org_name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {currentSession ? (
                    <>
                      <Button
                        onClick={handleUpdateScope}
                        disabled={sessionLoading}
                        variant="outline"
                        className="flex-1"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Update Scope
                      </Button>
                      <Button
                        onClick={handleEndImpersonation}
                        disabled={sessionLoading}
                        variant="destructive"
                        className="flex-1"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        End Session
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={handleStartImpersonation}
                      disabled={sessionLoading}
                      className="w-full"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Impersonation
                    </Button>
                  )}
                </div>
              </>
            )}

            {!selectedPersona && (
              <div className="text-center py-8 text-muted-foreground">
                Select a persona to configure session settings
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session Details */}
      {currentSession && currentPersona && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Session Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Persona</div>
                <div className="font-medium">{currentPersona.display_name || currentPersona.email}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Organization</div>
                <div className="font-medium">
                  {currentSession.active_org_id 
                    ? currentPersona.organizations.find(o => o.id === currentSession.active_org_id)?.name || 'Unknown'
                    : 'None'
                  }
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Location</div>
                <div className="font-medium">
                  {currentSession.active_location_id 
                    ? currentPersona.locations.find(l => l.id === currentSession.active_location_id)?.name || 'Unknown'
                    : 'None'
                  }
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Purpose</div>
                <div className="font-medium">{currentSession.purpose || 'None'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}