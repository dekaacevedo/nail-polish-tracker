import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { loadEnv } from 'vite';

import react from '@astrojs/react';

import vercel from '@astrojs/vercel';

const env = loadEnv(process.env.NODE_ENV, process.cwd(), '');

export default defineConfig({
  integrations: [tailwind(), react()],

  // Necesario para APIs y auth
  output: 'server',

  vite: {
    define: {
      'process.env.PUBLIC_SUPABASE_URL': JSON.stringify(env.PUBLIC_SUPABASE_URL),
      'process.env.PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.PUBLIC_SUPABASE_ANON_KEY)
    }
  },

  adapter: vercel()
});