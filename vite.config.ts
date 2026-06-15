import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    nodePolyfills({ include: ['buffer', 'stream', 'util', 'events'] }),
  ],
  resolve: {
    alias: [
      {
        // Use a regex so the alias only matches @/ (imports like @/components/…)
        // and does NOT match scoped npm packages like @supabase/… or @radix-ui/…
        find: /^@\//,
        replacement: path.resolve(__dirname, './src') + '/',
      },
    ],
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // Raise from the default 500 kB. routes.tsx switched away from
    // React.lazy() to eliminate a Suspense ↔ lazy ordering bug that froze
    // navigation — every page is statically imported now, so the main
    // bundle is inherently large. The page-level manualChunks below split
    // it into per-page cacheable units so a re-deploy that only changes
    // one page invalidates one chunk, not the whole index. The floor
    // still needs to be high enough to not warn on the expected size.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Per-page chunks. Pages are still STATICALLY imported by
          //    routes.tsx (so all chunks load on initial visit — we are
          //    not lazy-loading), but each lives in its own cacheable
          //    file so changes to one page don't invalidate the rest.
          if (id.includes('/src/app/pages/Dashboard'))      return 'page-dashboard'
          if (id.includes('/src/app/pages/Portfolio'))      return 'page-portfolio'
          if (id.includes('/src/app/pages/Scenarios'))      return 'page-scenarios'
          if (id.includes('/src/app/pages/CustomBuilder'))  return 'page-custom-builder'
          if (id.includes('/src/app/pages/RiskECL'))        return 'page-risk-ecl'
          if (id.includes('/src/app/pages/Maintenance'))    return 'page-maintenance'
          if (id.includes('/src/app/pages/Intelligence'))   return 'page-intelligence'
          if (id.includes('/src/app/pages/Deals'))          return 'page-deals'
          if (id.includes('/src/app/pages/Counterparties')) return 'page-counterparties'
          if (id.includes('/src/app/pages/Reports'))        return 'page-reports'
          if (id.includes('/src/app/pages/RateOutlook'))    return 'page-rate-outlook'

          // MUI + Emotion — large design system
          if (id.includes('@mui/') || id.includes('@emotion/')) {
            return 'vendor-mui'
          }
          // Radix UI primitives
          if (id.includes('@radix-ui/') || id.includes('radix-ui')) {
            return 'vendor-radix'
          }
          // Charts + geo
          if (
            id.includes('recharts') ||
            id.includes('d3-') ||
            id.includes('topojson')
          ) {
            return 'vendor-charts'
          }
          // Animation
          if (id.includes('framer-motion') || id.includes('/motion/')) {
            return 'vendor-motion'
          }
          // Export utilities (PDF / Word / Excel) — heavy, rarely on critical path
          if (
            id.includes('jspdf') ||
            id.includes('docx') ||
            id.includes('exceljs') ||
            id.includes('html2canvas')
          ) {
            return 'vendor-export'
          }
          // Auth + data
          if (id.includes('@auth0/') || id.includes('@supabase/')) {
            return 'vendor-auth'
          }
          // Everything else from node_modules goes into a shared vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
