import axios from 'axios'

// 开发环境经 vite.config.ts 的 proxy 转发 /api -> http://localhost:3000
export const apiClient = axios.create({
  baseURL: '/api',
})

// 一期尚未接入认证 (见需求清单 5.2 认证/权限: 计划用 WorkOS/Clerk, 未来在此处补充 Authorization 头)
export const DEMO_TENANT_ID = 'demo-tenant'
