import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',workers:1,use:{baseURL:'http://127.0.0.1:4173',headless:true},webServer:{command:'npx tsx backend/test/browser-server.ts',url:'http://127.0.0.1:4173/api/health',timeout:120000,reuseExistingServer:false},reporter:'list'});
