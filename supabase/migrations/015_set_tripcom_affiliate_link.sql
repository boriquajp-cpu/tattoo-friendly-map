-- =============================================================================
-- 015_set_tripcom_affiliate_link.sql
-- Trip.com アフィリエイトプログラム承認済み。短縮アフィリエイトリンクを設定する。
-- bookingLinks.ts の applyAffiliate() は http(s) から始まる値を完全な URL として
-- 扱い、宿泊予約セクションの Trip.com ボタンのリンク先をそのまま置き換える。
-- =============================================================================

UPDATE app_settings
SET value = 'https://www.trip.com/t/XkJd1hUWMW2', updated_at = now()
WHERE key = 'affiliate_param_tripcom';
