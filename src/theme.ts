import type { SummaryLabel } from './types';

/**
 * デザイン方向「案A：モダン洗練」のトークン。
 * UI の地の色は墨黒に寄せ、色は判定（summaryColor / summaryBadge）だけに持たせる。
 * 旧: アクセント #6366f1（インディゴ）→ ink 系に置換。
 */
export const c = {
  bg: '#ffffff',
  surface: '#ffffff',
  ink: '#0f172a',
  inkSoft: '#334155',
  muted: '#64748b',
  edge: '#e7ebf0',
  accent: '#0f172a',
  accentInk: '#ffffff',
  accentSoft: '#f1f5f9',
  report: '#f97316', // 体験報告 CTA（アクション色として据え置き）
  danger: '#dc2626',
  radius: 10,
} as const;

/**
 * 地図ピン・凡例で使う判定 5 色。
 * 「データを表す色」なので方向性を変えても固定する（緑=ほぼ入れる 〜 灰=情報なし）。
 */
export const summaryColor: Record<SummaryLabel, string> = {
  high: '#22c55e',
  conditional: '#eab308',
  mixed: '#f97316',
  low: '#ef4444',
  no_data: '#9ca3af',
};

/** 施設詳細の判定バッジ（淡色地 + 濃色文字）。 */
export const summaryBadge: Record<SummaryLabel, { bg: string; color: string }> = {
  high: { bg: '#dcfce7', color: '#166534' },
  conditional: { bg: '#fef9c3', color: '#854d0e' },
  mixed: { bg: '#ffedd5', color: '#9a3412' },
  low: { bg: '#fee2e2', color: '#991b1b' },
  no_data: { bg: '#f3f4f6', color: '#374151' },
};
