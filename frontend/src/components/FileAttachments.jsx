import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'

const CATEGORY_LABELS = {
  certificate: 'Certificate',
  agreement: 'Agreement',
  photo: 'Photo',
  invoice: 'Invoice',
  correspondence: 'Correspondence',
  other: 'Other',
}

const CATEGORY_COLORS = {
  certificate: 'bg-green-100 text-green-700',
  agreement: 'bg-blue-100 text-blue-700',
  photo: 'bg-purple-100 text-purple-700',
  invoice: 'bg-orange-100 text-orange-700',
  correspondence: 'bg-yellow-100 text-yellow-700',
  other: 'bg-gray-100 text-gray-600',
}

function fileIcon(mime) {
  if (!mime) return '📄'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime === 'application/pdf') return '📕'
  if (mime.includes('word')) return '📝'
  if (mime.includes('zip')) return '📦'
  return '📄'
}

function fileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function FileAttachments({ entityType, entityId, compact = false }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ category: 'other', description: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef()

  useEffect(() => { load() }, [entityType, entityId])

  async function load() {
    try {
      const res = await api.get('/uploads', { params: { entity_type: entityType, entity_id: entityId } })
      setFiles(res.data)
    } catch {}
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!selectedFile) return
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', selectedFile)
      form.append('entity_type', entityType)
      form.append('entity_id', entityId)
      form.append('category', uploadForm.category)
      if (uploadForm.description) form.append('description', uploadForm.description)

      await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setShowUpload(false)
      setSelectedFile(null)
      setUploadForm({ category: 'other', description: '' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed')
    }
    setUploading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this file?')) return
    await api.delete(`/uploads/${id}`)
    load()
  }

  async function handleDownload(file) {
    const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
    const token = localStorage.getItem('token')
    const res = await fetch(`${BASE}/uploads/${file.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.original_name
    a.click()
    URL.revokeObjectURL(url)
  }

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Files ({files.length})
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="text-xs text-indigo-600 font-medium hover:underline"
          >
            + Upload
          </button>
        </div>

        {files.length > 0 && (
          <div className="space-y-1">
            {files.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{fileIcon(f.mime_type)}</span>
                  <span className="text-xs text-gray-700 truncate">{f.original_name}</span>
                </div>
                <div className="flex gap-2 shrink-0 ml-2">
                  <button onClick={() => handleDownload(f)} className="text-xs text-indigo-600 hover:underline">↓</button>
                  <button onClick={() => handleDelete(f.id)} className="text-xs text-red-400 hover:text-red-600">×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showUpload && (
          <UploadModal
            uploadForm={uploadForm}
            setUploadForm={setUploadForm}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileRef={fileRef}
            uploading={uploading}
            error={error}
            onSubmit={handleUpload}
            onClose={() => { setShowUpload(false); setError('') }}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">Files & Documents</h3>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50"
        >
          + Upload File
        </button>
      </div>

      {files.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
          <p className="text-2xl mb-2">📁</p>
          <p className="text-sm text-gray-500">No files uploaded yet</p>
          <button onClick={() => setShowUpload(true)} className="text-sm text-indigo-600 font-medium hover:underline mt-1">
            Upload your first file
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-xl shrink-0">{fileIcon(f.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{f.original_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {f.category && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[f.category] || 'bg-gray-100 text-gray-600'}`}>
                      {CATEGORY_LABELS[f.category] || f.category}
                    </span>
                  )}
                  {f.file_size && <span className="text-xs text-gray-400">{fileSize(f.file_size)}</span>}
                  {f.description && <span className="text-xs text-gray-500 truncate">{f.description}</span>}
                  <span className="text-xs text-gray-400">{f.created_at?.slice(0, 10)}</span>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <button
                  onClick={() => handleDownload(f)}
                  className="text-xs text-indigo-600 font-medium hover:underline"
                >
                  Download
                </button>
                <button
                  onClick={() => handleDelete(f.id)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          uploadForm={uploadForm}
          setUploadForm={setUploadForm}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          fileRef={fileRef}
          uploading={uploading}
          error={error}
          onSubmit={handleUpload}
          onClose={() => { setShowUpload(false); setError('') }}
        />
      )}
    </div>
  )
}

function UploadModal({ uploadForm, setUploadForm, selectedFile, setSelectedFile, fileRef, uploading, error, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Upload File</h2>
        </div>
        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">File</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            >
              {selectedFile ? (
                <div>
                  <p className="text-2xl mb-1">{fileIcon(selectedFile.type)}</p>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400">{fileSize(selectedFile.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl mb-1">📁</p>
                  <p className="text-sm text-gray-500">Click to select a file</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, images, Word docs — max 25 MB</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={e => setSelectedFile(e.target.files[0] || null)}
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.txt,.zip"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Category</label>
            <select
              value={uploadForm.category}
              onChange={e => setUploadForm({ ...uploadForm, category: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Description (optional)</label>
            <input
              type="text"
              value={uploadForm.description}
              onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder="e.g. Gas safety cert Jan 2025"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
