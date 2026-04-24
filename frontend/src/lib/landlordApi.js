import axios from 'axios'

const landlordApi = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '/api') + '/landlord',
})

landlordApi.interceptors.request.use(config => {
  const token = localStorage.getItem('landlord_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

landlordApi.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('landlord_token')
      window.location.href = '/landlord/login'
    }
    return Promise.reject(err)
  }
)

export default landlordApi
