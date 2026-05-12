import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


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
    // Raise from the default 500 kB — export utilities (jspdf/docx/xlsx) are
    // inherently large; chunks are properly split for caching, so suppress the
    // warning for the remaining large-but-expected chunks.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
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
            id.includes('xlsx') ||
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
