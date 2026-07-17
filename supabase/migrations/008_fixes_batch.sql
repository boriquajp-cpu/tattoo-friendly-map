-- =============================================================================
-- 008_fixes_batch.sql
-- タトゥーフレンドリー施設マップ - 1000人ユーザー想定UX監査の指摘対応(DB分)
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. comment_lang に 'ko' を追加（韓国語ユーザーの報告言語が正しく記録されるように）
-- ----------------------------------------------------------------------------

ALTER TYPE comment_lang ADD VALUE IF NOT EXISTS 'ko';

-- ----------------------------------------------------------------------------
-- 2. facility_translations テーブル
-- 施設名・住所の英語/韓国語翻訳キャッシュ（Claude Edge Function が書き込む）
-- ----------------------------------------------------------------------------

CREATE TABLE facility_translations (
  facility_id  uuid        NOT NULL
                           REFERENCES facilities (id) ON DELETE CASCADE,
  target_lang  text        NOT NULL, -- 'en' | 'ko'
  name         text        NOT NULL,
  address      text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (facility_id, target_lang)
);

CREATE INDEX idx_facility_translations_facility_id
  ON facility_translations (facility_id);

ALTER TABLE facility_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_translations_select_all"
  ON facility_translations FOR SELECT
  USING (true);

CREATE POLICY "facility_translations_insert_service_role"
  ON facility_translations FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "facility_translations_update_service_role"
  ON facility_translations FOR UPDATE
  USING (auth.role() = 'service_role');

COMMENT ON TABLE facility_translations IS
  '施設名・住所の英語/韓国語翻訳キャッシュ。translate-facilities Edge Function が書き込む。';

-- ----------------------------------------------------------------------------
-- 3. favorites テーブル
-- ログインユーザーのお気に入りをアカウントに紐づけ、端末をまたいで同期する
-- ----------------------------------------------------------------------------

CREATE TABLE favorites (
  user_id     uuid        NOT NULL
                          REFERENCES users (id) ON DELETE CASCADE,
  facility_id uuid        NOT NULL
                          REFERENCES facilities (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, facility_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_select_own"
  ON favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "favorites_insert_own"
  ON favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favorites_delete_own"
  ON favorites FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE favorites IS
  'ログインユーザーのお気に入り施設。未ログイン時は localStorage にのみ保存される。';

-- ----------------------------------------------------------------------------
-- 4. facility_stats に内訳カウント列を追加
-- FacilityDetailPage が直近50件のクライアント集計ではなく、この列を参照するようにする
-- ----------------------------------------------------------------------------

ALTER TABLE facility_stats
  ADD COLUMN admitted_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN conditional_count integer NOT NULL DEFAULT 0,
  ADD COLUMN denied_count      integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN facility_stats.admitted_count IS
  '直近12ヶ月・非フラグの report 件数（result = admitted）';
COMMENT ON COLUMN facility_stats.conditional_count IS
  '直近12ヶ月・非フラグの report 件数（result = admitted_with_sticker または admitted_with_cover）';
COMMENT ON COLUMN facility_stats.denied_count IS
  '直近12ヶ月・非フラグの report 件数（result = denied）';

-- ----------------------------------------------------------------------------
-- 5. recalculate_facility_stats() を更新し、内訳カウントも集計する
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

  v_total_weight   numeric     := 0;
  v_admitted_weight numeric    := 0;
  v_report_count   integer     := 0;
  v_ratio          numeric     := 0;

  v_summary        summary_label   := 'no_data';
  v_confidence     confidence_level;
  v_top_condition  text;

  v_admitted_count    integer := 0;
  v_conditional_count integer := 0;
  v_denied_count      integer := 0;
BEGIN
  SELECT
    COUNT(*)                                              AS cnt,
    SUM(
      CASE
        WHEN r.visit_date >= v_3mo_ago THEN 3
        WHEN r.visit_date >= v_6mo_ago THEN 2
        ELSE 1
      END
    )::numeric                                            AS total_w,
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
    )::numeric                                            AS admitted_w,
    COUNT(*) FILTER (WHERE r.result = 'admitted')          AS admitted_cnt,
    COUNT(*) FILTER (WHERE r.result IN ('admitted_with_sticker', 'admitted_with_cover'))
                                                            AS conditional_cnt,
    COUNT(*) FILTER (WHERE r.result = 'denied')            AS denied_cnt
  INTO v_report_count, v_total_weight, v_admitted_weight,
       v_admitted_count, v_conditional_count, v_denied_count
  FROM reports r
  WHERE
    r.facility_id = p_facility_id
    AND r.flagged  = false
    AND r.result  <> 'not_asked'
    AND r.visit_date >= v_12mo_ago;

  IF v_report_count = 0 OR v_total_weight = 0 THEN
    v_summary    := 'no_data';
    v_confidence := NULL;
  ELSE
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

  INSERT INTO facility_stats (
    facility_id,
    summary_label,
    confidence_level,
    report_count_12mo,
    top_condition_text,
    admitted_count,
    conditional_count,
    denied_count,
    last_updated
  )
  VALUES (
    p_facility_id,
    v_summary,
    v_confidence,
    v_report_count,
    v_top_condition,
    v_admitted_count,
    v_conditional_count,
    v_denied_count,
    v_now
  )
  ON CONFLICT (facility_id) DO UPDATE SET
    summary_label      = EXCLUDED.summary_label,
    confidence_level   = EXCLUDED.confidence_level,
    report_count_12mo  = EXCLUDED.report_count_12mo,
    top_condition_text = EXCLUDED.top_condition_text,
    admitted_count      = EXCLUDED.admitted_count,
    conditional_count   = EXCLUDED.conditional_count,
    denied_count        = EXCLUDED.denied_count,
    last_updated        = EXCLUDED.last_updated;
END;
$$;
