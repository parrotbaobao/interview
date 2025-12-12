import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // Use relative base path to ensure assets work on GitHub Pages regardless of repo name
    base: './', 
    define: {
      // Map VITE_API_KEY or API_KEY from environment to process.env.API_KEY for the app code
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY)
    }
  };
});