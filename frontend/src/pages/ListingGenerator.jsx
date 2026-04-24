import { PageHeader } from '../components/Illustration'
import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'

const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''

export default function ListingGenerator() {
  const [properties, setProperties] = useState([])
  const [selectedProp, setSelectedProp] = useState(null)
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    api.get('/properties').then(r => setProperties(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedProp) { setPhotos([]); return }
    api.get('/uploads', { params: { entity_type: 'property', entity_id: selectedProp.id } })
      .then(r => setPhotos(r.data.filter(f => f.mime_type?.startsWith('image/'))))
      .catch(() => setPhotos([]))
  }, [selectedProp])

  const vacantUnits = selectedProp?.units?.filter(u => u.status === 'vacant') || []

  async function uploadPhotos(files) {
    if (!selectedProp || !files.length) return
    setUploading(true)
    const uploaded = []
    for (const file of files) {
      const form = new FormData()
      form.append('entity_type', 'property')
      form.append('entity_id', selectedProp.id)
      form.append('category', 'photo')
      form.append('file', file)
      try {
        const r = await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } })
        if (r.data.mime_type?.startsWith('image/')) uploaded.push(r.data)
      } catch {}
    }
    setPhotos(prev => [...prev, ...uploaded])
    setUploading(false)
  }

  async function deletePhoto(id) {
    await api.delete(`/uploads/${id}`).catch(() => {})
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    uploadPhotos(files)
  }

  async function generate() {
    if (!selectedProp) return
    setLoading(true)
    setResult(null)
    try {
      const r = await api.post('/intelligence/listing', {
        property_id: selectedProp.id,
        unit_id: selectedUnit?.id || null,
      })
      setResult(r.data)
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to generate listing')
    }
    setLoading(false)
  }

  function copyText() {
    if (!result) return
    const text = result.formatted_listing || [
      result.address,
      '',
      'Key Features:',
      ...result.key_features.map(f => `• ${f}`),
      '',
      result.description,
    ].join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <PageHeader title="Listing Generator" subtitle="AI-written Rightmove-ready property listings" />
      </div>

      {/* Selector */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Property</label>
            <select
              value={selectedProp?.id || ''}
              onChange={e => {
                const p = properties.find(x => String(x.id) === e.target.value) || null
                setSelectedProp(p)
                setSelectedUnit(null)
                setResult(null)
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select property…</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.postcode}</option>
              ))}
            </select>
          </div>
          {selectedProp && vacantUnits.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit (optional)</label>
              <select
                value={selectedUnit?.id || ''}
                onChange={e => setSelectedUnit(vacantUnits.find(u => String(u.id) === e.target.value) || null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All vacant units</option>
                {vacantUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name} — {u.bedrooms} bed · £{u.monthly_rent}/mo</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedProp && vacantUnits.length === 0 && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-2.5">
            No vacant units on this property — a listing will be generated from property details only.
          </p>
        )}

        {/* Photo upload */}
        {selectedProp && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600">Property Photos</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
                {uploading ? 'Uploading…' : '+ Add photos'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => uploadPhotos(Array.from(e.target.files))}
              />
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !photos.length && fileInputRef.current?.click()}
              className={`rounded-lg border-2 border-dashed transition-colors ${
                dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'
              } ${!photos.length ? 'cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50' : ''}`}>
              {photos.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-gray-400 select-none">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Drop photos here or click to upload</p>
                  <p className="text-xs">Photos will appear in the listing PDF</p>
                </div>
              ) : (
                <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photos.map(photo => (
                    <div key={photo.id} className="relative group aspect-square rounded-md overflow-hidden bg-gray-200">
                      <img
                        src={`${API_BASE}${photo.url}`}
                        alt={photo.original_name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={e => { e.stopPropagation(); deletePhoto(photo.id) }}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                    disabled={uploading}
                    className="aspect-square rounded-md border-2 border-dashed border-gray-300 hover:border-indigo-400 flex items-center justify-center text-gray-400 hover:text-indigo-500 transition-colors text-2xl disabled:opacity-50">
                    {uploading ? '…' : '+'}
                  </button>
                </div>
              )}
            </div>
            {photos.length > 0 && (
              <p className="text-xs text-gray-400 mt-1.5">{photos.length} photo{photos.length !== 1 ? 's' : ''} · first 6 appear in PDF · drag to drop zone to add more</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={generate} disabled={!selectedProp || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading && <span className="animate-spin">⟳</span>}
            {loading ? 'Generating…' : result ? 'Regenerate' : 'Generate Listing'}
          </button>
        </div>
      </div>

      {/* Result — Rightmove-style listing preview */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Action bar */}
          <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-4">
            <p className="text-xs text-indigo-700 font-medium">
              Listing ready — copy and paste directly into Rightmove, Zoopla or OnTheMarket
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={copyText}
                className="flex items-center gap-1.5 bg-white border border-indigo-300 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                {copied ? '✓ Copied!' : '⎘ Copy listing'}
              </button>
              {result.pdf_url && (
                <a href={`${API_BASE}${result.pdf_url}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
                  ↓ Download PDF
                </a>
              )}
            </div>
          </div>

          {/* Hero photo + thumbnail strip */}
          {result.photos?.length > 0 && (
            <div className="bg-gray-900">
              <img
                src={`${API_BASE}${result.photos[0]}`}
                alt="Main photo"
                className="w-full object-cover"
                style={{ maxHeight: '340px' }}
              />
              {result.photos.length > 1 && (
                <div className="flex gap-1.5 p-2 overflow-x-auto bg-gray-800">
                  {result.photos.slice(1).map((url, i) => (
                    <img
                      key={i}
                      src={`${API_BASE}${url}`}
                      alt={`Photo ${i + 2}`}
                      className="h-16 w-auto flex-shrink-0 object-cover rounded opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Listing body */}
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-xl font-bold text-gray-900">{result.property_name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{result.address}</p>
              {selectedUnit && (
                <p className="text-lg font-semibold text-indigo-600 mt-2">£{selectedUnit.monthly_rent?.toLocaleString()}/month</p>
              )}
            </div>

            {/* Key features as badges */}
            {result.key_features?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Key Features</p>
                <div className="flex flex-wrap gap-2">
                  {result.key_features.map((f, i) => (
                    <span key={i} className="bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-full">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Full Description</p>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {result.description}
              </div>
            </div>

            {/* Paste preview */}
            {result.formatted_listing && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold text-gray-400 uppercase tracking-wide select-none hover:text-gray-600 list-none flex items-center gap-1.5">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  What gets copied
                </summary>
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{result.formatted_listing}</pre>
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
