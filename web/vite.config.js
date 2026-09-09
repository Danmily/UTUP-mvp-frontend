import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// 是否使用真实的内网组件库 @ecom/aurora。
// - 默认（未设置）：别名到本地按 Aurora Design 4.0 规范实现的同名组件，零内网依赖即可构建运行。
// - 公司内网环境：先 `bnpm install`（或 npm install，需 bnpm SSO 鉴权）装好 @ecom/aurora，
//   再以 `USE_REAL_AURORA=1 npm run dev` 启动，即透明切换到真实组件库，业务代码无需改动。
const USE_REAL = ['1', 'true', 'yes'].includes(process.env.USE_REAL_AURORA)

export default defineConfig({
  plugins: [react()],
  resolve: USE_REAL
    ? {}
    : {
        alias: {
          '@ecom/aurora': fileURLToPath(new URL('./src/aurora-fallback/index.jsx', import.meta.url)),
        },
      },
  server: { port: 5173, host: true },
})
