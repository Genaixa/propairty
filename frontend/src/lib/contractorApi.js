import axios from 'axios'

const contractorApi = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:8000/api') + '/contractor',
})

contractorApi.interceptors.request.use(config => {
  const token = localStorage.getItem('contractor_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

contractorApi.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('contractor_token')
      window.location.href = '/contractor/login'
    }
    return Promise.reject(err)
  }
)

export default contractorApi
