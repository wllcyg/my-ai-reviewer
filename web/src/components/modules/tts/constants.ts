import type { VoiceMeta } from './types'

export const VOICES: VoiceMeta[] = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', tag: '温柔女声', desc: '自然清晰、通用助手首选', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'zh-CN-YunxiNeural', name: '云希', tag: '阳光男声', desc: '影视解说、故事旁白', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'zh-CN-YunjianNeural', name: '云健', tag: '沉稳男声', desc: '新闻播音、专业汇报', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', name: '辽宁小北', tag: '🔥 东北老铁', desc: '地道幽默口音、爆款搞笑解说', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'zh-TW-HsiaoChenNeural', name: '台湾晓臻', tag: '🧋 甜美台湾腔', desc: '温和自然、生活情感 VLOG', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { id: 'zh-HK-WanLungNeural', name: '香港云龙', tag: '🇭🇰 港风粤语', desc: '纯正广府粤语、港剧男主风味', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', name: '陕西小妮', tag: '🏮 关中方言', desc: '秦腔地域风情、民俗短剧', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'en-US-JennyNeural', name: 'Jenny', tag: '北美英文', desc: '自然标准美语、海外出海必备', color: 'bg-purple-50 text-purple-700 border-purple-200' }
]

export const getVoiceMeta = (id: string): VoiceMeta => {
  return VOICES.find(v => v.id === id) || VOICES[0]
}
