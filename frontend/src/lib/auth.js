import api from './api'

export async function login(email, password) {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  const res = await api.post('/auth/token', form)
  localStorage.setItem('token', res.data.access_token)
}

export function logout() {
  localStorage.removeItem('token')
  window.location.href = '/login'
}

export function isLoggedIn() {
  return !!localStorage.getItem('token')
}
