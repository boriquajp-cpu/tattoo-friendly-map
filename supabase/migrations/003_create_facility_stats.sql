-- =============================================================================
-- 003_create_facility_stats.sql
-- タトゥーフレンドリー施設マップ - 集計キャッシュ・自動更新トリガー
-- =============================================================================

-- ----------------------------------------------------------------------------
-- ENUM 型定義
-- ----------------------------------------------------------------------------

-- 施設のタトゥー受入度サマリーラベル
CREATE TYPE summary_label AS ENUM (
  'high',         -- 入れた系 >= 90%: ほぼ入れる
  'conditional',  -- 入れた系 50-90%: 条件付きで入れる
  'mixed',        -- 入れた系 10-50%: 評価が混在
  'low',          -- 入れた系 < 10%: ほぼ断られる
  'no_data'       -- 直近12ヶ月のレポートなし
);

-- 集計の信頼度
CREATE TYPE confidence_level AS ENUM (
  'high',    -- レポート5件以上
  'medium',  -- レポート2-4件
  'low'      -- レポート1件
);

-- ----------------------------------------------------------------------------
-- facility_stats テーブル（集計キャッシュ）
-- ----------------------------------------------------------------------------

CREATE TABLE facility_stats (
  facility_id        uuid            PRIMARY KEY
                                     REFERENCES facilities (id) ON DELETE CASCADE,

  -- タトゥー受入度サマリー
  summary_label      summary_label   NOT NULL DEFAULT 'no_data',

  -- 集計の信頼度
  confidence_level   confidence_level,  -- no_data の場合 NULL

  -- 直近12ヶ月の有効レポート件数（'not_asked' 除外）
  report_count_12mo  integer         NOT NULL DEFAULT 0,

  -- 最も多かった施設対応の説明文（ja / zh_tw / en の JSON オブジェクト、nullable）
  -- 例: {"ja": "ラッシュガード着用で可", "zh_tw": "需穿著防曬衣", "en": "rashguard required"}
  top_condition_text text,

  -- 最終集計日時
  last_updated       timestamptz     NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- インデックス
-- ----------------------------------------------------------------------------

-- サマリーラベルでの絞り込み（マップの凡例フィルタ）
CREATE INDEX idx_facility_stats_summary_label
  ON facility_stats (summary_label);

-- 信頼度フィルタ
CREATE INDEX idx_facility_stats_confidence
  ON facility_stats (confidence_level);

-- ----------------------------------------------------------------------------
-- 集計関数: recalculate_facility_stats(facility_id)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION recalculate_facility_stats(p_facility_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now            timestamptz := now();
  v_12mo_ago       date        := (v_now - INTERVAL '12 months')::date;
  v_3mo_ago        date        := (v_now - INTERVAL '3 months')::date;
  v_6mo_ago        date        := (v_now - INTERVAL '6 months')::date;

  -- 集計変数
  v_total_weight   numeric     := 0;
  v_admitted_weight numeric    := 0;
  v_report_count   integer     := 0;
  v_ratio          numeric     := 0;

  -- 結果変数
  v_summary        summary_label   := 'no_data';
  v_confidence     confidence_level;
  v_top_condition  text;

  -- レコード型（集計クエリ用）
  v_rec            record;
BEGIN
  -- ------------------------------------------------------------------
  -- STEP 1: 直近12ヶ月・非フラグ・'not_asked'除外 のレポートを重み付き集計
  -- ------------------------------------------------------------------
  SELECT
    COUNT(*)                                              AS cnt,
    -- 重み付き合計
    SUM(
      CASE
        WHEN r.visit_date >= v_3mo_ago THEN 3   -- 3ヶ月以内: 重み 3
        WHEN r.visit_date >= v_6mo_ago THEN 2   -- 4-6ヶ月: 重み 2
        ELSE 1                                  -- 7-12ヶ月: 重み 1
      END
    )::numeric                                            AS total_w,
    -- 「入れた系」の重み付き合計
    -- (admitted / admitted_with_sticker / admitted_with_cover)
    SUM(
      CASE
        WHEN r.result IN ('admitted', 'admitted_with_sticker', 'admitted_with_cover')
        THEN (
          CASE
            WHEN r.visit_date >= v_3mo_ago THEN 3
            WHEN r.visit_date >= v_6mo_ago THEN 2
            ELSE 1
          END
        )
        ELSE 0
      END
    )::numeric                                            AS admitted_w
  INTO v_report_count, v_total_weight, v_admitted_weight
  FROM reports r
  WHERE
    r.facility_id = p_facility_id
    AND r.flagged  = false
    AND r.result  <> 'not_asked'
    AND r.visit_date >= v_12mo_ago;

  -- ------------------------------------------------------------------
  -- STEP 2: summary_label・confidence_level の決定
  -- ------------------------------------------------------------------
  IF v_report_count = 0 OR v_total_weight = 0 THEN
    -- レポートなし
    v_summary    := 'no_data';
    v_confidence := NULL;
  ELSE
    -- 重み付き割合
    v_ratio := v_admitted_weight / v_total_weight;

    IF    v_ratio >= 0.90 THEN v_summary := 'high';
    ELSIF v_ratio >= 0.50 THEN v_summary := 'conditional';
    ELSIF v_ratio >= 0.10 THEN v_summary := 'mixed';
    ELSE                       v_summary := 'low';
    END IF;

    IF    v_report_count >= 5 THEN v_confidence := 'high';
    ELSIF v_report_count >= 2 THEN v_confidence := 'medium';
    ELSE                           v_confidence := 'low';
    END IF;
  END IF;

  -- ------------------------------------------------------------------
  -- STEP 3: 最頻出 facility_response を top_condition_text に格納
  --         ('nothing_asked' は除外)
  --         facility_response の ENUM 値をそのまま text で保存し、
  --         フロントエンド側でローカライズする
  -- ------------------------------------------------------------------
  SELECT r.facility_response::text
  INTO   v_top_condition
  FROM   reports r
  WHERE
    r.facility_id      = p_facility_id
    AND r.flagged      = false
    AND r.result      <> 'not_asked'
    AND r.visit_date  >= v_12mo_ago
    AND r.facility_response <> 'nothing_asked'
  GROUP BY r.facility_response
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- ------------------------------------------------------------------
  -- STEP 4: facility_stats を UPSERT
  -- ------------------------------------------------------------------
  INSERT INTO facility_stats (
    facility_id,
    summary_label,
    confidence_level,
    report_count_12mo,
    top_condition_text,
    last_updated
  )
  VALUES (
    p_facility_id,
    v_summary,
    v_confidence,
    v_report_count,
    v_top_condition,
    v_now
  )
  ON CONFLICT (facility_id) DO UPDATE SET
    summary_label      = EXCLUDED.summary_label,
    confidence_level   = EXCLUDED.confidence_level,
    report_count_12mo  = EXCLUDED.report_count_12mo,
    top_condition_text = EXCLUDED.top_condition_text,
    last_updated       = EXCLUDED.last_updated;
END;
$$;

-- ----------------------------------------------------------------------------
-- トリガー関数: reports の変更時に facility_stats を再集計
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_refresh_facility_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_facility_id uuid;
BEGIN
  -- INSERT / UPDATE: NEW.facility_id を対象
  -- DELETE: OLD.facility_id を対象
  -- UPDATE で facility_id が変わった場合は両方更新
  IF TG_OP = 'DELETE' THEN
    v_target_facility_id := OLD.facility_id;
    PERFORM recalculate_facility_stats(v_target_facility_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- facility_id が変更された場合は旧施設も更新
    IF OLD.facility_id IS DISTINCT FROM NEW.facility_id THEN
      PERFORM recalculate_facility_stats(OLD.facility_id);
    END IF;
    v_target_facility_id := NEW.facility_id;
  ELSE
    -- INSERT
    v_target_facility_id := NEW.facility_id;
  END IF;

  PERFORM recalculate_facility_stats(v_target_facility_id);

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- トリガー設定: reports の INSERT / UPDATE / DELETE 後に実行
-- ----------------------------------------------------------------------------

CREATE TRIGGER reports_refresh_facility_stats
  AFTER INSERT OR UPDATE OR DELETE
  ON reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_facility_stats();

-- ----------------------------------------------------------------------------
-- 初期データ投入用ヘルパー: 全施設の stats を一括再集計
-- （データシード後やメンテナンス時に手動実行）
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION backfill_facility_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_facility record;
BEGIN
  FOR v_facility IN SELECT id FROM facilities LOOP
    PERFORM recalculate_facility_stats(v_facility.id);
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE facility_stats ENABLE ROW LEVEL SECURITY;

-- 全員 SELECT 可（マップ表示に使用）
CREATE POLICY "facility_stats_select_all"
  ON facility_stats FOR SELECT
  USING (true);

-- INSERT / UPDATE / DELETE はトリガー（SECURITY DEFINER）経由のみ
-- 直接書き込みは service_role のみ許可
CREATE POLICY "facility_stats_insert_admin"
  ON facility_stats FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "facility_stats_update_admin"
  ON facility_stats FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "facility_stats_delete_admin"
  ON facility_stats FOR DELETE
  USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- コメント
-- ----------------------------------------------------------------------------

COMMENT ON TABLE facility_stats IS
  '施設ごとのタトゥー受入度集計キャッシュ。reports テーブルへの書き込みトリガーで自動更新。';

COMMENT ON COLUMN facility_stats.summary_label IS
  'high: 入れた系>=90% / conditional: 50-90% / mixed: 10-50% / low: <10% / no_data: 直近12ヶ月レポートなし';
COMMENT ON COLUMN facility_stats.confidence_level IS
  'high: 5件以上 / medium: 2-4件 / low: 1件 / NULL: no_data';
COMMENT ON COLUMN facility_stats.report_count_12mo IS
  '直近12ヶ月の有効レポート件数（not_asked・flaggedを除外）';
COMMENT ON COLUMN facility_stats.top_condition_text IS
  '最頻出の facility_response ENUM 値（nothing_asked 除外）。フロントエンド側でローカライズして表示する。';

COMMENT ON FUNCTION recalculate_facility_stats(uuid) IS
  '指定施設の facility_stats を直近12ヶ月のレポートから再集計する。重み付き集計（3mo=3, 4-6mo=2, 7-12mo=1）を使用。';
COMMENT ON FUNCTION backfill_facility_stats() IS
  '全施設の facility_stats を一括再集計するメンテナンス用関数。シード後や集計ロジック変更時に手動実行。';
