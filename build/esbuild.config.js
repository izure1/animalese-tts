const esbuild = require('esbuild')

const commonConfig = {
  bundle: true,
  target: 'esnext',
  minify: true,
  sourcemap: false,
}

// 1. Node.js 빌드 (서버, CLI 용)
esbuild.build({
  ...commonConfig,
  entryPoints: ['src/index.node.ts'],
  outfile: 'dist/animalese.node.cjs',
  platform: 'node',
  format: 'cjs',
}).then(() => console.log('✅ Node.js 빌드 완료 (dist/animalese.node.cjs)')).catch(() => process.exit(1))

// 2. Browser 빌드 (웹, React 등 클라이언트 탑재 용)
esbuild.build({
  ...commonConfig,
  entryPoints: ['src/index.browser.ts'],
  outfile: 'dist/animalese.browser.mjs',
  platform: 'browser',
  format: 'esm', // 브라우저/모던 환경 표준으로 ESM 채택
}).then(() => console.log('✅ Browser 빌드 완료 (dist/animalese.browser.mjs)')).catch(() => process.exit(1))

// 3. Docs 빌드 (GitHub Pages 등 정적 호스팅 용)
esbuild.build({
  ...commonConfig,
  entryPoints: ['src/index.browser.ts'],
  outfile: 'docs/animalese.browser.mjs',
  platform: 'browser',
  format: 'esm',
}).then(() => console.log('✅ Docs 빌드 완료 (docs/animalese.browser.mjs)')).catch(() => process.exit(1))
