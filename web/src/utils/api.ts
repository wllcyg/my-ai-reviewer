/**
 * 统一后端 API 地址生成工具
 * 支持读取环境变量 VITE_API_BASE_URL，若未配置则回退到相对路径（配合 Cloudflare Pages _redirects 转发）
 */
const rawBase = (import.meta.env.VITE_API_BASE_URL as string) || ''
export const API_BASE_URL = rawBase.replace(/\/+$/, '')

export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${cleanPath}`
}
