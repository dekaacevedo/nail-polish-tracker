import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { loadEnv } from 'vite';

import react from '@astrojs/react';

import vercel from '@astrojs/vercel';

const env = loadEnv(process.env.NODE_ENV, process.cwd(), '');

export default defineConfig({
  integrations: [tailwind({
    applyBaseStyles: false,
  }), react()],

  // Necesario para APIs y auth
  output: 'server',

  adapter: vercel()
});