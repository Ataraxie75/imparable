// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/serverless';

// Pages contenu 100 % statiques (prérendues), outils en islands React
// (PRD §15). Le mode hybrid ne sert que les routes serveur du LOT 4 :
// /api/*, /audit/merci, /verifier/{numero}.
export default defineConfig({
  site: 'https://imparable.fr',
  output: 'hybrid',
  adapter: vercel(),
  integrations: [react(), sitemap()],
});
