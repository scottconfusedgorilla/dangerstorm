import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.dangerstorm.app',
  appName: 'DangerStorm',
  webDir: 'public',

  // Load from live server — no code duplication, auto-updates on deploy
  server: {
    url: 'https://www.dangerstorm.net',
    cleartext: false,
  },

  ios: {
    backgroundColor: '#0F172A',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'DangerStorm',
  },

  android: {
    backgroundColor: '#0F172A',
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0F172A',
      showSpinner: false,
      launchFadeOutDuration: 300,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0F172A',
    },
  },
};

export default config;
