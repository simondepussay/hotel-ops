import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // accessible depuis le téléphone sur le même Wi-Fi
    proxy: { '/api': 'http://localhost:7071' },
  },
});
