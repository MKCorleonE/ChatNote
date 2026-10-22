import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins:[react()], test:{css:{include:[/map-canvas\.css/]},environment:'jsdom',include:['src/**/*.test.{ts,tsx}'],setupFiles:['src/test-setup.ts']} });
