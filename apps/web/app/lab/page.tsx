import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, Info } from 'lucide-react'

const featuredTools = [
  {
    title: 'Policy Simulator',
    description: 'Test authorization policies with different roles, objects, and contexts.',
    href: '/lab/policies',
    icon: '🔒',
    category: 'Authorization'
  },
  {
    title: 'Persona Management',
    description: 'Switch between different user personas for comprehensive testing.',
    href: '/lab/personas',
    icon: '👤',
    category: 'Identity'
  },
  {
    title: 'RLS Testing',
    description: 'Test Row Level Security policies with different user contexts.',
    href: '/lab/rls',
    icon: '🛡️',
    category: 'Authorization'
  },
  {
    title: 'Data Seeder',
    description: 'Generate realistic test data for development and testing.',
    href: '/lab/seeder',
    icon: '🌱',
    category: 'Data'
  }
]

export default function LabHome() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-3">
          Lab/Test Harness
        </h1>
        <p className="text-lg text-muted-foreground">
          Development and testing environment for the Behavioral Health Platform.
          Use the navigation on the left to access different testing tools.
        </p>
      </div>
      
      {/* Featured Tools */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Featured Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {featuredTools.map((tool) => (
            <Card key={tool.title} className="group hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl" role="img" aria-label={tool.title}>
                      {tool.icon}
                    </span>
                    <div>
                      <CardTitle className="text-lg">{tool.title}</CardTitle>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {tool.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="mb-4 text-sm">
                  {tool.description}
                </CardDescription>
                <Button asChild variant="outline" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Link href={tool.href} className="flex items-center">
                    Open Tool
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      {/* Quick Stats */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">11</div>
              <div className="text-sm text-muted-foreground">Lab Tools Available</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">5</div>
              <div className="text-sm text-muted-foreground">Tool Categories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">∞</div>
              <div className="text-sm text-muted-foreground">Test Scenarios</div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Development Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Development Environment</AlertTitle>
        <AlertDescription>
          This Lab environment is only available in development mode. 
          It provides comprehensive tools for testing authorization policies, context building, 
          persona management, and data validation. All test data is isolated and safe for experimentation.
        </AlertDescription>
      </Alert>
    </div>
  )
}