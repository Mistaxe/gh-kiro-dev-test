'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

const navigationItems = [
  {
    name: 'Overview',
    href: '/lab',
    icon: '🏠',
    description: 'Lab home and overview',
    category: 'General'
  },
  {
    name: 'Personas',
    href: '/lab/personas',
    icon: '👤',
    description: 'User impersonation',
    category: 'Identity'
  },
  {
    name: 'Scope Selection',
    href: '/lab/scope',
    icon: '🎯',
    description: 'Org/Location context',
    category: 'Identity'
  },
  {
    name: 'Capabilities',
    href: '/lab/capabilities',
    icon: '⚡',
    description: 'Permission testing',
    category: 'Identity'
  },
  {
    name: 'Policy Simulator',
    href: '/lab/policies',
    icon: '🔒',
    description: 'Test authorization policies',
    category: 'Authorization'
  },
  {
    name: 'Context Builder',
    href: '/lab/context',
    icon: '🔧',
    description: 'Build authorization contexts',
    category: 'Authorization'
  },
  {
    name: 'RLS Testing',
    href: '/lab/rls',
    icon: '🛡️',
    description: 'Row-level security',
    category: 'Authorization'
  },
  {
    name: 'Data Seeder',
    href: '/lab/seeder',
    icon: '🌱',
    description: 'Generate test data',
    category: 'Data'
  },
  {
    name: 'Service Registry',
    href: '/lab/registry',
    icon: '📋',
    description: 'Service search testing',
    category: 'Features'
  },
  {
    name: 'Referrals',
    href: '/lab/referrals',
    icon: '📤',
    description: 'Referral workflows',
    category: 'Features'
  },
  {
    name: 'Notifications',
    href: '/lab/notifications',
    icon: '🔔',
    description: 'Notification testing',
    category: 'Features'
  }
]

const categories = ['General', 'Identity', 'Authorization', 'Data', 'Features']

export function LabNavigation() {
  const pathname = usePathname()
  
  return (
    <nav className="space-y-1">
      {categories.map((category, categoryIndex) => {
        const categoryItems = navigationItems.filter(item => item.category === category)
        
        return (
          <div key={category}>
            {categoryIndex > 0 && <Separator className="my-4" />}
            <div className="mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
                {category}
              </h3>
            </div>
            
            <div className="space-y-1">
              {categoryItems.map((item) => {
                const isActive = pathname === item.href
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:scale-[1.02]',
                      isActive
                        ? 'bg-primary/10 text-primary border-l-2 border-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <span className="mr-3 text-base transition-transform group-hover:scale-110" role="img" aria-label={item.name}>
                      {item.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}