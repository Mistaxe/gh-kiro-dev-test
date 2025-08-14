export default function LabHome() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Lab/Test Harness
        </h2>
        <p className="text-gray-600">
          Development and testing environment for the Behavioral Health Platform.
          Use the navigation on the left to access different testing tools.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Policy Simulator
          </h3>
          <p className="text-gray-600 mb-4">
            Test authorization policies with different roles, objects, and contexts.
          </p>
          <a
            href="/lab/policies"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Open Policy Simulator →
          </a>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Context Builder
          </h3>
          <p className="text-gray-600 mb-4">
            Build and validate authorization contexts for different scenarios.
          </p>
          <a
            href="/lab/context"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Open Context Builder →
          </a>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Persona Management
          </h3>
          <p className="text-gray-600 mb-4">
            Switch between different user personas for testing.
          </p>
          <a
            href="/lab/personas"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Manage Personas →
          </a>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            RLS Testing
          </h3>
          <p className="text-gray-600 mb-4">
            Test Row Level Security policies with different user contexts.
          </p>
          <a
            href="/lab/rls"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Test RLS →
          </a>
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Development Environment
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                This Lab environment is only available in development mode. 
                It provides tools for testing authorization policies, context building, 
                and data validation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}