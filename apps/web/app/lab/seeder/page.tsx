import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Construction } from 'lucide-react'

export default function SeederPage() {
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
      
      <Alert>
        <Construction className="h-4 w-4" />
        <AlertTitle>Under Development</AlertTitle>
        <AlertDescription>
          This feature will be implemented in task 8. It will provide comprehensive 
          data seeding capabilities for testing.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Data seeder features will include:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Idempotent seeder for regions, networks, organizations</li>
            <li>Realistic user generation with role assignments</li>
            <li>Client and case generation with faker data</li>
            <li>Availability and referral seed data</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}