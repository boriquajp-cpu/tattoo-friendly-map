import { supabase } from './supabase';

/**
 * 指定ユーザーへプッシュ通知を送信する（send-push Edge Function呼び出し）。
 * APNsの鍵が未設定の間は Edge Function 側で無視されるだけなので、
 * 呼び出し側の操作（管理画面での承認等）を止めないよう常にfire-and-forgetで使う。
 */
export function sendPushNotification(userIds: string[], title: string, body: string): void {
  if (userIds.length === 0) return;
  void supabase.functions
    .invoke('send-push', { body: { userIds, title, body } })
    .then(({ error }) => {
      if (error) console.error('sendPushNotification failed:', error);
    });
}
