-- =============================================================================
-- 001_create_facilities.sql
-- タトゥーフレンドリー施設マップ - 施設マスターテーブル
-- =============================================================================

-- ----------------------------------------------------------------------------
-- ENUM 型定義
-- ----------------------------------------------------------------------------

CREATE TYPE facility_category AS ENUM (
  'onsen',      -- 温泉・銭湯・サウナ
  'gym_pool',   -- ジム・プール・スポーツ施設
  'outdoor'     -- 野外・ビーチ・レジャー施設
);

-- ----------------------------------------------------------------------------
-- facilities テーブル
-- ----------------------------------------------------------------------------

CREATE TABLE facilities (
  id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本分類
  category         facility_category NOT NULL,

  -- 施設名（日本語 / 繁体字中国語）
  name_ja          text            NOT NULL,
  name_zh_tw       text            NOT NULL,

  -- 住所（日本語 / 繁体字中国語）
  address_ja       text            NOT NULL,
  address_zh_tw    text            NOT NULL,

  -- 位置情報
  lat              float8          NOT NULL,
  lng              float8          NOT NULL,

  -- 連絡先・Webサイト
  phone            text,           -- NULL可（非公開施設など）
  official_url     text,           -- NULL可

  -- 営業時間（自由記述: "10:00-22:00 / 月曜定休" など）
  business_hours   text,

  -- 日帰り体験予約リンク（OTA: Klook / KKday）
  booking_url_klook   text,
  booking_url_kkday   text,

  -- 宿泊予約リンク（OTA: Agoda / Trip.com）
  booking_url_agoda   text,
  booking_url_trip_com text,

  -- タイムスタンプ
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- updated_at 自動更新トリガー
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER facilities_set_updated_at
  BEFORE UPDATE ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ----------------------------------------------------------------------------
-- インデックス
-- ----------------------------------------------------------------------------

-- カテゴリ絞り込み用
CREATE INDEX idx_facilities_category
  ON facilities (category);

-- 位置情報（近隣施設検索用）
-- Supabase では PostGIS 拡張なしでも (lat, lng) インデックスで BETWEEN 検索可
CREATE INDEX idx_facilities_lat_lng
  ON facilities (lat, lng);

-- 施設名 全文検索用（日本語・繁体字）
CREATE INDEX idx_facilities_name_ja_trgm
  ON facilities USING gin (name_ja gin_trgm_ops);

CREATE INDEX idx_facilities_name_zh_tw_trgm
  ON facilities USING gin (name_zh_tw gin_trgm_ops);

-- pg_trgm 拡張を有効化（Supabase では通常デフォルト有効だが念のため）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

-- 全員（匿名含む）が SELECT 可能
CREATE POLICY "facilities_select_all"
  ON facilities
  FOR SELECT
  USING (true);

-- INSERT / UPDATE / DELETE は service_role（管理者）のみ
-- 通常ユーザー（anon / authenticated）は書き込み不可
-- ※ Supabase では service_role key を使う管理スクリプトのみがバイパス可能
CREATE POLICY "facilities_insert_admin_only"
  ON facilities
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "facilities_update_admin_only"
  ON facilities
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "facilities_delete_admin_only"
  ON facilities
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- コメント
-- ----------------------------------------------------------------------------

COMMENT ON TABLE facilities IS
  '日本国内のタトゥーフレンドリー施設マスター。台湾人観光客向けに日本語・繁体字の両名称を保持。';

COMMENT ON COLUMN facilities.category IS
  '施設カテゴリ: onsen=温泉・銭湯, gym_pool=ジム・プール, outdoor=野外・レジャー';
COMMENT ON COLUMN facilities.lat IS '緯度 (WGS84)';
COMMENT ON COLUMN facilities.lng IS '経度 (WGS84)';
COMMENT ON COLUMN facilities.booking_url_klook IS '日帰り体験チケット - Klook 予約URL';
COMMENT ON COLUMN facilities.booking_url_kkday IS '日帰り体験チケット - KKday 予約URL';
COMMENT ON COLUMN facilities.booking_url_agoda IS '宿泊予約 - Agoda URL';
COMMENT ON COLUMN facilities.booking_url_trip_com IS '宿泊予約 - Trip.com URL';
