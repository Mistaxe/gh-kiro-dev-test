import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Construction } from 'lucide-react'

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Notification Testing
        </h1>
        <p className="text-muted-foreground">
          Test notification system functionality and PHI protection.
        </p>
      </div>
      
      <Alert>
        <Construction className="h-4 w-4" />
        <AlertTitle>Under Development</AlertTitle>
        <AlertDescription>
          This feature will be implemented in task 9. It will provide notification 
          testing and validation capabilities.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Notification testing features will include:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Notification trigger testing</li>
            <li>PHI protection validation</li>
            <li>Multi-channel delivery testing</li>
            <li>Notification preferences testing</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}