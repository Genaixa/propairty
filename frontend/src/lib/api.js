import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

/** Build an authenticated download URL for /api/uploads/{id}/download.
 *  Works for both agent (token) and tenant (tenant_token) sessions.
 */
export const dlUrl = (fileId) => {
  const token = localStorage.getItem('token') || localStorage.getItem('tenant_token') || ''
  return `/api/uploads/${fileId}/download?token=${encodeURIComponent(token)}`
}
