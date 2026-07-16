-- =============================================================================
-- 007_create_report_flags.sql
-- タトゥーフレンドリー施設マップ - 口コミ通報機能
-- =============================================================================

-- ----------------------------------------------------------------------------
-- ENUM 型定義
-- ----------------------------------------------------------------------------

CREATE TYPE report_flag_reason AS ENUM (
  'spam',          -- スパム・宣伝目的
  'false_info',    -- 虚偽の内容・事実と異なる
  'inappropriate', -- 不適切な言葉遣い・誹謗中傷
  'privacy',       -- 個人情報が含まれている
  'other'          -- その他（自由記述）
);

-- ----------------------------------------------------------------------------
-- report_flags テーブル
-- 一般ユーザーが個別の口コミ（reports）を通報するための追記専用テーブル。
-- reports.flagged 列は管理者のみが変更可能なため、通報自体はここに蓄積し、
-- 管理者が内容を確認した上で reports.flagged を手動で立てる運用とする。
-- ----------------------------------------------------------------------------

CREATE TABLE report_flags (
  id                  uuid                PRIMARY KEY DEFAULT gen_random_uuid(),

  report_id           uuid                NOT NULL
                                          REFERENCES reports (id) ON DELETE CASCADE,

  flagged_by_user_id  uuid
                                          REFERENCES users (id) ON DELETE SET NULL,

  reason              report_flag_reason  NOT NULL,
  detail              text,

  created_at          timestamptz         NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- インデックス
-- ----------------------------------------------------------------------------

CREATE INDEX idx_report_flags_report_id
  ON report_flags (report_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE report_flags ENABLE ROW LEVEL SECURITY;

-- 認証済み・匿名ユーザーともに INSERT 可（通報フォームから）
CREATE POLICY "report_flags_insert_all"
  ON report_flags FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated' AND (flagged_by_user_id = auth.uid() OR flagged_by_user_id IS NULL))
    OR (auth.role() = 'anon' AND flagged_by_user_id IS NULL)
  );

-- 管理者ロールを持つユーザーは全件 SELECT 可
CREATE POLICY "report_flags_select_admin_role"
  ON report_flags FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- service_role は全件 SELECT 可
CREATE POLICY "report_flags_select_service_role"
  ON report_flags FOR SELECT
  USING (auth.role() = 'service_role');

-- 管理者ロールを持つユーザーは全件 DELETE 可（対応済み通報の整理用）
CREATE POLICY "report_flags_delete_admin_role"
  ON report_flags FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- コメント
-- ----------------------------------------------------------------------------

COMMENT ON TABLE report_flags IS
  'ユーザーによる口コミ(reports)の通報。管理者が内容を確認し、必要に応じ reports.flagged を立てる。';
COMMENT ON COLUMN report_flags.reason IS
  'spam: スパム / false_info: 虚偽 / inappropriate: 不適切な言葉遣い / privacy: 個人情報 / other: その他';
