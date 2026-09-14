import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tattoomapjapan.app',
  appName: 'Tattoo Map Japan',
  webDir: 'dist',
  // capacitor:// だとWKWebViewのlocalStorage（GoogleログインのPKCE検証データ保存先）が
  // 不安定になることがあるため、より標準的なhttps://localhostオリジンに切り替える
  server: {
    iosScheme: 'https',
  },
};

export default config;
