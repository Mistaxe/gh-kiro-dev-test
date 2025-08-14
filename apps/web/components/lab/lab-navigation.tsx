'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navigationItems = [
  {
    name: 'Overview',
    href: '/lab',
    icon: '🏠',
    description: 'Lab home and overview'
  },
  {
    name: 'Policy Simulator',
    href: '/lab/policies',
    icon: '🔒',
    description: 'Test authorization policies'
  },
  {
    name: 'Context Builder',
    href: '/lab/context',
    icon: '🔧',
    description: 'Build authorization contexts'
  },
  {
    name: 'Personas',
    href: '/lab/personas',
    icon: '👤',
    description: 'User impersonation'
  },
  {
    name: 'Scope Selection',
    href: '/lab/scope',
    icon: '🎯',
    description: 'Org/Location context'
  },
  {
    name: 'Capabilities',
    href: '/lab/capabilities',
    icon: '⚡',
    description: 'Permission testing'
  },
  {
    name: 'RLS Testing',
    href: '/lab/rls',
    icon: '🛡️',
    description: 'Row-level security'
  },
  {
    name: 'Data Seeder',
    href: '/lab/seeder',
    icon: '🌱',
    description: 'Generate test data'
  },
  {
    name: 'Service Registry',
    href: '/lab/registry',
    icon: '📋',
    description: 'Service search testing'
  },
  {
    name: 'Referrals',
    href: '/lab/referrals',
    icon: '📤',
    description: 'Referral workflows'
  },
  {
    name: 'Notifications',
    href: '/lab/notifications',
    icon: '🔔',
    description: 'Notification testing'
  }
]

export function LabNavigation() {
  const pathname = usePathname()
  
  return (
    <nav className="space-y-1">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          Lab Tools
        </h3>
      </div>
      
      {navigationItems.map((item) => {
        const isActive = pathname === item.href
        
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
              isActive
                ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-500'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <span className="mr-3 text-lg" role="img" aria-label={item.name}>
              {item.icon}
            </span>
            <div className="flex-1">
              <div className="font-medium">{item.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {item.description}
              </div>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}