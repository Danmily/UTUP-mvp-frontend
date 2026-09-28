import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const target = process.argv[2] && resolve(process.argv[2])
if (!target || !readFileSync(resolve(target, 'vercel.json'), 'utf8').includes('X-Robots-Tag')) {
  throw Error('请传入 select-person-by-tags 仓库目录；不会默认写入其他位置。')
}
mkdirSync(resolve(target, 'audience'), { recursive: true })
for (const file of ['engine.js', 'workspace.js', 'workspace.css']) {
  copyFileSync(resolve(root, 'web/public/audience', file), resolve(target, 'audience', file))
}
console.log('三个共用工作区文件已同步；独立站入口与部署配置保持各自维护。')
