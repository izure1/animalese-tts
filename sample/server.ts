import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import {
  AnimaleseEngine,
  KoreanAnalyzer,
  JapaneseAnalyzer,
  EnglishAnalyzer,
  FileSystemSampleProvider,
  GranularPitchShifter
} from '../src/index.node'

const app = express()
app.use(cors())
app.use(express.static(path.join(__dirname, 'public')))

// WAV 파일에서 실제 샘플레이트를 먼저 읽어옵니다
const soundsDir = path.join(__dirname, 'sounds')
function detectSampleRate(dir: string): number {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.wav'))
  if (files.length === 0) return 44100
  const buf = fs.readFileSync(path.join(dir, files[0]))
  return buf.readUInt32LE(24)
}
const sampleRate = detectSampleRate(soundsDir)

// FileSystem 버퍼 사전 적재 시 타겟 Hz를 동기화하여 주입합니다.
const sampleProvider = new FileSystemSampleProvider(soundsDir, sampleRate)
sampleProvider.loadDirectory()

// Float32Array를 16-bit PCM (Little Endian) Buffer로 양자화하는 헬퍼 함수
function float32ToInt16(float32Array: Float32Array): Buffer {
  const buffer = Buffer.alloc(float32Array.length * 2)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, i * 2)
  }
  return buffer
}

app.get('/api/stream', async (req, res) => {
  const text = (req.query.text as string) || '안녕하세요'
  const pitch = parseFloat(req.query.pitch as string) || 1.5
  const speed = parseFloat(req.query.speed as string) || 3.0
  const lang = (req.query.lang as string) || 'ko'
  const randomness = req.query.randomness !== undefined ? parseFloat(req.query.randomness as string) : 0.01
  const spaceDelay = req.query.spaceDelay !== undefined ? parseFloat(req.query.spaceDelay as string) : 0.1
  const punctuationDelay = req.query.punctuationDelay !== undefined ? parseFloat(req.query.punctuationDelay as string) : 0.3
  const punctuationsParam = req.query.punctuations as string
  const punctuations = punctuationsParam ? punctuationsParam.split('') : undefined

  // 클라이언트가 요청한 언어 분석기 매핑
  let analyzer
  if (lang === 'en') analyzer = new EnglishAnalyzer()
  else if (lang === 'ja') analyzer = new JapaneseAnalyzer()
  else analyzer = new KoreanAnalyzer()

  const config = {
    basePitch: pitch,
    randomness,
    analyzer,
    sampleProvider,
    effect: new GranularPitchShifter(speed), // 피치 시프터 및 재생속도 적용
    sampleRate,
    spaceDelay,
    punctuationDelay,
    punctuations
  }

  const engine = new AnimaleseEngine(config)

  // 브라우저가 조각(Chunk) 트래픽을 즉시 인식할 수 있도록 HTTP 200 청크드 스트림 개방
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Transfer-Encoding': 'chunked',
    'Access-Control-Allow-Origin': '*',
    'X-Sample-Rate': String(sampleRate)
  })

  // 엔진 이터레이터가 산출하는 오디오 조각을 하나씩 변환 후 실시간 전송 (Streaming)
  for await (const result of engine.synthesize(text)) {
    const pcmChunk = float32ToInt16(result.buffer)
    res.write(pcmChunk)
  }

  // 스트림 완료 (커넥션 종료)
  res.end()
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Animalese [Express] Streaming Server is running!`)
  console.log(`📡 URL: http://localhost:${PORT}`)
  console.log(`📄 접속 시 제공되는 GUI(공용폴더)에서 테스트를 진행하세요.`)
})
