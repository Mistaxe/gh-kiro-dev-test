'use client'

import { useState } from 'react'
import { PolicySimulator } from '@/components/lab/policy-simulator'

export default function PoliciesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Policy Simulator
        </h2>
        <p className="text-gray-600">
          Test authorization policies by simulating different roles, objects, actions, and contexts.
          This tool connects to the API's /dev/policy/simulate endpoint.
        </p>
      </div>
      
      <PolicySimulator />
    </div>
  )
}