export type ExportAudioFormat = 'mp3' | 'wav'

export interface VoiceMeta {
  id: string
  name: string
  tag: string
  desc: string
  color: string
}

export interface DialogueItem {
  id: string
  voice: string
  text: string
  customAcoustics?: boolean // 是否启用该角色独立声学定制
  speedMultiplier?: number  // 专属语速 0.5x ~ 2.0x
  pitchOffset?: number      // 专属音高 -50Hz ~ +50Hz
  showSettings?: boolean    // 调音抽屉展开折叠
}
