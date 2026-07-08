import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const getLatestReading = () => api.get('/readings/latest/')
export const getReadings = (limit = 50) => api.get(`/readings/?limit=${limit}`)
export const postReading = (data) => api.post('/readings/', data)
export const simulateReading = () => api.post('/readings/simulate/')
export const seedData = () => api.post('/readings/seed/')

export const getAlerts = () => api.get('/alerts/')
export const markAlertRead = (id) => api.patch(`/alerts/${id}/read/`)
export const markAllRead = () => api.post('/alerts/mark-all-read/')
export const deleteAllAlerts = () => api.delete('/alerts/delete-all/')

export const getVentilationStatus = () => api.get('/ventilation/')
export const controlVentilation = (action) => api.post('/ventilation/control/', { action })

export const sendChatMessage = (message, history = []) => api.post('/chat/', { message, history })

export default api
