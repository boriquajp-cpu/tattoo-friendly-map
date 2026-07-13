-- =============================================================================
-- 002_create_users_and_reports.sql
-- タトゥーフレンドリー施設マップ - ユーザー・投稿レポートテーブル
-- =============================================================================

-- ----------------------------------------------------------------------------
-- ENUM 型定義
-- ----------------------------------------------------------------------------

-- ユーザー表示言語
CREATE TYPE preferred_lang AS ENUM ('ja', 'zh_tw', 'en');

-- 入場結果
CREATE TYPE report_result AS ENUM (
  'admitted',                -- タトゥー露出で問題なく入場
  'admitted_with_sticker',   -- シール・テープで隠して入場
  'admitted_with_cover',     -- ラッシュガード等で覆って入場
  'denied',                  -- 入場拒否
  'not_asked'                -- タトゥーについて確認されなかった（隠していた等）
);

-- タトゥーサイズ
CREATE TYPE tattoo_size AS ENUM (
  'small',     -- 手のひら未満
  'medium',    -- 手のひら〜A4程度
  'large',     -- A4超
  'multiple'   -- 複数箇所
);

-- 施設側の対応
CREATE TYPE facility_response AS ENUM (
  'nothing_asked',          -- 何も言われなかった
  'verbal_check',           -- 口頭で確認された
  'written_agreement',      -- 書面・同意書にサイン
  'private_bath_offered',   -- 個室・貸切風呂を案内された
  'other_condition'         -- その他の条件あり
);

-- レポートのコメント言語
CREATE TYPE comment_lang AS ENUM ('ja', 'zh_tw', 'en', 'unknown');

-- ----------------------------------------------------------------------------
-- users テーブル（auth.users の public ミラー）
-- ----------------------------------------------------------------------------

