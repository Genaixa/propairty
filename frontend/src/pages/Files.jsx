import { useState, useEffect } from 'react'
import api from '../lib/api'
import FileAttachments from '../components/FileAttachments'

const ENTITY_LABELS = {
  property: 'Property',
  tenant: 'Tenant',
  lease: 'Lease',
  inspection: 'Inspection',
  maintenance: 'Maintenance',
}

export default function Files() {
  const [properties, setProperties] = useState([])
  const [tenants, setTenants] = useState([])
  const [selectedEntity, setSelectedEntity] = useState(null) // {type, id, label}
  const [entityType, setEntityType] = useState('property')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadLists() }, [])

  async function loadLists() {
    setLoading(true)
    try {
      const [pRes, tRes] = await Promise.all([
        api.get('/properties'),
        api.get('/tenants'),
      ])
      setProperties(pRes.data)
      setTenants(tRes.data)
      // Auto-select first property
      if (pRes.data.length > 0) {
        setSelectedEntity({ type: 'property', id: pRes.data[0].id, label: pRes.data[0].name })
      }
    } finally {
      setLoading(false)
    }
  }

  const entityOptions = entityType === 'property'
    ? properties.map(p => ({ type: 'property', id: p.id, label: p.name }))
    : tenants.map(t => ({ type: 'tenant', id: t.id, label: t.full_name }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Files & Documents</h1>
        <p className="text-sm text-gray-500 mt-1">Upload and manage documents across your portfolio</p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex gap-1">
                {['property', 'tenant'].map(t => (
                  <button
                    key={t}
                    onClick={() => { setEntityType(t); setSelectedEntity(null) }}
                    className={`flex-1 py-1 rounded text-xs font-semibold transition-colors ${
                      entityType === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {ENTITY_LABELS[t]}s
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-3 text-sm text-gray-400">Loading...</p>
              ) : entityOptions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">None found.</p>
              ) : entityOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedEntity(opt)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    selectedEntity?.id === opt.id && selectedEntity?.type === opt.type
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* File panel */}
        <div className="col-span-3">
          {!selectedEntity ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              Select a property or tenant from the left to view their files.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="mb-5 pb-4 border-b border-gray-100 flex items-center gap-3">
                <span className="text-2xl">{selectedEntity.type === 'property' ? '🏠' : '👤'}</span>
                <div>
                  <h2 className="font-bold text-gray-900">{selectedEntity.label}</h2>
                  <p className="text-xs text-gray-500">{ENTITY_LABELS[selectedEntity.type]}</p>
                </div>
              </div>
              <FileAttachments entityType={selectedEntity.type} entityId={selectedEntity.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
