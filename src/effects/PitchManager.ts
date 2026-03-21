import type { AudioEffect } from '../interfaces'

/**
 * Audio effect that manages pitch and speed adjustment for synthesized speech.
 */
export class PitchManager implements AudioEffect {
  constructor(public basePitch: number = 1.0, private speedRatio: number = 1.0, public randomness: number = 0.0) { }

  public apply(buffer: Float32Array, pitchRatio: number): Float32Array {
    if (pitchRatio === 1.0 && this.speedRatio === 1.0) return buffer
    if (buffer.length === 0) return buffer

    const pitchedLength = Math.floor(buffer.length / pitchRatio)
    const pitchedBuffer = new Float32Array(pitchedLength)

    for (let i = 0; i < pitchedLength; i++) {
      const srcIndex = i * pitchRatio
      const srcInt = Math.floor(srcIndex)
      const srcFrac = srcIndex - srcInt
      const v1 = buffer[srcInt] || 0
      const v2 = buffer[srcInt + 1] || 0
      pitchedBuffer[i] = v1 + srcFrac * (v2 - v1)
    }

    const targetLength = Math.floor(buffer.length / this.speedRatio)
    const finalBuffer = new Float32Array(targetLength)

    for (let i = 0; i < targetLength; i++) {
      finalBuffer[i] = i < pitchedLength ? pitchedBuffer[i] : 0
    }

    const fadeSamples = Math.min(256, Math.floor(pitchedLength / 4))
    const endIdx = Math.min(targetLength, pitchedLength)

    for (let i = 0; i < fadeSamples; i++) {
      if (i < targetLength) {
        finalBuffer[i] *= (i / fadeSamples)
      }
      const outIdx = endIdx - 1 - i
      if (outIdx >= 0 && outIdx < targetLength) {
        finalBuffer[outIdx] *= (i / fadeSamples)
      }
    }

    return finalBuffer
  }
}
