import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import PublicLayout, { bb, bt, useOrgData, PageHero } from './PublicLayout'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://propairty.co.uk'

const D = '#4f46e5'

export default function PublicContact() {
  const { slug } = useParams()
  const { org } = useOrgData(slug)
  const brand = org?.brand_color || D

  const [form, setForm] = useState({ full_name: '', email: '', phone: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true); setError('')
    try {
      await axios.post(`${API_BASE}/api/public/${slug}/contact`, form)
      setSent(true)
    } catch (ex) {
      setError(ex.response?.data?.detail || 'Failed to send — please try again.')
    }
    setSending(false)
  }

  const field = (key, label, type = 'text', placeholder = '', required = false) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && ' *'}</label>
      <input type={type} required={required} value={form[key]} placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
    </div>
  )

  return (
    <PublicLayout slug={slug} org={org} brand={brand}>
      <PageHero title="Get in touch" subtitle="We'd love to hear from you. Fill in the form or contact us directly." page="contact" brand={brand} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
          {/* Form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            {sent ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={bb(brand)}>
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Message sent!</h2>
                <p className="text-sm text-gray-500">We'll get back to you within one business day.</p>
                <button onClick={() => { setSent(false); setForm({ full_name:'',email:'',phone:'',subject:'',message:'' }) }}
                  className="mt-5 text-sm font-semibold hover:underline" style={bt(brand)}>
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Send us a message</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field('full_name', 'Your name', 'text', 'Jane Smith', true)}
                  {field('email', 'Email address', 'email', 'jane@example.com', true)}
                </div>
                {field('phone', 'Phone', 'tel', '07700 900000')}
                {field('subject', 'Subject', 'text', 'I have a question about…')}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
                  <textarea required rows={5} value={form.message} placeholder="Your message…"
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-white" />
                </div>
                {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2">{error}</p>}
                <button type="submit" disabled={sending}
                  className="w-full text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60 transition-opacity hover:opacity-90"
                  style={bb(brand)}>
                  {sending ? 'Sending…' : 'Send message'}
                </button>
              </form>
            )}
          </div>

          {/* Contact info */}
          <div className="space-y-6">
            {org && (
              <>
                {[
                  org.address_text && { icon: '📍', label: 'Address', value: org.address_text },
                  org.phone && { icon: '📞', label: 'Phone', value: org.phone, href: `tel:${org.phone}` },
                  org.email && { icon: '✉️', label: 'Email', value: org.email, href: `mailto:${org.email}` },
                  org.website_url && { icon: '🌐', label: 'Website', value: org.website_url.replace(/^https?:\/\//,''), href: org.website_url },
                ].filter(Boolean).map(item => (
                  <div key={item.label} className="flex items-start gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
                      {item.href
                        ? <a href={item.href} className="text-sm font-medium hover:underline" style={bt(brand)}>{item.value}</a>
                        : <p className="text-sm text-gray-700 whitespace-pre-line">{item.value}</p>}
                    </div>
                  </div>
                ))}

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">View our properties</p>
                  <a href={`/site/${slug}`}
                    className="flex items-center gap-2 text-sm font-semibold hover:underline"
                    style={bt(brand)}>
                    Browse available lets →
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
