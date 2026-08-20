// =============================================================================
// supabase/functions/send-push/index.ts
// APNs経由でiOSアプリへプッシュ通知を送信する Edge Function
//
// - device_push_tokens テーブルから対象ユーザーのトークンを引き、
//   APNs HTTP/2 API へ ES256 JWT 認証で送信する。
// - APNS_* の secrets が未設定の場合（Apple Developer Program登録前など）は
//   何もせず 200 を返す。管理画面の操作（施設リクエスト承認等）を
//   通知の失敗で止めないためのガード。
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  userIds: string[];
  title: string;
  body: string;
}

// PEM形式の秘密鍵(.p8の中身)から ES256 用の CryptoKey を作る
async function importApnsKey(pem: string): Promise<CryptoKey> {
  const pkcs8 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pkcs8), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buildApnsJwt(keyId: string, teamId: string, privateKey: CryptoKey): Promise<string> {
  const header = { alg: 'ES256', kid: keyId };
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) };
  const encoder = new TextEncoder();
  const unsigned = `${base64url(encoder.encode(JSON.stringify(header)))}.${base64url(encoder.encode(JSON.stringify(payload)))}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsigned)
  );
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { userIds, title, body } = (await req.json()) as RequestBody;

    if (!Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
      return new Response(JSON.stringify({ error: 'userIds, title and body are required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const keyP8 = Deno.env.get('APNS_KEY_P8');
    const keyId = Deno.env.get('APNS_KEY_ID');
    const teamId = Deno.env.get('APNS_TEAM_ID');
    const bundleId = Deno.env.get('APNS_BUNDLE_ID');

    if (!keyP8 || !keyId || !teamId || !bundleId) {
      console.warn('send-push: APNS_* secrets not configured yet, skipping.');
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: tokenRows } = await supabase
      .from('device_push_tokens')
      .select('token')
      .in('user_id', userIds);

    const tokens = (tokenRows ?? []).map((r) => r.token as string);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const privateKey = await importApnsKey(keyP8);
    const jwt = await buildApnsJwt(keyId, teamId, privateKey);
    const apnsHost = Deno.env.get('APNS_USE_SANDBOX') === 'true'
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com';

    let sent = 0;
    for (const token of tokens) {
      const res = await fetch(`${apnsHost}/3/device/${token}`, {
        method: 'POST',
        headers: {
          authorization: `bearer ${jwt}`,
          'apns-topic': bundleId,
          'apns-push-type': 'alert',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ aps: { alert: { title, body }, sound: 'default' } }),
      });
      if (res.ok) {
        sent += 1;
      } else {
        console.error('APNs send failed:', res.status, await res.text());
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-push function failed:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
