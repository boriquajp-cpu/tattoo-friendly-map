/**
 * Claude API を使ったコメント翻訳ユーティリティ
 *
 * 実体は Supabase Edge Function (`supabase/functions/translate`) 経由で呼び出す。
 * Anthropic API キーは Edge Function 側でのみ使用し、ブラウザには露出しない。
 * 翻訳結果は `report_translations` テーブルにキャッシュされ、同一 report_id +
 * target_lang の組み合わせでは Claude API を再度呼び出さない。
 */

import { supabase } from './supabase';

/**
 * 報告コメントを指定言語に翻訳する（キャッシュ優先）。
 * エラー発生時は元のテキストをそのまま返す（フォールバック）。
 *
 * @param reportId    - 翻訳対象の報告 ID
 * @param targetLang  - 翻訳先言語コード（例: 'ja', 'zh_tw', 'en', 'ko'）
 * @param fallbackText - エラー時に返すフォールバックテキスト（通常は原文）
 * @returns           翻訳済みテキスト、またはエラー時はフォールバックテキスト
 */
export async function translateComment(
  reportId: string,
  targetLang: string,
  fallbackText: string
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke<{ translated?: string; error?: string }>(
      'translate',
      { body: { reportId, targetLang } }
    );

    if (error || !data?.translated) {
      console.error('translateComment failed:', error ?? data?.error);
      return fallbackText;
    }

    return data.translated;
  } catch (err) {
    console.error('translateComment failed:', err);
    return fallbackText;
  }
}
