import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Construction } from 'lucide-react'

export default function ReferralsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Referral Workflows
        </h1>
        <p className="text-muted-foreground">
          Test referral creation and workflow functionality.
        </p>
      </div>
      
      <Alert>
        <Construction className="h-4 w-4" />
        <AlertTitle>Under Development</AlertTitle>
        <AlertDescription>
          This feature will be implemented as part of future tasks. It will provide 
          referral workflow testing capabilities.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Referral testing features will include:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Referral creation workflow testing</li>
            <li>PHI detection and consent validation testing</li>
            <li>Direct vs record-keeping referral testing</li>
            <li>Referral status tracking validation</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}