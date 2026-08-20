import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * ネイティブiOSアプリでログイン中のみ、プッシュ通知の許可を求めて
 * デバイストークンを device_push_tokens に保存する。
 * Web版(ブラウザ)では何もしない。
 */
export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;

    let cancelled = false;

    const registrationListener = PushNotifications.addListener('registration', (token) => {
      if (cancelled) return;
      void supabase
        .from('device_push_tokens')
        .upsert(
          { user_id: user.id, token: token.value, platform: Capacitor.getPlatform() },
          { onConflict: 'user_id,token', ignoreDuplicates: true }
        );
    });

    const errorListener = PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', err);
    });

    void (async () => {
      const permission = await PushNotifications.checkPermissions();
      let granted = permission.receive === 'granted';

      if (permission.receive === 'prompt') {
        const requested = await PushNotifications.requestPermissions();
        granted = requested.receive === 'granted';
      }

      if (granted && !cancelled) {
        await PushNotifications.register();
      }
    })();

    return () => {
      cancelled = true;
      void registrationListener.then((l) => l.remove());
      void errorListener.then((l) => l.remove());
    };
  }, [user]);
}
