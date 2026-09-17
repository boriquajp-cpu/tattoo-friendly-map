-- =============================================================================
-- 017_set_kkday_affiliate_param.sql
-- KKday アフィリエイトプログラム承認済み。cid をクエリパラメータとして設定する。
-- bookingLinks.ts の applyAffiliate() がベースURLに追加する。
-- =============================================================================

UPDATE app_settings
SET value = 'cid=26904', updated_at = now()
WHERE key = 'affiliate_param_kkday';