CREATE TABLE users (
  id             uuid        PRIMARY KEY
                             REFERENCES auth.users (id) ON DELETE CASCADE,
  preferred_lang preferred_lang NOT NULL DEFAULT 'zh_tw',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Supabase Auth でサインアップ時に自動的に users 行を作成するトリガー
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 自分自身のレコードのみ参照・更新可
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 管理者は全件参照可
CREATE POLICY "users_select_admin"
  ON users FOR SELECT
  USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- reports テーブル
-- ----------------------------------------------------------------------------

CREATE TABLE reports (
  id                uuid            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 対象施設（必須）
  facility_id       uuid            NOT NULL
                                    REFERENCES facilities (id) ON DELETE CASCADE,

  -- 投稿ユーザー（匿名投稿を許容するため NULL 可）
  user_id           uuid
                                    REFERENCES users (id) ON DELETE SET NULL,

  -- 訪問情報
  visit_date        date            NOT NULL,

  -- 入場結果
  result            report_result   NOT NULL,

  -- タトゥー情報
  tattoo_size       tattoo_size     NOT NULL,

  -- タトゥー部位（複数選択可）
  -- 値は arm / leg / back / chest_stomach / neck_face / other
  tattoo_location   text[]          NOT NULL DEFAULT '{}',

  -- 施設側の対応
  facility_response facility_response NOT NULL,

  -- コメント（翻訳前の原文）
  comment_original  text,
  comment_lang      comment_lang    NOT NULL DEFAULT 'unknown',

  -- 写真（Supabase Storage の public URL）
  photo_url         text,

  -- 管理フラグ（虚偽報告・スパム等）
  flagged           boolean         NOT NULL DEFAULT false,

  created_at        timestamptz     NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- インデックス
-- ----------------------------------------------------------------------------

-- 施設別レポート一覧（最も多用するクエリ）
CREATE INDEX idx_reports_facility_id
  ON reports (facility_id, created_at DESC);

-- ユーザー投稿履歴
CREATE INDEX idx_reports_user_id
  ON reports (user_id)
  WHERE user_id IS NOT NULL;

-- 入場結果フィルタ
CREATE INDEX idx_reports_result
  ON reports (result);

-- 直近12ヶ月の集計用（facility_stats トリガーで使用）
CREATE INDEX idx_reports_visit_date
  ON reports (facility_id, visit_date DESC);

-- フラグ管理用（管理者向け）
CREATE INDEX idx_reports_flagged
  ON reports (flagged)
  WHERE flagged = true;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 全員（匿名含む）が非フラグレポートを SELECT 可
CREATE POLICY "reports_select_all"
  ON reports FOR SELECT
  USING (flagged = false);

-- 管理者はフラグ済みも含め全件参照可
CREATE POLICY "reports_select_admin"
  ON reports FOR SELECT
  USING (auth.role() = 'service_role');

-- 認証済みユーザー: INSERT 可（自分の user_id または NULL で匿名）
CREATE POLICY "reports_insert_authenticated"
  ON reports FOR INSERT
  WITH CHECK (
    -- 認証済みユーザーは自分の ID か NULL のみ指定可
    (auth.role() = 'authenticated' AND (user_id = auth.uid() OR user_id IS NULL))
    -- 匿名ユーザーは user_id = NULL のみ
    OR (auth.role() = 'anon' AND user_id IS NULL)
  );

-- 自分の投稿のみ UPDATE 可（flagged 列は除外: 管理者のみ変更可）
CREATE POLICY "reports_update_own"
  ON reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND flagged = false  -- 自分でフラグを立てることは不可
  );

-- 管理者はすべて更新可（フラグ操作含む）
CREATE POLICY "reports_update_admin"
  ON reports FOR UPDATE
  USING (auth.role() = 'service_role');

-- 自分の投稿のみ DELETE 可
CREATE POLICY "reports_delete_own"
  ON reports FOR DELETE
  USING (auth.uid() = user_id);

-- 管理者は全件削除可
CREATE POLICY "reports_delete_admin"
  ON reports FOR DELETE
  USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- report_translations テーブル
-- ----------------------------------------------------------------------------

CREATE TABLE report_translations (
  report_id       uuid        NOT NULL
                              REFERENCES reports (id) ON DELETE CASCADE,
  target_lang     text        NOT NULL,  -- 'ja' | 'zh_tw' | 'en'
  translated_text text        NOT NULL,
  translated_at   timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (report_id, target_lang)
);

-- インデックス
CREATE INDEX idx_report_translations_report_id
  ON report_translations (report_id);

-- RLS
ALTER TABLE report_translations ENABLE ROW LEVEL SECURITY;

-- 全員 SELECT 可
CREATE POLICY "report_translations_select_all"
  ON report_translations FOR SELECT
  USING (true);

-- INSERT / UPDATE は service_role（翻訳バッチ処理）のみ
CREATE POLICY "report_translations_insert_admin"
  ON report_translations FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "report_translations_update_admin"
  ON report_translations FOR UPDATE
  USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- コメント
-- ----------------------------------------------------------------------------

COMMENT ON TABLE users IS
  'auth.users のパブリックミラー。表示言語設定を保持。';

COMMENT ON TABLE reports IS
  'タトゥー入場可否の口コミ投稿。匿名（user_id=NULL）投稿を許容。';

COMMENT ON COLUMN reports.result IS
  'admitted: 問題なし / admitted_with_sticker: シール隠し / admitted_with_cover: 衣類隠し / denied: 拒否 / not_asked: 確認なし';
COMMENT ON COLUMN reports.tattoo_location IS
  '部位配列: arm/leg/back/chest_stomach/neck_face/other';
COMMENT ON COLUMN reports.comment_original IS
  '投稿者が入力した原文。翻訳前テキスト。';
COMMENT ON COLUMN reports.flagged IS
  '管理者が虚偽・スパムと判定したレポートに true をセット。SELECT RLS で除外される。';

COMMENT ON TABLE report_translations IS
  'レポートの多言語翻訳キャッシュ。Edge Function の翻訳バッチが書き込む。';
COMMENT ON COLUMN report_translations.target_lang IS
  '翻訳先言語コード: ja / zh_tw / en';
