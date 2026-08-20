-- =============================================================================
-- 012_create_device_push_tokens.sql
-- プッシュ通知の送信先デバイストークンを保存するテーブル
--
-- iOSアプリ(Capacitor)でログインユーザーが通知を許可すると、APNsのデバイス
-- トークンをここに保存する。送信は Edge Function (send-push) がこのテーブルを
-- 参照して行う。トークンは端末ごとに変わりうるため user_id + token の組で一意。
-- =============================================================================

CREATE TABLE device_push_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL
                         REFERENCES users (id) ON DELETE CASCADE,
  token      text        NOT NULL,
  platform   text        NOT NULL DEFAULT 'ios',
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, token)
);

CREATE INDEX idx_device_push_tokens_user_id
  ON device_push_tokens (user_id);

ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_push_tokens_select_own"
  ON device_push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "device_push_tokens_insert_own"
  ON device_push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "device_push_tokens_delete_own"
  ON device_push_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "device_push_tokens_select_service_role"
  ON device_push_tokens FOR SELECT
  USING (auth.role() = 'service_role');

COMMENT ON TABLE device_push_tokens IS
  'ログインユーザーのiOSプッシュ通知用デバイストークン。send-push Edge Functionが参照する。';
