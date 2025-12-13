import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'TabVault - Session Manager & Tab Organizer',
    description: 'Never lose your tabs again. Save, restore, and organize browser sessions with automatic backups and tab group support.',
    version: '1.0.0',
    permissions: ['storage', 'tabs', 'tabGroups'],
    action: {
      default_title: 'TabVault',
    },
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '96': 'icon/96.png',
      '128': 'icon/128.png',
    },
    // Required for ExtPay onPaid callback to work
    content_scripts: [
      {
        matches: ['https://extensionpay.com/*'],
        js: ['extpay-content.js'],
        run_at: 'document_start',
      },
    ],
  },
});
