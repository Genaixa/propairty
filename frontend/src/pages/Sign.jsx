/**
 * Public e-signature page — no login required.
 * Reached via /sign/:token
 */
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import SignaturePad from 'signature_pad'
import axios from 'axios'

const BASE = 'https://propairty.co.uk'

function api(path) { return `${BASE}/api/signing${path}` }

const STATUS_COPY = {
  signed:   { icon: '✅', title: 'Already signed', body: 'This document has already been signed. No further action is needed.' },
  declined: { icon: '❌', title: 'Document declined', body: 'You previously declined to sign this document. Please contact your agent if you have questions.' },
  expired:  { icon: '⏰', title: 'Link expired', body: 'This signing link has expired. Please ask your agent to send a new one.' },
}

export default function Sign() {
  const { token } = useParams()
  const [sr, setSr] = useState(null)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('loading') // loading | review | sign | done | terminal
  const [nameConfirm, setNameConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signedAt, setSignedAt] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const canvasRef = useRef(null)
  const padRef = useRef(null)

  useEffect(() => {
    axios.get(api(`/${token}`))
      .then(r => {
        setSr(r.data)
        if (['signed','declined','expired'].includes(r.data.status)) {
          setStep('terminal')
        } else {
          setStep('review')
        }
      })
      .catch(e => {
        setError(e.response?.data?.detail || 'Link not found or invalid.')
        setStep('terminal')
      })
  }, [token])

  useEffect(() => {
    if (step === 'sign' && canvasRef.current) {
      const pad = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(255,255,255)',
        penColor: '#1e1b4b',
      })
      padRef.current = pad
      // Resize canvas to match display size
      const resize = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ratio = Math.max(window.devicePixelRatio || 1, 1)
        const data = pad.toData()
        canvas.width = canvas.offsetWidth * ratio
        canvas.height = canvas.offsetHeight * ratio
        canvas.getContext('2d').scale(ratio, ratio)
        pad.fromData(data)
      }
      resize()
      window.addEventListener('resize', resize)
      return () => window.removeEventListener('resize', resize)
    }
  }, [step])

  function clearPad() { padRef.current?.clear() }

  async function submit() {
    if (!padRef.current || padRef.current.isEmpty()) {
      alert('Please draw your signature before submitting.')
      return
    }
    if (!nameConfirm.trim()) {
      alert('Please type your full name to confirm.')
      return
    }
    if (!agreed) {
      alert('Please agree to use electronic signature.')
      return
    }
    setSubmitting(true)
    try {
      const sigData = padRef.current.toDataURL('image/png')
      const r = await axios.post(api(`/${token}/sign`), {
        signature_data: sigData,
        signer_name_confirm: nameConfirm.trim(),
      })
      setSignedAt(r.data.signed_at)
      setDownloadUrl(r.data.download_url)
      setStep('done')
    } catch (e) {
      alert(e.response?.data?.detail || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function decline() {
    if (!confirm('Are you sure you want to decline this document? Your agent will be notified.')) return
    try {
      await axios.post(api(`/${token}/decline`))
      setSr(prev => ({ ...prev, status: 'declined' }))
      setStep('terminal')
    } catch (e) {
      alert(e.response?.data?.detail || 'Error declining.')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-lg font-bold text-indigo-600">Prop<span className="text-gray-900">AI</span>rty</span>
          <span className="text-xs text-gray-400">Electronic Document Signing</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Loading */}
        {step === 'loading' && (
          <div className="text-center py-20 text-gray-400">Loading document…</div>
        )}

        {/* Terminal states (signed/declined/expired/error) */}
        {step === 'terminal' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
            {error ? (
              <>
                <p className="text-5xl mb-4">⚠️</p>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Link not found</h2>
                <p className="text-gray-500">{error}</p>
              </>
            ) : sr && STATUS_COPY[sr.status] ? (
              <>
                <p className="text-5xl mb-4">{STATUS_COPY[sr.status].icon}</p>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{STATUS_COPY[sr.status].title}</h2>
                <p className="text-gray-500 max-w-sm mx-auto">{STATUS_COPY[sr.status].body}</p>
                {sr.status === 'signed' && (
                  <a href={`${BASE}/api/signing/${token}/download`} target="_blank" rel="noreferrer"
                    className="mt-6 inline-block bg-indigo-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors">
                    Download signed document
                  </a>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
            <p className="text-5xl mb-4">✅</p>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Document signed</h2>
            <p className="text-gray-500 mb-1">Thank you, <strong>{sr?.signer_name}</strong>.</p>
            <p className="text-gray-500 mb-6 text-sm">
              Signed on {signedAt ? new Date(signedAt).toLocaleString('en-GB') : '—'}.
              A copy will be held by your agent.
            </p>
            <a href={downloadUrl} target="_blank" rel="noreferrer"
              className="inline-block bg-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors">
              Download your signed copy (PDF)
            </a>
            <p className="text-xs text-gray-400 mt-4">
              Reference: {token?.slice(0, 8).toUpperCase()}
            </p>
          </div>
        )}

        {/* Review step */}
        {step === 'review' && sr && (
          <div className="space-y-6">
            {/* Header card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-start gap-4">
                <div className="bg-indigo-100 rounded-xl p-3 text-2xl">📄</div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Document for signature</p>
                  <h1 className="text-xl font-bold text-gray-900">{sr.doc_label}</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Sent by <strong>{sr.org_name}</strong> · For signature by <strong>{sr.signer_name}</strong>
                  </p>
                  {sr.expires_at && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⏰ Link expires {new Date(sr.expires_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <strong>How to sign:</strong> Review the information above, then click "Proceed to Sign" to draw your signature.
              Your electronic signature is legally binding under UK law (Electronic Communications Act 2000).
            </div>

            {/* What you're signing */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Document details</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-32 shrink-0">Document:</dt>
                  <dd className="text-gray-900 font-medium">{sr.doc_label}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-32 shrink-0">Sent by:</dt>
                  <dd className="text-gray-900">{sr.org_name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-32 shrink-0">Signer:</dt>
                  <dd className="text-gray-900">{sr.signer_name} ({sr.signer_email})</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-32 shrink-0">Reference:</dt>
                  <dd className="text-gray-400 font-mono text-xs">{token?.slice(0,8).toUpperCase()}</dd>
                </div>
              </dl>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('sign')}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors text-base">
                Proceed to Sign →
              </button>
              <button onClick={decline}
                className="px-5 py-3.5 border border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900 font-medium rounded-xl transition-colors text-sm">
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Sign step */}
        {step === 'sign' && sr && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Sign: {sr.doc_label}</h2>
              <p className="text-sm text-gray-500">Draw your signature below using your mouse or finger.</p>
            </div>

            {/* Signature canvas */}
            <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your signature</span>
                <button onClick={clearPad}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '160px', display: 'block', touchAction: 'none' }}
              />
            </div>

            {/* Name confirmation */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Type your full name to confirm
                </label>
                <input
                  type="text"
                  value={nameConfirm}
                  onChange={e => setNameConfirm(e.target.value)}
                  placeholder={sr.signer_name}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 leading-snug">
                  I agree to sign this document electronically. I understand my electronic signature is legally binding
                  under the Electronic Communications Act 2000 and has the same effect as a handwritten signature.
                </span>
              </label>
            </div>

            {/* Audit notice */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
              🔒 Your IP address, the time and date of signing will be recorded as part of a tamper-evident audit trail
              and embedded in the final PDF.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('review')}
                className="px-5 py-3.5 border border-gray-300 text-gray-600 hover:text-gray-900 font-medium rounded-xl transition-colors">
                ← Back
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-base">
                {submitting ? 'Submitting…' : 'Submit Signature'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="text-center py-8 text-xs text-gray-400">
        Powered by <span className="font-semibold text-indigo-500">PropAIrty</span> &nbsp;·&nbsp;
        Electronic signatures comply with UK Electronic Communications Act 2000
      </div>
    </div>
  )
}
