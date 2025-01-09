import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { loadEnv } from 'vite';

import react from '@astrojs/react';

const env = loadEnv(process.env.NODE_ENV, process.cwd(), '');

export default defineConfig({
  integrations: [tailwind(), react()],
  output: 'server', // Necesario para APIs y auth
  vite: {
    define: {
      'process.env.PUBLIC_SUPABASE_URL': JSON.stringify(env.PUBLIC_SUPABASE_URL),
      'process.env.PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.PUBLIC_SUPABASE_ANON_KEY)
    }
  }
});