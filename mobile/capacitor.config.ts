import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.whyater.jargle',
  appName: 'Jargle',
  webDir: '../web/dist',
  backgroundColor: '#F6EFDC',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
    },
  },
};

export default config;
