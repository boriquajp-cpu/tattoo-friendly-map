/**
 * 投稿前の不適切コンテンツフィルタリング（Apple Guideline 1.2 UGCアプリ必須要件）。
 * 完全な検出は狙わず、明らかな迷惑行為・侮辱表現だけを機械的に弾く一次フィルタ。
 * すり抜けたものは ReportFlagModal / AdminPage の通報・モデレーションフローで拾う想定。
 */

// 宣伝・勧誘目的のスパム（URL貼り付け、LINE ID交換勧誘など）
const SPAM_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /www\./i,
  /line\s*id[:：]?\s*[\w.-]{3,}/i,
  /@[\w.-]{3,}\s*(で検索|を追加|まで連絡)/,
];

// 明確な侮辱・ヘイト表現（代表的なもののみ。日本語・英語）
const ABUSIVE_PATTERNS: RegExp[] = [
  /死ね|殺すぞ|きちがい|気違い/,
  /\bfuck\s*(you|off)\b|\bnigger\b|\bbitch\b/i,
];

const ALL_PATTERNS = [...SPAM_PATTERNS, ...ABUSIVE_PATTERNS];

export function containsProhibitedContent(text: string | null | undefined): boolean {
  if (!text) return false;
  return ALL_PATTERNS.some((pattern) => pattern.test(text));
}
