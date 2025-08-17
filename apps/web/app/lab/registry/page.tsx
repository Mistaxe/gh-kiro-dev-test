import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Construction } from 'lucide-react'

export default function RegistryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Service Registry Testing
        </h1>
        <p className="text-muted-foreground">
          Test service search and registry functionality.
        </p>
      </div>
      
      <Alert>
        <Construction className="h-4 w-4" />
        <AlertTitle>Under Development</AlertTitle>
        <AlertDescription>
          This feature will be implemented as part of future tasks. It will provide 
          service registry testing capabilities.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Service registry testing features will include:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Service search interface testing</li>
            <li>Availability matching validation</li>
            <li>Service profile management testing</li>
            <li>Real-time availability updates testing</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}