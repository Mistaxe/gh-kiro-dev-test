'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Database, 
  Play, 
  Shield, 
  Users, 
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Filter
} from 'lucide-react'
import { useRLSTesting, RLSQueryResult } from '@/lib/hooks/use-rls-testing'
import { usePersonas } from '@/lib/hooks/use-personas'

export default function RLSPage() {
  const { tables, loading: tablesLoading, error: tablesError, fetchTables, executeQuery } = useRLSTesting()
  const { personas, loading: personasLoading, error: personasError } = usePersonas()
  
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [selectedPersona, setSelectedPersona] = useState<string>('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [limit, setLimit] = useState<number>(10)
  const [queryResult, setQueryResult] = useState<RLSQueryResult | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)

  useEffect(() => {
    fetchTables()
  }, [])

  const handleAddFilter = () => {
    const newKey = `filter_${Object.keys(filters).length + 1}`
    setFilters(prev => ({ ...prev, [newKey]: '' }))
  }

  const handleRemoveFilter = (key: string) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      delete newFilters[key]
      return newFilters
    })
  }

  const handleUpdateFilter = (key: string, field: 'column' | 'value', value: string) => {
    if (field === 'column') {
      // Rename the key
      setFilters(prev => {
        const newFilters = { ...prev }
        const oldValue = newFilters[key]
        delete newFilters[key]
        newFilters[value] = oldValue
        return newFilters
      })
    } else {
      setFilters(prev => ({ ...prev, [key]: value }))
    }
  }

  const handleExecuteQuery = async () => {
    if (!selectedTable || !selectedPersona) {
      setQueryError('Please select both a table and a persona')
      return
    }

    setQueryLoading(true)
    setQueryError(null)
    
    try {
      // Convert filters to proper format (remove empty values)
      const cleanFilters = Object.entries(filters)
        .filter(([_, value]) => value.trim() !== '')
        .reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {} as Record<string, any>)

      const result = await executeQuery({
        table: selectedTable,
        persona_id: selectedPersona,
        filters: cleanFilters,
        limit
      })
      
      setQueryResult(result)
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setQueryLoading(false)
    }
  }

  const selectedTableInfo = tables.find(t => t.name === selectedTable)
  const selectedPersonaInfo = personas.find(p => p.id === selectedPersona)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          RLS Testing
        </h1>
        <p className="text-muted-foreground">
          Test Row Level Security policies with different user contexts and validate tenant isolation.
        </p>
      </div>

      {/* Error Display */}
      {(tablesError || personasError || queryError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {tablesError || personasError || queryError}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query Configuration */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Table Selection
              </CardTitle>
              <CardDescription>
                Choose a whitelisted table to test RLS policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Table</Label>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table to test" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table.name} value={table.name}>
                        <div className="flex items-center gap-2">
                          <span>{table.schema}.{table.name}</span>
                          {table.tenant_scoped && (
                            <Badge variant="secondary" className="text-xs">
                              Tenant Scoped
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTableInfo && (
                  <div className="text-sm text-muted-foreground">
                    {selectedTableInfo.description}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Persona (User Context)</Label>
                <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a persona to impersonate" />
                  </SelectTrigger>
                  <SelectContent>
                    {personas.map((persona) => (
                      <SelectItem key={persona.id} value={persona.id}>
                        <div className="flex items-center gap-2">
                          <span>{persona.display_name || persona.email}</span>
                          <Badge variant="outline" className="text-xs">
                            {persona.roles[0]?.role || 'No Role'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPersonaInfo && (
                  <div className="text-sm text-muted-foreground">
                    {selectedPersonaInfo.roles.map(role => role.role).join(', ')}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Row Limit</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Query Filters
              </CardTitle>
              <CardDescription>
                Add filters to test specific query scenarios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(filters).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <Input
                    placeholder="Column name"
                    value={key}
                    onChange={(e) => handleUpdateFilter(key, 'column', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Filter value"
                    value={value}
                    onChange={(e) => handleUpdateFilter(key, 'value', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveFilter(key)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              
              <Button variant="outline" onClick={handleAddFilter} className="w-full">
                Add Filter
              </Button>

              <Separator />

              <Button 
                onClick={handleExecuteQuery}
                disabled={queryLoading || !selectedTable || !selectedPersona}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                {queryLoading ? 'Executing Query...' : 'Execute RLS Query'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Query Results
            </CardTitle>
            <CardDescription>
              RLS policy enforcement results and row count validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {queryLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 animate-pulse" />
                  <span>Executing query...</span>
                </div>
              </div>
            )}

            {queryResult && !queryLoading && (
              <div className="space-y-4">
                {/* Query Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Rows Returned</div>
                    <div className="text-2xl font-bold">{queryResult.row_count}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Execution Time</div>
                    <div className="text-2xl font-bold">{queryResult.query_info.execution_time_ms}ms</div>
                  </div>
                </div>

                {/* RLS Validation */}
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>RLS Policy Validation</AlertTitle>
                  <AlertDescription>
                    {selectedTableInfo?.tenant_scoped ? (
                      queryResult.row_count === 0 ? (
                        <span className="text-green-600">✓ Tenant isolation working: Non-member sees 0 rows</span>
                      ) : (
                        <span className="text-blue-600">→ Member access: {queryResult.row_count} rows visible within tenant scope</span>
                      )
                    ) : (
                      <span className="text-gray-600">→ Non-tenant-scoped table: {queryResult.row_count} rows returned</span>
                    )}
                  </AlertDescription>
                </Alert>

                {/* Query Metadata */}
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Executed at: {new Date(queryResult.query_info.executed_at).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    Persona: {selectedPersonaInfo?.display_name || selectedPersonaInfo?.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-3 w-3" />
                    Table: {queryResult.table}
                  </div>
                </div>

                {/* Results Table */}
                {queryResult.rows.length > 0 && (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(queryResult.rows[0]).map((column) => (
                            <TableHead key={column}>{column}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryResult.rows.map((row, index) => (
                          <TableRow key={index}>
                            {Object.values(row).map((value, cellIndex) => (
                              <TableCell key={cellIndex} className="font-mono text-xs">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {queryResult.rows.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No rows returned by the query</p>
                    <p className="text-sm">This could indicate RLS policies are working correctly</p>
                  </div>
                )}
              </div>
            )}

            {!queryResult && !queryLoading && (
              <div className="text-center text-muted-foreground py-12">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">
                  Configure your query parameters and click "Execute RLS Query" to test Row Level Security policies.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RLS Testing Guide */}
      <Card>
        <CardHeader>
          <CardTitle>RLS Testing Guide</CardTitle>
          <CardDescription>
            How to validate Row Level Security policies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="font-medium text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Tenant Isolation
              </div>
              <div className="text-sm text-muted-foreground">
                Non-members should see 0 rows from tenant-scoped tables.
                Members should only see rows within their tenant boundary.
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                Role-Based Access
              </div>
              <div className="text-sm text-muted-foreground">
                Different roles should see different subsets of data based on
                their permissions and organizational assignments.
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="font-medium text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-600" />
                Policy Validation
              </div>
              <div className="text-sm text-muted-foreground">
                Test edge cases like cross-org access, expired roles, and
                different organizational contexts to ensure policies work correctly.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}