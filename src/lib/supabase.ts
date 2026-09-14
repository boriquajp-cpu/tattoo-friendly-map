import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// ネイティブアプリでは、GoogleログインのPKCE検証データ（code-verifier）を
// WebViewのlocalStorageではなくネイティブの永続ストレージ（Preferences）に保存する。
// システムブラウザのシートを経由する認証フローでは、WebView側のlocalStorageが
// 信頼できないことがあるため（exchangeCodeForSession時に見つからなくなる不具合の原因）。
const nativeStorage: SupportedStorage = {
  getItem: async (key) => (await Preferences.get({ key })).value,
  setItem: async (key, value) => { await Preferences.set({ key, value }); },
  removeItem: async (key) => { await Preferences.remove({ key }); },
};

// flowType: 'pkce' — ネイティブアプリのOAuthコールバック（AuthContextのappUrlOpen）は
// exchangeCodeForSession前提のため、デフォルトのimplicit方式のままだと認証コードを受け取れない
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    ...(Capacitor.isNativePlatform() ? { storage: nativeStorage } : {}),
  },
});
