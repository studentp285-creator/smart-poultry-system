import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const getLatestReading = () => api.get('/readings/latest/')
export const getReadings = (limit = 50) => api.get(`/readings/?limit=${limit}`)
export const postReading = (data) => api.post('/readings/', data)

export const getAlerts = () => api.get('/alerts/')
export const markAlertRead = (id) => api.patch(`/alerts/${id}/read/`)
export const markAllRead = () => api.post('/alerts/mark-all-read/')
export const deleteAllAlerts = () => api.delete('/alerts/delete-all/')

export const getVentilationStatus = () => api.get('/ventilation/')
export const controlVentilation = (action) => api.post('/ventilation/control/', { action })

export const sendChatMessage = (message, history = []) => api.post('/chat/', { message, history })

export const getThresholds = () => api.get('/thresholds/')
export const updateThresholds = (data) => api.post('/thresholds/update/', data)

export const deleteReadAlerts = () => api.delete('/alerts/delete-read/')
export const getChatStatus    = () => api.get('/chat/status/')

export const checkEmailRegistered = (email) => api.post('/auth/check-email/', { email })

export const getAppSettings    = ()     => api.get('/settings/')
export const updateAppSettings = (data) => api.post('/settings/', data)

export default api
