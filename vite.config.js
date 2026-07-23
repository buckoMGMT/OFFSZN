import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  build: {
    // Sourcemaps for Sentry (3.3). 'hidden' emits .map files without the
    // sourceMappingURL comment — upload them to Sentry, never serve them.
    // Upload (after `npm i -D @sentry/cli`, with SENTRY_AUTH_TOKEN set):
    //   npx sentry-cli sourcemaps inject dist && \
    //   npx sentry-cli sourcemaps upload --release "$VITE_SENTRY_RELEASE" dist
    sourcemap: 'hidden',
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});