'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Play, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Database,
  Users,
  Building,
  MapPin,
  FileText,
  Calendar,
  Activity
} from 'lucide-react'

interface SeederConfig {
  regions: number
  networksPerRegion: number
  orgsPerNetwork: number
  locationsPerOrg: number
  usersPerOrg: number
  clientsPerOrg: number
  casesPerClient: number
  availabilityPerLocation: number
  referralsPerOrg: number
}

interface DataCounts {
  regions: number
  networks: number
  organizations: number
  locations: number
  users: number
  clients: number
  cases: number
  availability: number
  referrals: number
  consents: number
}

interface SeederStatus {
  status: string
  data_counts: DataCounts
  last_seeded: string
}

export default function SeederPage() {
  const [config, setConfig] = useState<SeederConfig>({
    regions: 3,
    networksPerRegion: 2,
    orgsPerNetwork: 4,
    locationsPerOrg: 2,
    usersPerOrg: 8,
    clientsPerOrg: 15,
    casesPerClient: 1,
    availabilityPerLocation: 3,
    referralsPerOrg: 5
  })
  
  const [status, setStatus] = useState<SeederStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load initial status
  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/seeder/status')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status')
    } finally {
      setLoading(false)
    }
  }

  const startSeeding = async () => {
    setSeeding(true)
    setError(null)
    setMessage(null)
    
    try {
      const response = await fetch('/api/seeder/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      setMessage(`Seeding started: ${data.message} (Job ID: ${data.job_id})`)
      
      // Refresh status after a delay to show progress
      setTimeout(() => {
        loadStatus()
      }, 2000)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start seeding')
    } finally {
      setSeeding(false)
    }
  }

  const cleanupData = async () => {
    setCleaning(true)
    setError(null)
    setMessage(null)
    
    try {
      const response = await fetch('/api/seeder/cleanup', {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      setMessage(`Cleanup completed: ${data.message}`)
      
      // Refresh status
      await loadStatus()
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup data')
    } finally {
      setCleaning(false)
    }
  }

  const validateData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/seeder/validate')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      setStatus({
        status: 'validated',
        data_counts: data.validation_results,
        last_seeded: data.validation_time
      })
      setMessage(`Validation completed. Total records: ${data.total_records}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate data')
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = (field: keyof SeederConfig, value: number) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const totalEstimatedRecords = config.regions * config.networksPerRegion * config.orgsPerNetwork * (
    config.locationsPerOrg + 
    config.usersPerOrg + 
    config.clientsPerOrg * config.casesPerClient +
    config.locationsPerOrg * config.availabilityPerLocation +
    config.referralsPerOrg
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Data Seeder
        </h1>
        <p className="text-muted-foreground">
          Generate realistic test data for development and testing.
        </p>
      </div>

      {/* Status Messages */}
      {message && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Current Data Status
          </CardTitle>
          <CardDescription>
            Overview of existing data in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading status...</span>
            </div>
          ) : status ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{status.data_counts.regions}</div>
                  <div className="text-sm text-muted-foreground">Regions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{status.data_counts.networks}</div>
                  <div className="text-sm text-muted-foreground">Networks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{status.data_counts.organizations}</div>
                  <div className="text-sm text-muted-foreground">Organizations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{status.data_counts.locations}</div>
                  <div className="text-sm text-muted-foreground">Locations</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{status.data_counts.users}</div>
                  <div className="text-sm text-muted-foreground">Users</div>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{status.data_counts.clients}</div>
                  <div className="text-sm text-muted-foreground">Clients</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-teal-600">{status.data_counts.cases}</div>
                  <div className="text-sm text-muted-foreground">Cases</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-pink-600">{status.data_counts.availability}</div>
                  <div className="text-sm text-muted-foreground">Availability</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{status.data_counts.referrals}</div>
                  <div className="text-sm text-muted-foreground">Referrals</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-600">{status.data_counts.consents}</div>
                  <div className="text-sm text-muted-foreground">Consents</div>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Last updated: {new Date(status.last_seeded).toLocaleString()}
              </div>
            </div>
          ) : (
            <div>No status data available</div>
          )}
          
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadStatus}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={validateData}
              disabled={loading}
            >
              <CheckCircle className="h-4 w-4" />
              Validate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seeder Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Seeder Configuration</CardTitle>
          <CardDescription>
            Configure the amount of test data to generate. Estimated total: {totalEstimatedRecords.toLocaleString()} records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="regions">Regions</Label>
              <Input
                id="regions"
                type="number"
                min="1"
                max="10"
                value={config.regions}
                onChange={(e) => updateConfig('regions', parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="networksPerRegion">Networks per Region</Label>
              <Input
                id="networksPerRegion"
                type="number"
                min="1"
                max="5"
                value={config.networksPerRegion}
                onChange={(e) => updateConfig('networksPerRegion', parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="orgsPerNetwork">Organizations per Network</Label>
              <Input
                id="orgsPerNetwork"
                type="number"
                min="1"
                max="10"
                value={config.orgsPerNetwork}
                onChange={(e) => updateConfig('orgsPerNetwork', parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="locationsPerOrg">Locations per Organization</Label>
              <Input
                id="locationsPerOrg"
                type="number"
                min="1"
                max="5"
                value={config.locationsPerOrg}
                onChange={(e) => updateConfig('locationsPerOrg', parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="usersPerOrg">Users per Organization</Label>
              <Input
                id="usersPerOrg"
                type="number"
                min="1"
                max="20"
                value={config.usersPerOrg}
                onChange={(e) => updateConfig('usersPerOrg', parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="clientsPerOrg">Clients per Organization</Label>
              <Input
                id="clientsPerOrg"
                type="number"
                min="1"
                max="50"
                value={config.clientsPerOrg}
                onChange={(e) => updateConfig('clientsPerOrg', parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="casesPerClient">Cases per Client</Label>
              <Input
                id="casesPerClient"
                type="number"
                min="1"
                max="3"
                value={config.casesPerClient}
                onChange={(e) => updateConfig('casesPerClient', parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="availabilityPerLocation">Availability per Location</Label>
              <Input
                id="availabilityPerLocation"
                type="number"
                min="1"
                max="10"
                value={config.availabilityPerLocation}
                onChange={(e) => updateConfig('availabilityPerLocation', parseInt(e.target.value) || 1)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="referralsPerOrg">Referrals per Organization</Label>
              <Input
                id="referralsPerOrg"
                type="number"
                min="1"
                max="20"
                value={config.referralsPerOrg}
                onChange={(e) => updateConfig('referralsPerOrg', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            Start seeding, cleanup existing data, or validate current state
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={startSeeding}
              disabled={seeding || loading}
              className="flex items-center gap-2"
            >
              {seeding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {seeding ? 'Seeding...' : 'Start Seeding'}
            </Button>
            
            <Button 
              variant="destructive"
              onClick={cleanupData}
              disabled={cleaning || loading}
              className="flex items-center gap-2"
            >
              {cleaning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {cleaning ? 'Cleaning...' : 'Cleanup All Data'}
            </Button>
          </div>
          
          <div className="mt-4 text-sm text-muted-foreground">
            <p><strong>Start Seeding:</strong> Generate test data based on the configuration above.</p>
            <p><strong>Cleanup:</strong> Remove all seeded data from the database (irreversible).</p>
          </div>
        </CardContent>
      </Card>

      {/* Data Types Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Data Types</CardTitle>
          <CardDescription>
            Overview of the types of data that will be generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Geographic Structure</span>
              </div>
              <ul className="text-sm text-muted-foreground ml-6 space-y-1">
                <li>• Regions with jurisdiction data</li>
                <li>• Networks within regions</li>
                <li>• Organizations with specialties</li>
                <li>• Service locations with addresses</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                <span className="font-medium">Users & Roles</span>
              </div>
              <ul className="text-sm text-muted-foreground ml-6 space-y-1">
                <li>• Realistic user profiles</li>
                <li>• Role assignments (providers, helpers)</li>
                <li>• Organization memberships</li>
                <li>• Contact information</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Client Data</span>
              </div>
              <ul className="text-sm text-muted-foreground ml-6 space-y-1">
                <li>• Client profiles with PII</li>
                <li>• Privacy-preserving fingerprints</li>
                <li>• Client cases and assignments</li>
                <li>• Consent records</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                <span className="font-medium">Operational Data</span>
              </div>
              <ul className="text-sm text-muted-foreground ml-6 space-y-1">
                <li>• Availability records with attributes</li>
                <li>• Referrals between locations</li>
                <li>• Service profiles and matching</li>
                <li>• Audit trails</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}