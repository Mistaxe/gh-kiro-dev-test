'use client'

import { PolicySimulator } from '@/components/lab/policy-simulator'

export default function PoliciesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Policy Simulator
        </h1>
        <p className="text-muted-foreground">
          Test authorization policies by simulating different roles, objects, actions, and contexts.
          This tool provides real-time policy evaluation with detailed decision explanations.
        </p>
      </div>
      
      <PolicySimulator />
    </div>
  )
}