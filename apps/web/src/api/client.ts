import axios from 'axios'
import { getLanguage } from '../i18n'

const TOKEN_STORAGE_KEY = 'tcms.accessToken'

// 开发环境经 vite.config.ts 的 proxy 转发 /api -> http://localhost:3000
export const apiClient = axios.create({
  baseURL: '/api',
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // 告诉后端当前界面语言, 让 nestjs-i18n 把错误提示翻译成对应语言 (见 app.module.ts 的 HeaderResolver)
  config.headers['X-Lang'] = getLanguage()
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      if (location.pathname !== '/login') {
        location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_STORAGE_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_STORAGE_KEY),
}
