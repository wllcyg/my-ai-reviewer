import { ElectronAPI } from '@electron-toolkit/preload'
import type { CustomAPI } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
