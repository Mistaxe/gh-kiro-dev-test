import { LabNavigation } from '@/components/lab/lab-navigation'

export default function LabLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">
                Lab/Test Harness
              </h1>
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                Development
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Behavioral Health Platform
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <LabNavigation />
          </div>
          <div className="col-span-9">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}