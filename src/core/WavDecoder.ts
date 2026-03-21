export class WavDecoder {
  // 외부 파서(ffmpeg 등) 없이 순수 타입스크립트로 16-bit PCM 파싱
  public decode(buffer: Buffer): { buffer: Float32Array, sampleRate: number } {
    let numChannels = 1
    let sampleRate = 44100
    let dataOffset = 44
    let dataSize = 0

    // WAV 기본 구조 탐색 (RIFF 헤더 이후 12바이트부터 청크 시작)
    let searchOffset = 12
    while (searchOffset < buffer.length - 8) {
      const chunkId = buffer.toString('ascii', searchOffset, searchOffset + 4)
      const chunkSize = buffer.readUInt32LE(searchOffset + 4)

      if (chunkId === 'fmt ') {
        // fmt 청크의 2바이트 위치가 채널 수 (1=Mono, 2=Stereo)
        numChannels = buffer.readUInt16LE(searchOffset + 10)
        sampleRate = buffer.readUInt32LE(searchOffset + 12)
      } else if (chunkId === 'data') {
        dataOffset = searchOffset + 8
        dataSize = chunkSize
        break // 오디오 데이터 청크를 찾았으므로 탐색 종료
      }

      searchOffset += 8 + chunkSize
    }

    // 대비책: data 청크를 스펙대로 못 찾았을 경우 기본값 적용
    if (dataSize === 0) {
      dataOffset = 44
      numChannels = buffer.readUInt16LE(22)
      sampleRate = buffer.readUInt32LE(24)
      dataSize = buffer.length - 44
    }

    const numSamples = Math.floor(dataSize / (2 * numChannels))
    const floatArray = new Float32Array(numSamples)

    let offset = dataOffset
    for (let i = 0, len = numSamples; i < len; i++) {
      let sum = 0
      for (let ch = 0; ch < numChannels; ch++) {
        // 안전 장치: 버퍼 범위를 넘어가려 하면 중단
        if (offset >= buffer.length - 1) break
        const int16 = buffer.readInt16LE(offset)
        sum += int16 < 0 ? int16 / 32768.0 : int16 / 32767.0
        offset += 2
      }
      floatArray[i] = sum / numChannels
    }

    return {
      buffer: this.trimSilence(floatArray),
      sampleRate
    }
  }

  // 앞뒤 무음 구간(Noise Threshold 이하)을 잘라내어 오디오 길이 및 지연을 최적화합니다.
  private trimSilence(buffer: Float32Array, threshold: number = 0.02): Float32Array {
    let start = 0
    while (start < buffer.length && Math.abs(buffer[start]) <= threshold) {
      start++
    }

    let end = buffer.length - 1
    while (end > start && Math.abs(buffer[end]) <= threshold) {
      end--
    }

    // 완전히 무음이거나 유효 샘플이 없는 경우 빈 버퍼 반환
    if (start >= end) {
      return new Float32Array(0)
    }

    return buffer.slice(start, end + 1)
  }
}
