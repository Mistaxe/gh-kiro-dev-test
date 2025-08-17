import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Construction } from 'lucide-react'

export default function RLSPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          RLS Testing
        </h1>
        <p className="text-muted-foreground">
          Test Row Level Security policies with different user contexts.
        </p>
      </div>
      
      <Alert>
        <Construction className="h-4 w-4" />
        <AlertTitle>Under Development</AlertTitle>
        <AlertDescription>
          This feature will be implemented in task 7.4. It will provide RLS query testing 
          and validation capabilities.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            RLS testing features will include:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>RLS query interface with whitelisted table selection</li>
            <li>Filter builder for testing different query scenarios</li>
            <li>Query execution with JWT context switching</li>
            <li>Results display with row count validation</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}