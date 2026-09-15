-- =============================================================================
-- 014_create_app_settings.sql
-- アプリ全体の軽量な設定値（key-value）を保存するテーブル
--
-- 最初の用途: 宿泊予約リンク（KKday/Klook/Agoda/Trip.com）のアフィリエイト
-- パラメータ。各社の提携プログラム審査が通り次第、アプリを再ビルド・再申請
-- せずにこのテーブルの値を書き換えるだけでWeb/iOSアプリ両方に反映させる。
-- 値は誰でも閲覧できる必要がある（ログイン不要の施設詳細ページで使うため）。
-- 書き込みは管理者(users.role = 'admin')またはservice_roleのみ。
-- =============================================================================

CREATE TABLE app_settings (
  key        text        PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select_anyone"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "app_settings_update_admin_role"
  ON app_settings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "app_settings_insert_service_role"
  ON app_settings FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "app_settings_update_service_role"
  ON app_settings FOR UPDATE
  USING (auth.role() = 'service_role');

COMMENT ON TABLE app_settings IS
  '軽量なkey-valueアプリ設定。宿泊予約アフィリエイトパラメータなど、再デプロイなしで反映したい値に使う。';

-- 宿泊予約先ごとのアフィリエイトパラメータ（例: "aid=12345"）。
-- 未提携の間は value を NULL のままにしておけば、通常のリンクとして機能する。
INSERT INTO app_settings (key, value) VALUES
  ('affiliate_param_kkday', NULL),
  ('affiliate_param_klook', NULL),
  ('affiliate_param_agoda', NULL),
  ('affiliate_param_tripcom', NULL);
