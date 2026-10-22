/**
 * 纯前端高可靠音频拼接与多格式导出引擎
 * 
 * 核心技术栈：
 * 1. 采用浏览器原生 Web Audio API 进行 AudioBuffer 拼接与时间线调度 (彻底杜绝第三方库 CommonJS 导出 bug)
 * 2. 引入 @breezystack/lamejs 进行纯客户端 MP3 192kbps 压缩编码
 * 3. 支持无损原音 WAV 与 高压缩比 MP3 双格式自由导出
 */

import { Mp3Encoder } from '@breezystack/lamejs'

export type ExportAudioFormat = 'mp3' | 'wav'

/**
 * 获取浏览器原生 AudioContext
 */
export const getAudioContext = (): AudioContext => {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  return new AudioCtx()
}

/**
 * 触发浏览器本地保存文件
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1500)
}

/**
 * 将 AudioBuffer 拼接为一个完整音轨，并在各分片之间插入自然呼吸停顿 (默认 0.38s)
 */
export const concatAudioBuffers = (
  audioCtx: AudioContext,
  buffers: AudioBuffer[],
  gapSeconds = 0.38
): AudioBuffer => {
  if (buffers.length === 0) {
    return audioCtx.createBuffer(1, 1, audioCtx.sampleRate)
  }
  if (buffers.length === 1) {
    return buffers[0]
  }

  const sampleRate = buffers[0].sampleRate
  const channels = Math.max(...buffers.map(b => b.numberOfChannels))
  const gapSamples = Math.floor(gapSeconds * sampleRate)

  // 计算拼接后的总采样长度 (包含呼吸停顿)
  const totalLength =
    buffers.reduce((sum, b) => sum + b.length, 0) + (buffers.length - 1) * gapSamples

  const merged = audioCtx.createBuffer(channels, totalLength, sampleRate)

  for (let channel = 0; channel < channels; channel++) {
    const outputData = merged.getChannelData(channel)
    let currentOffset = 0

    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i]
      const inputData =
        channel < buffer.numberOfChannels
          ? buffer.getChannelData(channel)
          : buffer.getChannelData(0)

      outputData.set(inputData, currentOffset)
      currentOffset += buffer.length

      // 插入自然对话呼吸间隔
      if (i < buffers.length - 1) {
        currentOffset += gapSamples
      }
    }
  }

  return merged
}

/**
 * 利用 @breezystack/lamejs 将 AudioBuffer 压缩编码为高音质 MP3
 */
export const audioBufferToMp3 = (buffer: AudioBuffer, kbps = 192): Blob => {
  const channels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const mp3encoder = new Mp3Encoder(channels, sampleRate, kbps)

  // 转换为 16-bit PCM Int16Array
  const leftFloat = buffer.getChannelData(0)
  const leftInt16 = new Int16Array(leftFloat.length)
  for (let i = 0; i < leftFloat.length; i++) {
    const s = Math.max(-1, Math.min(1, leftFloat[i]))
    leftInt16[i] = s < 0 ? s * 32768 : s * 32767
  }

  let rightInt16: Int16Array | undefined
  if (channels > 1) {
    const rightFloat = buffer.getChannelData(1)
    rightInt16 = new Int16Array(rightFloat.length)
    for (let i = 0; i < rightFloat.length; i++) {
      const s = Math.max(-1, Math.min(1, rightFloat[i]))
      rightInt16[i] = s < 0 ? s * 32768 : s * 32767
    }
  }

  const mp3Data: Uint8Array[] = []
  const sampleBlockSize = 1152
  for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize)
    const rightChunk = rightInt16 ? rightInt16.subarray(i, i + sampleBlockSize) : undefined
    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk)
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf)
    }
  }

  const mp3buf = mp3encoder.flush()
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf)
  }

  return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' })
}

/**
 * 原生将 AudioBuffer 导出为标准的无损 WAV (16-bit PCM)
 */
export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels
  const length = buffer.length * numOfChan * 2 + 44
  const outBuffer = new ArrayBuffer(length)
  const view = new DataView(outBuffer)
  const channels: Float32Array[] = []
  const sampleRate = buffer.sampleRate
  let offset = 0
  let pos = 0

  const writeString = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(pos++, str.charCodeAt(i))
    }
  }

  writeString('RIFF')
  view.setUint32(pos, length - 8, true)
  pos += 4
  writeString('WAVE')

  writeString('fmt ')
  view.setUint32(pos, 16, true)
  pos += 4
  view.setUint16(pos, 1, true) // PCM
  pos += 2
  view.setUint16(pos, numOfChan, true)
  pos += 2
  view.setUint32(pos, sampleRate, true)
  pos += 4
  view.setUint32(pos, sampleRate * 2 * numOfChan, true)
  pos += 4
  view.setUint16(pos, numOfChan * 2, true)
  pos += 2
  view.setUint16(pos, 16, true)
  pos += 2

  writeString('data')
  view.setUint32(pos, length - pos - 4, true)
  pos += 4

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]))
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0
      view.setInt16(pos, sample, true)
      pos += 2
    }
    offset++
  }

  return new Blob([view], { type: 'audio/wav' })
}

/**
 * 统一调度导出并触发下载
 */
export const exportAndDownloadAudio = (
  buffer: AudioBuffer,
  format: ExportAudioFormat,
  filename: string
): { sizeKb: string } => {
  let blob: Blob
  let finalName = filename

  if (format === 'mp3') {
    if (!finalName.toLowerCase().endsWith('.mp3')) finalName += '.mp3'
    blob = audioBufferToMp3(buffer, 192)
  } else {
    if (!finalName.toLowerCase().endsWith('.wav')) finalName += '.wav'
    blob = audioBufferToWav(buffer)
  }

  downloadBlob(blob, finalName)
  const sizeKb = (blob.size / 1024).toFixed(1) + ' KB'
  return { sizeKb }
}
