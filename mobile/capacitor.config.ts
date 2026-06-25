import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.receipt.manager',
  appName: '票小兜',
  webDir: '../client/dist-mobile',
  server: {
    androidScheme: 'https',
    allowNavigation: ['career.aixiaolv.icu'],
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
};

export default config;
