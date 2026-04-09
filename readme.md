# Animalese TTS

[![](https://data.jsdelivr.com/v1/package/npm/animalese-tts/badge)](https://www.jsdelivr.com/package/npm/animalese-tts)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

Animalese TTS is an Animal Crossing style Voice Synthesis (TTS) engine. It analyzes text to synthesize audio samples corresponding to each phoneme, and applies pitch adjustments and melody variations to generate a cute and unique voice.

👉 **[Go to Test Page (Demo)](https://animalese-tts.izure.org)**

## Key Features

- **Multi-language Support**: Supports Korean (separated into onset/nucleus/coda), English, and Japanese (hiragana, katakana) analyzers.
- **Cross-environment Support**: Works perfectly in both browser environments using the Web Audio API and Node.js environments using the file system.
- **Real-time Synthesis**: Enables real-time synthesis character-by-character using `AsyncGenerator`.
- **Rich Audio Effects**:
  - **Base Pitch & Randomness**: Adjust the pitch of the voice and the variation range that changes every time.
  - **Melody Variation**: Create a singing-like effect through sine wave-based pitch changes.
  - **Playback Speed Control**: Adjust the playback speed independently of the pitch.
  - **Punctuation & Space Delay**: Set natural pauses for periods, commas, spaces, etc.

## Installation and Build

```bash
npm install animalese-tts
```

```html
<script type="module">
  import {
    AnimaleseEngine,
    KoreanAnalyzer,
    WebSampler,
    PitchManager,
    WebPlayer
  } from 'https://cdn.jsdelivr.net/npm/animalese-tts/+esm'
</script>
```

## Usage (Example)

### Browser (Web) Environment

In a browser environment, you use `WebSampler` to fetch samples via HTTP and `WebPlayer` to play audio using the Web Audio API.

```typescript
import {
  AnimaleseEngine,
  KoreanAnalyzer,
  WebSampler,
  PitchManager,
  WebPlayer
} from 'https://cdn.jsdelivr.net/npm/animalese-tts/+esm'

const sampleRate = 48000
// The URL where your .wav samples are hosted
const baseUrl = 'https://your-server.com/samples'

const player = new WebPlayer(sampleRate)

const engine = new AnimaleseEngine({
  analyzer: new KoreanAnalyzer(),
  sampler: new WebSampler(
    'https://your-server.com/sounds/sprite.wav', 
    ['a', 'b', 'c'] // Auto-detect from labels, or use an explicit SpriteMap object
  ),
  effect: new PitchManager({
    pitch: 1.5,
    speed: 4.0
  })
})

async function speak(text: string) {
  const speaker = engine.synthesize(text)
  await speaker.load()
  
  for await (const output of speaker.speak()) {
    await player.play(output.buffer)
  }
}

speak("안녕하세요! 브라우저에서의 목소리 테스트입니다.")
```

### Node.js Environment

In a Node.js environment, you use `FileSystemSampler` to read samples from the local disk and `FilePlayer` to play or save the audio.

```typescript
import {
  AnimaleseEngine,
  KoreanAnalyzer,
  FileSystemSampler,
  PitchManager,
  FilePlayer
} from 'animalese-tts'

const sampleRate = 48000

const player = new FilePlayer(sampleRate)

const engine = new AnimaleseEngine({
  analyzer: new KoreanAnalyzer(),
  sampler: new FileSystemSampler({
    sampleRate: 48000,
    audioFilePath: './sounds/sprite.wav',
    sprites: ['a', 'b', 'c'] // Or explicitly { 'a': { startMs, durationMs }, ... }
  }),
  effect: new PitchManager({
    pitch: 0.8,
    speed: 3.5
  })
})

async function speak(text: string) {
  const speaker = engine.synthesize(text)
  await speaker.load()
  
  for await (const output of speaker.speak()) {
    // FilePlayer exports the buffer to a temporary or specified .wav file/stream
    await player.play(output.buffer, './output_folder')
  }
}

speak("안녕하세요! Node.js에서의 목소리 테스트입니다.")
```

## Detailed Configuration Options (AnimalVoiceConfig)

| Option Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `analyzer` | `TextAnalyzer` | (Required) | Separates text into phonemes. You can select language-specific analyzers. |
| `sampler` | `Sampler` | (Required) | Supplies the original audio sample data corresponding to the phonemes. |
| `effect` | `AudioEffect` | (Required) | Handles pitch modulation and speed control effects. (Usually `PitchManager` is used) |
| `spaceDelay` | `number` | `0.03` | Silence delay inserted upon recognizing a space character (` `) (seconds). |
| `punctuationDelay` | `number` | `0.3` | Silence delay inserted upon recognizing punctuation (seconds). |
| `punctuations` | `string[]` | (Default set) | Array of characters to be considered as punctuation marks. |

### Sampler Parameter Options (`SamplerOptions`)

- `sampleRate`: The sample rate of the original sample data in Hz. (e.g., 44100)
- `maxRetries`: (Optional) Maximum number of retries when loading the audio file.
- `silenceThreshold`: (Optional) Amplitude threshold below which a buffer is considered silent (0.0~1.0). Used to detect and trim trailing/leading silence. (Default: 0.01)

### Environment-Specific Sampler Options

Depending on the environment, you must use a specific `Sampler` implementation and provide its required property to locate the audio sample data:

- **Node.js (`FileSystemSampler`)**: 
  Loads a single audio sprite file (`.wav`) from the local file system and automatically slices it.
  - `sampleRate`: Pre-defined sample rate to validate/resample correctly.
  - `audioFilePath`: Absolute or relative path to the local single audio sprite `.wav` file.
  - `sprites`: Either an explicit `SpriteMap` (`{ startMs, durationMs }`) or a `string[]` of labels to auto-detect by slicing on silence.
  - `minSilenceDurationMs`: (Optional) Minimum duration of silence in ms to split sprites in auto-detect mode. Increase this if certain sounds (like fricatives) are incorrectly split. (Default: 20)

- **Browser (`WebSampler`)**: 
  Loads a single audio sprite (`.wav`) and automatically slices it into individual phonemes.
  - `audioSrc` (1st Arg): URL of the single sprite audio file.
  - `sprites` (2nd Arg): Either an explicit `SpriteMap` (`{ startMs, durationMs }`) or a `string[]` of labels to auto-detect by slicing on silence.
  - `options` (3rd Arg): (Optional) Provide `{ maxRetries, silenceThreshold, minSilenceDurationMs }` to fine-tune fetching and auto-detection behavior.

### Phoneme Audio Data Structure

**For both `FileSystemSampler` (Node.js) & `WebSampler` (Browser)**
You provide a single sprite file (e.g., `sprite.wav`) containing all phoneme sounds played consecutively.
You then map each slice to a phoneme using either an explicit `SpriteMap` or an ordered array of `string` labels.
Both Node.js and Browser environments now share the exact same structure; only the source location (local file path vs HTTP URL) differs.

> **Note**: If the corresponding sprite map slice is missing or the phoneme is not mapped, that specific character will be treated as silence during synthesis.

### PitchManager Parameter Options (`PitchManagerOptions`)

- `pitch`: The base tone of the voice. 1.0 is standard; higher is thinner, lower is deeper. 
- `speed`: Speaking speed. Greater than 1.0 is faster, less than 1.0 is slower.
- `randomness`: Amount of random pitch change applied to each character.
- `melodyRate`: The rate at which the melody changes. Higher values make the pitch rise and fall faster. (Default 0.05)
- `melodyAmplitude`: The amplitude of the melody change. Higher values make the pitch difference more distinct. (Default 0.1)

## Main Components

### Analyzers
Analyzers separate text into the smallest phoneme structures tailored to the specific characteristics of the language.
- `KoreanAnalyzer`: Precisely separates Korean text into onset, nucleus, and coda. Handles double consonants naturally.
- `EnglishAnalyzer`: Separates English text into alphabets ignoring case, and filters unsupported special characters.
- `JapaneseAnalyzer`: Analyzes hiragana and katakana and separates them into individual phonemes.

### Creating Custom Analyzers
You can easily create your own custom language analyzer by extending the exported base classes: `DecomposingAnalyzer` or `DictionaryAnalyzer`.

#### Using DecomposingAnalyzer (Character-by-character)
Ideal for languages where characters decompose mathematically into phonemes (like Korean).
```typescript
import { DecomposingAnalyzer, PhonemeToken } from 'animalese-tts';

export class MyCustomAnalyzer extends DecomposingAnalyzer {
  protected decompose(char: string): PhonemeToken[] {
    // Custom logic to convert a single character to phonemes
    return [{ phoneme: char.toLowerCase(), mergeWithNext: false }];
  }
}
```

#### Using DictionaryAnalyzer (Mapping-based)
Ideal for languages where specific character sequences map directly to phoneme arrays (like Japanese). 
When defining the array, each string element becomes a distinct phoneme block. 
For example, `['tai']` is played as a single continuous piece (combining t, a, i at once like one letter), while `['ta', 'i']` plays as two separate pieces merged together (ta + i) and pronounced as two letters.

```typescript
import { DictionaryAnalyzer, PhonemeToken } from 'animalese-tts';

export class MyMappedAnalyzer extends DictionaryAnalyzer {
  protected dictionary: Record<string, string[]> = {
    // Single character pronunciation
    'あ': ['a'],
    // Combined pronunciation as one block
    'きゃ': ['kya'], 
    // Two distinct pronunciations merged together
    '大': ['ta', 'i'], 
  };
  
  // You can optionally override `analyze` to add complex language-specific rules (like sokuon)
}
```

### Samplers
Samplers fetch and cache actual `.wav` audio samples corresponding to the analyzed phonemes.
- `FileSystemSampler`: **Node.js only.** Reads audio files from a local directory (`samplesDirectory`).
- `WebSampler`: **Browser only.** Fetches samples dynamically via HTTP requests from a remote server (`baseUrl`).
- `MemorySampler`: Loads audio buffers directly into memory. Ideal for custom environments or testing.

### Playback Strategies (PlaybackStrategies)
Responsible for delivering the stream audio data (`Float32Array`) generated by the `AnimaleseEngine`'s `AsyncGenerator` effectively to the end user.
- `FilePlayer`: Saves (Exports) the synthesized audio in chunk forms to `.wav` files on the local disk in a Node.js environment.
- `WebPlayer`: Plays the buffer immediately in a web browser using the Web Audio API (`AudioContext`).

## Project Structure

- `src/core`: Core logic including audio decoders, converters, and sample providers.
- `src/analyzers`: Language-specific text analysis algorithms (Korean/English/Japanese)
- `src/effects`: Audio effects processing such as pitch and speed adjustment
- `src/playback`: Platform-specific playback strategies (Browser/Node)
- `src/interfaces.ts`: Main interfaces and type definitions

## License

Please see the [LICENSE](LICENSE) file for details regarding the license of this project.
