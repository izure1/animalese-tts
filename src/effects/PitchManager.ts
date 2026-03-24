import type { AudioEffect } from '../interfaces'

export interface PitchManagerOptions {
  pitch?: number;
  speed?: number;
  randomness?: number;
  melodyRate?: number;
  melodyAmplitude?: number;
}

/**
 * Audio effect that manages pitch and speed adjustment for synthesized speech.
 */
export class PitchManager implements AudioEffect {
  public readonly pitch: number;
  public readonly speed: number;
  public readonly randomness: number;
  public readonly melodyRate: number;
  public readonly melodyAmplitude: number;

  constructor(options: PitchManagerOptions = {}) {
    this.pitch = options.pitch ?? 1.5
    this.speed = options.speed ?? 4.0
    this.randomness = options.randomness ?? 0.1
    this.melodyRate = options.melodyRate ?? 0.05
    this.melodyAmplitude = options.melodyAmplitude ?? 0.1
  }

  public calculatePitch(charIndex: number): number {
    let currentPitch = this.pitch

    const stepDegrees = 360 * this.melodyRate
    const radianStep = stepDegrees * (Math.PI / 180)

    currentPitch += Math.sin(charIndex * radianStep) * this.melodyAmplitude

    return currentPitch + (Math.random() - 0.5) * this.randomness
  }

  public apply(buffer: Float32Array, pitchRatio: number): Float32Array {
    if (pitchRatio === 1.0 && this.speed === 1.0) return buffer
    if (buffer.length === 0) return buffer

    // Apply adaptive zero-phase low-pass filter to prevent aliasing without muffling vowels
    let processBuffer = buffer
    if (pitchRatio > 1.0) {
      // 1. Calculate Zero-Crossing Rate (ZCR) to distinguish vowels (low ZCR) from fricatives/noise (high ZCR)
      let zcr = 0
      for (let i = 1; i < buffer.length; i++) {
        if ((buffer[i] >= 0 && buffer[i - 1] < 0) || (buffer[i] < 0 && buffer[i - 1] >= 0)) {
          zcr++
        }
      }
      const zcrRate = zcr / buffer.length

      // 2. Map ZCR to a noise factor (0.0 for vowels, 1.0 for harsh noise like '스')
      const noiseFactor = Math.max(0, Math.min(1, (zcrRate - 0.1) / 0.2))

      // 3. Vowels get light filtering (0.8) to preserve brightness.
      // Noise/fricatives get aggressive filtering (0.3) to kill harsh wind noises.
      const cutRatio = 0.85 - (0.55 * noiseFactor)
      const alpha = Math.min(1.0, cutRatio / pitchRatio)

      const filtered = new Float32Array(buffer.length)

      // Pass 1: Forward
      let lastVal = 0
      for (let i = 0; i < buffer.length; i++) {
        lastVal = lastVal + alpha * (buffer[i] - lastVal)
        filtered[i] = lastVal
      }

      // Pass 2: Backward (Zero-phase)
      lastVal = 0
      for (let i = buffer.length - 1; i >= 0; i--) {
        lastVal = lastVal + alpha * (filtered[i] - lastVal)
        filtered[i] = lastVal
      }

      // If it's noisy/fricative, apply two more passes for a steeper -24dB/oct cutoff
      if (noiseFactor > 0.5) {
        lastVal = 0
        for (let i = 0; i < buffer.length; i++) {
          lastVal = lastVal + alpha * (filtered[i] - lastVal)
          filtered[i] = lastVal
        }

        lastVal = 0
        for (let i = buffer.length - 1; i >= 0; i--) {
          lastVal = lastVal + alpha * (filtered[i] - lastVal)
          filtered[i] = lastVal
        }
      }

      processBuffer = filtered
    }

    const pitchedLength = Math.floor(processBuffer.length / pitchRatio)
    const pitchedBuffer = new Float32Array(pitchedLength)

    for (let i = 0; i < pitchedLength; i++) {
      const srcIndex = i * pitchRatio
      const srcInt = Math.floor(srcIndex)
      const srcFrac = srcIndex - srcInt
      const v1 = processBuffer[srcInt] || 0
      const v2 = processBuffer[srcInt + 1] || 0
      pitchedBuffer[i] = v1 + srcFrac * (v2 - v1)
    }

    const targetLength = Math.floor(buffer.length / this.speed)
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
