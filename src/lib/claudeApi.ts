/**
 * Claude API を使ったコメント翻訳ユーティリティ
 *
 * NOTE: 本番環境ではブラウザから直接 Anthropic API を呼ぶと API キーが露出します。
 * Supabase Edge Function 等のサーバーサイドプロキシ経由での呼び出しを推奨します。
 * ここでは骨格実装として fetch を使ったシンプルな呼び出し形式を示します。
 */

const CLAUDE_API_ENDPOINT = '/api/translate'; // Edge Function / プロキシのエンドポイント

/**
 * テキストを指定言語に翻訳する。
 * エラー発生時は元のテキストをそのまま返す（フォールバック）。
 *
 * @param text     - 翻訳するテキスト
 * @param fromLang - 元の言語コード（例: 'ja', 'zh_tw', 'en'）
 * @param toLang   - 翻訳先言語コード
 * @returns        翻訳済みテキスト、またはエラー時は元テキスト
 */
export async function translateComment(
  text: string,
  fromLang: string,
  toLang: string
): Promise<string> {
  if (!text.trim()) return text;
  if (fromLang === toLang) return text;

  try {
    const response = await fetch(CLAUDE_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fromLang, toLang }),
    });

    if (!response.ok) {
      console.error(`Translation API error: ${response.status} ${response.statusText}`);
      return text;
    }

    const data = (await response.json()) as { translated?: string };
    return data.translated ?? text;
  } catch (err) {
    console.error('translateComment failed:', err);
    return text;
  }
}
