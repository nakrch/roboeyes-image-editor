import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/roboeyes-image-editor/',
  plugins: [react()],
})
