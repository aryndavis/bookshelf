import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // The app may only talk to itself, your Supabase project, and Open Library (ISBN lookups).
  const supabaseOrigin = env.VITE_SUPABASE_URL?.startsWith('https://') ? new URL(env.VITE_SUPABASE_URL).origin : ''
  const connectSrc = ["'self'", supabaseOrigin, 'https://openlibrary.org'].filter(Boolean).join(' ')

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  const securityHeaders: Record<string, string> = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Robots-Tag': 'noindex',
  }

  // Writes dist/_headers so hosts like Cloudflare Pages and Netlify send the same headers in production.
  const headersFile: Plugin = {
    name: 'security-headers-file',
    apply: 'build',
    generateBundle() {
      const lines = Object.entries({ ...securityHeaders, 'Strict-Transport-Security': 'max-age=31536000' }).map(([k, v]) => `  ${k}: ${v}`)
      this.emitFile({ type: 'asset', fileName: '_headers', source: `/*\n${lines.join('\n')}\n` })
    },
  }

  // Vite's dev server needs inline scripts/styles and a websocket for hot reload.
  const devHeaders = {
    ...securityHeaders,
    'Content-Security-Policy': csp
      .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
      .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
      .replace(`connect-src ${connectSrc}`, `connect-src ${connectSrc} ws://localhost:5173 ws://127.0.0.1:5173`),
  }

  return {
    plugins: [react(), headersFile],
    build: { assetsInlineLimit: 0 },
    server: { headers: devHeaders, strictPort: true },
    preview: { headers: securityHeaders },
  }
})
