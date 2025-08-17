import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Construction } from 'lucide-react'

export default function ScopePage() {
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
        <Construction className="h-4 w-4" />
        <AlertTitle>Under Development</AlertTitle>
        <AlertDescription>
          This feature will be implemented as part of task 7.2. It will provide scope selection 
          and context management capabilities.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Scope selection features will include:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Organization context switching</li>
            <li>Location context selection</li>
            <li>Persistent scope selection across Lab tabs</li>
            <li>Scope validation and testing</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}