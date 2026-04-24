import { PageHeader } from '../components/Illustration'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import FileAttachments from '../components/FileAttachments'

const SECTIONS = [
  { key: 'property',   label: 'Properties', icon: '🏠', link: id => `/properties/${id}` },
  { key: 'landlord',   label: 'Landlords',  icon: '🏢', link: id => `/landlords/${id}` },
  { key: 'tenant',     label: 'Tenants',    icon: '👤', link: id => `/tenants/${id}` },
  { key: 'contractor', label: 'Contractors',icon: '🔧', link: id => `/contractors/${id}` },
]

export default function Files() {
  const [data, setData] = useState({ property: [], landlord: [], tenant: [], contractor: [] })
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('property')
  const [selectedEntity, setSelectedEntity] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [pRes, lRes, tRes, cRes] = await Promise.all([
        api.get('/properties'),
        api.get('/landlord/landlords'),
        api.get('/tenants'),
        api.get('/contractors'),
      ])
      const d = {
        property:   pRes.data.map(p => ({ id: p.id, label: p.name,       sub: p.address || '' })),
        landlord:   lRes.data.map(l => ({ id: l.id, label: l.full_name,  sub: l.email || '' })),
        tenant:     tRes.data.map(t => ({ id: t.id, label: t.full_name,  sub: t.email || '' })),
        contractor: cRes.data.map(c => ({ id: c.id, label: c.company_name || c.full_name, sub: [c.company_name ? c.full_name : null, c.trade].filter(Boolean).join(' · ') })),
      }
      setData(d)
      // Auto-select first property
      if (d.property.length > 0) {
        setSelectedEntity({ type: 'property', ...d.property[0] })
      }
    } finally {
      setLoading(false)
    }
  }

  const section = SECTIONS.find(s => s.key === activeSection)
  const items = data[activeSection] || []

  const selectSection = (key) => {
    setActiveSection(key)
    setSelectedEntity(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Files & Documents" subtitle="Upload and manage documents across your portfolio" />

      <div className="grid grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="col-span-1 space-y-2">

          {/* Section tabs */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => selectSection(s.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-b border-gray-100 last:border-b-0 transition-colors
                  ${activeSection === s.key ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <span className="text-base">{s.icon}</span>
                <span className="flex-1 text-left">{s.label}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal
                  ${activeSection === s.key ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                  {loading ? '…' : data[s.key]?.length}
                </span>
              </button>
            ))}
          </div>

          {/* Entity list */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{section?.label}</p>
            </div>
            <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
              {loading ? (
                <p className="px-4 py-3 text-sm text-gray-400">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No {section?.label.toLowerCase()} found.</p>
              ) : items.map(item => {
                const isSelected = selectedEntity?.type === activeSection && selectedEntity?.id === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedEntity({ type: activeSection, ...item })}
                    className={`w-full text-left px-4 py-3 transition-colors
                      ${isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : 'hover:bg-gray-50'}`}
                  >
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {item.label}
                    </p>
                    {item.sub && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{item.sub}</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* File panel */}
        <div className="col-span-3">
          {!selectedEntity ? (
            <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
              <div className="text-4xl mb-3">{section?.icon}</div>
              <p className="text-sm text-gray-500">Select a {section?.label.slice(0, -1).toLowerCase()} from the left to view their files.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{section?.icon}</span>
                  <div>
                    <h2 className="font-bold text-gray-900">{selectedEntity.label}</h2>
                    <p className="text-xs text-gray-500">{section?.label.slice(0, -1)}{selectedEntity.sub ? ` · ${selectedEntity.sub}` : ''}</p>
                  </div>
                </div>
                {section?.link && (
                  <Link
                    to={section.link(selectedEntity.id)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    View profile →
                  </Link>
                )}
              </div>
              <div className="p-6">
                <FileAttachments entityType={selectedEntity.type} entityId={selectedEntity.id} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
