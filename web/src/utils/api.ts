/**
 * 统一后端 API 地址生成工具
 * 在开发环境默认走 Vite 代理，在生产环境默认直连独立后端域名 https://api-ai.cheatppf.xyz
 */
const envBase = (import.meta.env.VITE_API_BASE_URL as string) || ''
const rawBase = envBase || (import.meta.env.PROD ? 'https://api-ai.cheatppf.xyz' : '')
export const API_BASE_URL = rawBase.replace(/\/+$/, '')

export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${cleanPath}`
}
