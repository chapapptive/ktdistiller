import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace 'kt-distiller' with your actual GitHub repo name
export default defineConfig({
  plugins: [react()],
  base: '/kt-distiller/',
})
