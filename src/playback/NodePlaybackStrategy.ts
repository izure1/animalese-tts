import type { PlaybackStrategy } from '../interfaces'
import * as fs from 'node:fs'
import * as path from 'node:path'

export class NodePlaybackStrategy implements PlaybackStrategy {
  private outputIndex = 0

  public async play(bufferData: Float32Array): Promise<void> {
    const sampleRate = 44100
    const wavBuffer = this.encodeWAV(bufferData, sampleRate)

    this.outputIndex++
    const filename = path.resolve(process.cwd(), `output_${this.outputIndex}.wav`)
    await fs.promises.writeFile(filename, wavBuffer)
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
      const s = Math.max(-1, Math.min(1, samples[i]))
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
