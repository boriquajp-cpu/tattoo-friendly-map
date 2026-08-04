-- =============================================================================
-- 011_create_official_facility_responses.sql
-- タトゥーフレンドリー施設マップ - 施設からの公式回答（アンケート結果）
--
-- Googleフォームで施設に直接アンケートを取り、回答をこのテーブルに取り込む。
-- ユーザー投稿（reports）とは出所が異なる「一次情報」なので、混ぜずに別テーブルで
-- 保持し、管理者が既存施設と突き合わせて承認したものだけを facilities 側の
-- 公式回答用カラムへ反映する（自動反映はしない）。
-- =============================================================================

-- ----------------------------------------------------------------------------
-- ENUM 型定義
-- ----------------------------------------------------------------------------

CREATE TYPE official_tattoo_policy AS ENUM (
  'allowed',       -- 制限なくご利用いただけます
  'conditional',   -- 条件付きでご利用いただけます
  'private_only',  -- 貸切風呂・客室風呂・個室のみご利用いただけます
  'not_allowed'    -- ご利用をお断りしています
);

-- ----------------------------------------------------------------------------
-- official_facility_responses テーブル（フォーム回答の受け皿）
-- ----------------------------------------------------------------------------

CREATE TABLE official_facility_responses (
  id                    uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 管理者が既存施設と突き合わせた後に設定する（未マッチの間は NULL）
  facility_id           uuid                    REFERENCES facilities (id) ON DELETE SET NULL,

  -- フォーム回答時点の自己申告内容（照合用に原文のまま保持）
  submitted_name_ja     text                    NOT NULL,
  submitted_address_ja  text                    NOT NULL,
  category              facility_category       NOT NULL,
  policy                official_tattoo_policy   NOT NULL,
  conditions            text[]                  NOT NULL DEFAULT '{}',
  guidance_text         text,
  official_url          text,

  -- false の場合は「掲載を希望しない（削除依頼）」
  wants_listed           boolean                NOT NULL DEFAULT true,

  -- 非公開項目（確認連絡専用。サイト上には一切表示しない）
  respondent_name        text,
  respondent_email       text,

  -- 審査状況
  review_status           text                  NOT NULL DEFAULT 'pending'
                                                 CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_at              timestamptz,

  created_at                timestamptz         NOT NULL DEFAULT now()
);

CREATE INDEX idx_official_facility_responses_status
  ON official_facility_responses (review_status, created_at);

CREATE INDEX idx_official_facility_responses_facility_id
  ON official_facility_responses (facility_id)
  WHERE facility_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE official_facility_responses ENABLE ROW LEVEL SECURITY;

-- 担当者名・メール等の非公開個人情報を含むため、一般ユーザーの SELECT は許可しない。
-- 取り込み（INSERT）は Google フォーム→スプレッドシート経由の手動/スクリプト import
-- で service_role を使って行う想定。
CREATE POLICY "official_facility_responses_select_admin_role"
  ON official_facility_responses FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "official_facility_responses_select_service_role"
  ON official_facility_responses FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "official_facility_responses_insert_service_role"
  ON official_facility_responses FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "official_facility_responses_update_admin_role"
  ON official_facility_responses FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

CREATE POLICY "official_facility_responses_update_service_role"
  ON official_facility_responses FOR UPDATE
  USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- facilities テーブルに「施設公式回答」表示用カラムを追加
-- 承認された official_facility_responses の内容を管理者が反映すると入る。
-- reports/facility_stats（クラウドソーシング集計）とは別枠で、UI上に
-- 「施設公式回答」バッジとして独立表示する。
-- ----------------------------------------------------------------------------

ALTER TABLE facilities
  ADD COLUMN official_tattoo_policy   official_tattoo_policy,
  ADD COLUMN official_conditions      text[],
  ADD COLUMN official_guidance_text   text,
  ADD COLUMN official_response_verified_at timestamptz;

COMMENT ON TABLE official_facility_responses IS
  '施設向けアンケート（Googleフォーム）の回答取り込み先。人手審査後に facilities.official_* へ反映する。';
COMMENT ON COLUMN official_facility_responses.facility_id IS
  '管理者が既存施設と突き合わせて設定。新規施設の場合は別途 facility_requests 経由で施設自体を先に登録する。';
COMMENT ON COLUMN facilities.official_tattoo_policy IS
  '施設が自己申告した公式回答（承認済みのもののみ反映）。ユーザー口コミ集計（facility_stats）とは別に表示する。';
