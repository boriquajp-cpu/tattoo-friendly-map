-- =============================================================================
-- 006_create_moderation.sql
-- タトゥーフレンドリー施設マップ - 施設リクエスト・管理者ロール
-- =============================================================================

-- ----------------------------------------------------------------------------
-- users.role（管理者判定用）
-- ----------------------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));

COMMENT ON COLUMN users.role IS
  'user: 一般ユーザー / admin: 管理画面（施設リクエスト承認・報告フラグ操作）にアクセス可能';

-- ----------------------------------------------------------------------------
-- ENUM 型定義
-- ----------------------------------------------------------------------------

CREATE TYPE facility_request_status AS ENUM (
  'pending',   -- 未対応
  'approved',  -- 承認済み（施設として掲載 / 修正反映済み）
  'rejected'   -- 却下
);

-- ----------------------------------------------------------------------------
-- facility_requests テーブル
-- 新規施設の掲載リクエストと、既存施設の修正報告（CorrectionModal）の
-- 両方をこのテーブルに集約する。修正報告は message に "[修正報告]" 接頭辞を付与し、
-- address_ja に対象施設の facility_id を格納して区別する。
-- ----------------------------------------------------------------------------

CREATE TABLE facility_requests (
  id            uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id       uuid
                                        REFERENCES users (id) ON DELETE SET NULL,

  name_ja       text                    NOT NULL,
  address_ja    text                    NOT NULL,
  category      facility_category       NOT NULL,
  official_url  text,
  message       text,

  status        facility_request_status NOT NULL DEFAULT 'pending',

  created_at    timestamptz             NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- インデックス
-- ----------------------------------------------------------------------------

CREATE INDEX idx_facility_requests_status
  ON facility_requests (status, created_at DESC);

CREATE INDEX idx_facility_requests_user_id
  ON facility_requests (user_id)
  WHERE user_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE facility_requests ENABLE ROW LEVEL SECURITY;

-- 認証済み・匿名ユーザーともに INSERT 可（施設リクエスト・修正報告フォームから）
CREATE POLICY "facility_requests_insert_all"
  ON facility_requests FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated' AND (user_id = auth.uid() OR user_id IS NULL))
    OR (auth.role() = 'anon' AND user_id IS NULL)
  );

-- 自分の投稿のみ SELECT 可
CREATE POLICY "facility_requests_select_own"
  ON facility_requests FOR SELECT
  USING (auth.uid() = user_id);

-- 管理者ロールを持つユーザーは全件 SELECT 可
CREATE POLICY "facility_requests_select_admin_role"
  ON facility_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- service_role は全件 SELECT 可
CREATE POLICY "facility_requests_select_service_role"
  ON facility_requests FOR SELECT
  USING (auth.role() = 'service_role');

-- 管理者ロールを持つユーザーは全件 UPDATE 可（承認・却下）
CREATE POLICY "facility_requests_update_admin_role"
  ON facility_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- service_role は全件 UPDATE 可
CREATE POLICY "facility_requests_update_service_role"
  ON facility_requests FOR UPDATE
  USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- reports テーブルへの管理者ロールポリシー追加
-- （既存の service_role 限定ポリシーに加え、管理画面から admin ロールの
--   ログインユーザーがフラグ済みレポートを閲覧・操作できるようにする）
-- ----------------------------------------------------------------------------

CREATE POLICY "reports_select_admin_role"
  ON reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "reports_update_admin_role"
  ON reports FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- コメント
-- ----------------------------------------------------------------------------

COMMENT ON TABLE facility_requests IS
  '新規施設の掲載リクエストおよび既存施設の修正報告。管理者が承認・却下を判断する。';
COMMENT ON COLUMN facility_requests.status IS
  'pending: 未対応 / approved: 承認済み / rejected: 却下';
