// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',

  adapter: node({
    mode: 'standalone',
  }),

  env: {
    schema: {
      REDIS_URL: envField.string({ context: "server", access: "secret", default: "redis://localhost:6379" }),
    }
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
});
