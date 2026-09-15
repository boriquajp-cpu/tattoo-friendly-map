-- =============================================================================
-- 016_set_klook_affiliate_param.sql
-- Klook アフィリエイトプログラム承認済み。aid をクエリパラメータとして設定する。
-- Klook は施設名検索URLへの追加が確認済みのため、フルURLでなくパラメータのみ
-- 保持し、bookingLinks.ts の applyAffiliate() がベースURLに追加する。
-- =============================================================================

UPDATE app_settings
SET value = 'aid=135308', updated_at = now()
WHERE key = 'affiliate_param_klook';
