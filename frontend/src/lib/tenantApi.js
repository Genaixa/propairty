import axios from 'axios'

const tenantApi = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '/api') + '/tenant',
})

tenantApi.interceptors.request.use(config => {
  const token = localStorage.getItem('tenant_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

tenantApi.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tenant_token')
      window.location.href = '/tenant/login'
    }
    return Promise.reject(err)
  }
)

export default tenantApi
