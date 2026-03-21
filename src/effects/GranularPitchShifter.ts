import type { AudioEffect } from '../interfaces'

export class GranularPitchShifter implements AudioEffect {
  constructor(private speedRatio: number = 1.0) { }

  public apply(buffer: Float32Array, pitchRatio: number): Float32Array {
    if (pitchRatio === 1.0 && this.speedRatio === 1.0) return buffer
    if (buffer.length === 0) return buffer

    // 1. 재생 시간(Speed) 조절
    // 재생 시간이 길어지거나 짧아집니다. (이로 인해 피치도 함께 변질됨)
    const speedAdjustedLength = Math.floor(buffer.length / this.speedRatio)
    const speedAdjusted = new Float32Array(speedAdjustedLength)

    for (let i = 0; i < speedAdjustedLength; i++) {
      const srcIndex = i * this.speedRatio
      const srcInt = Math.floor(srcIndex)
      const srcFrac = srcIndex - srcInt
      const v1 = buffer[srcInt] || 0
      const v2 = buffer[srcInt + 1] || 0
      speedAdjusted[i] = v1 + srcFrac * (v2 - v1)
    }

    // 2. 피치 보정 및 시프팅
    // 교수님 지시사항: 재생시간 조절로 인해 낮아지거나 높아진 피치를 고려하여 보정하라.
    // 재생 시간이 길어지면(speedRatio < 1) 피치가 그만큼 낮아진 상태이므로 피치를 더 올려야 함.
    const compensatedPitchRatio = pitchRatio / this.speedRatio

    const outLength = Math.floor(speedAdjustedLength / compensatedPitchRatio)
    const finalBuffer = new Float32Array(outLength)

    for (let i = 0; i < outLength; i++) {
      const srcIndex = i * compensatedPitchRatio
      const srcInt = Math.floor(srcIndex)
      const srcFrac = srcIndex - srcInt
      const v1 = speedAdjusted[srcInt] || 0
      const v2 = speedAdjusted[srcInt + 1] || 0
      finalBuffer[i] = v1 + srcFrac * (v2 - v1)
    }

    // 3. 지지직(팝핑) 노이즈를 방지하기 위한 페이드 인/아웃 (Fade in/out) 엔벨로프
    const fadeSamples = Math.min(256, Math.floor(outLength / 4))

    for (let i = 0; i < fadeSamples; i++) {
      const fadeVol = i / fadeSamples
      finalBuffer[i] *= fadeVol
      finalBuffer[outLength - 1 - i] *= fadeVol
    }

    return finalBuffer
  }
}
