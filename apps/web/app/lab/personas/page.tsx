import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Construction } from 'lucide-react'

export default function PersonasPage() {
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
      
      <Alert>
        <Construction className="h-4 w-4" />
        <AlertTitle>Under Development</AlertTitle>
        <AlertDescription>
          This feature will be implemented in task 7.2. It will provide persona listing, 
          impersonation capabilities, and session management for testing different user roles.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Persona management features will include:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Dev endpoints for persona listing and impersonation</li>
            <li>Persona UI with role assignment display</li>
            <li>Session management for impersonated users</li>
            <li>Active organization and location selection</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}