import type { FilePlaybackStrategy } from '../interfaces'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

/**
 * Playback strategy for Node.js environments.
 * Encodes the audio buffer into a WAV file and saves it to the disk.
 */
export class FilePlayer implements FilePlaybackStrategy {
  public volume: number = 1.0
  private _sampleRate: number

  constructor(sampleRate: number = 44100) {
    this._sampleRate = sampleRate
  }

  get sampleRate(): number {
    return this._sampleRate
  }

  /**
   * Updates the sample rate used when encoding WAV output files.
   * Set this after loading the sampler to match the source WAV's actual rate.
   */
  set sampleRate(rate: number) {
    this._sampleRate = rate
  }

  /**
   * Encodes and writes the provided audio buffer to a local .wav file.
   * @param bufferData The audio data to save.
   * @param outputDir The directory to save the file in.
   */
  public async play(bufferData: Float32Array, outputDir: string): Promise<string> {
    const wavBuffer = this.encodeWAV(bufferData, this.sampleRate)

    const randomFilename = `${crypto.randomUUID()}.wav`
    const filepath = path.join(outputDir, randomFilename)
    await fs.promises.writeFile(filepath, wavBuffer)
    return filepath
  }

  /**
   * Merges multiple audio buffers into one and plays the result.
   * @param buffers Array of Float32Array audio chunks.
   * @param outputDir The directory to save the file in.
   */
  public async drainAndPlay(buffers: Float32Array[], outputDir: string): Promise<string> {
    const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const buf of buffers) {
      merged.set(buf, offset)
      offset += buf.length
    }
    return this.play(merged, outputDir)
  }

  private encodeWAV(samples: Float32Array, sampleRate: number): Buffer {
    const buffer = Buffer.alloc(44 + samples.length * 2)
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.length)

    this.writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    this.writeString(view, 8, 'WAVE')
    this.writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    this.writeString(view, 36, 'data')
    view.setUint32(40, samples.length * 2, true)

    let offset = 44
    for (let i = 0, len = samples.length; i < len; i++) {
      let s = samples[i] * this.volume
      s = Math.max(-1, Math.min(1, s))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      offset += 2
    }

    return buffer
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
}
