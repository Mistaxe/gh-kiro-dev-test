import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Behavioral Health Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Multi-tenant behavioral health coordination platform
          </p>
          
          <div className="flex justify-center space-x-4">
            <Link
              href="/lab"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Open Lab/Test Harness
            </Link>
            <Link
              href="/dashboard"
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Dashboard (Coming Soon)
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}