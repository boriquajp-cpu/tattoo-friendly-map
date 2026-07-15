-- =============================================================================
-- 005_create_report_photos_storage.sql
-- タトゥーフレンドリー施設マップ - 報告写真用 Storage バケット
-- =============================================================================

-- ----------------------------------------------------------------------------
-- report-photos バケット（公開読み取り可）
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-photos',
  'report-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Row Level Security（storage.objects）
-- ----------------------------------------------------------------------------

-- 誰でも参照可（施設外観・シールの公開表示用）
CREATE POLICY "report_photos_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-photos');

-- 匿名・認証済みユーザーともにアップロード可（報告投稿フォームから）
CREATE POLICY "report_photos_insert_all"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'report-photos');

COMMENT ON POLICY "report_photos_select_all" ON storage.objects IS
  '報告写真は施設外観・シールのみ想定のため、誰でも参照可とする。';
COMMENT ON POLICY "report_photos_insert_all" ON storage.objects IS
  '匿名報告を許容するため、投稿時点では未認証ユーザーのアップロードも許可する。';
