import type { SupportedLang } from '../types';

/** 都道府県名 → 各社サイトのローマ字スラッグ（Agoda の /city/<slug>-jp.html 用）。 */
const PREFECTURE_SLUG: Record<string, string> = {
  '北海道': 'hokkaido', '青森県': 'aomori', '岩手県': 'iwate', '宮城県': 'miyagi',
  '秋田県': 'akita', '山形県': 'yamagata', '福島県': 'fukushima', '茨城県': 'ibaraki',
  '栃木県': 'tochigi', '群馬県': 'gunma', '埼玉県': 'saitama', '千葉県': 'chiba',
  '東京都': 'tokyo', '神奈川県': 'kanagawa', '新潟県': 'niigata', '富山県': 'toyama',
  '石川県': 'ishikawa', '福井県': 'fukui', '山梨県': 'yamanashi', '長野県': 'nagano',
  '岐阜県': 'gifu', '静岡県': 'shizuoka', '愛知県': 'aichi', '三重県': 'mie',
  '滋賀県': 'shiga', '京都府': 'kyoto', '大阪府': 'osaka', '兵庫県': 'hyogo',
  '奈良県': 'nara', '和歌山県': 'wakayama', '鳥取県': 'tottori', '島根県': 'shimane',
  '岡山県': 'okayama', '広島県': 'hiroshima', '山口県': 'yamaguchi', '徳島県': 'tokushima',
  '香川県': 'kagawa', '愛媛県': 'ehime', '高知県': 'kochi', '福岡県': 'fukuoka',
  '佐賀県': 'saga', '長崎県': 'nagasaki', '熊本県': 'kumamoto', '大分県': 'oita',
  '宮崎県': 'miyazaki', '鹿児島県': 'kagoshima', '沖縄県': 'okinawa',
};

/** `address_ja` の先頭一致から都道府県名を取り出す。 */
function extractPrefecture(addressJa?: string): string | null {
  if (!addressJa) return null;
  return Object.keys(PREFECTURE_SLUG).find((pref) => addressJa.startsWith(pref)) ?? null;
}

const KLOOK_LOCALE: Record<SupportedLang, string> = {
  ja: 'ja', zh_tw: 'zh-TW', en: 'en-US', ko: 'ko',
};
const KKDAY_LOCALE: Record<SupportedLang, string> = {
  ja: 'ja', zh_tw: 'zh-tw', en: 'en', ko: 'ko',
};
const AGODA_LOCALE: Record<SupportedLang, string> = {
  ja: 'ja-jp', zh_tw: 'zh-tw', en: 'en-us', ko: 'ko-kr',
};

export interface BookingLinks {
  klook: string;
  agoda: string;
  kkday: string;
  tripcom: string;
}

/** 各社のアフィリエイトパラメータ（例: "aid=12345"）。未提携の間は undefined/null でよい。 */
export interface AffiliateParams {
  kkday?: string | null;
  klook?: string | null;
  agoda?: string | null;
  tripcom?: string | null;
}

/**
 * アフィリエイト設定値を URL に適用する。
 * - 値が完全な URL（短縮リンクなど）の場合はそのまま置き換える。
 * - 値が `key=value` のようなクエリ文字列の場合はベース URL に追加する。
 */
function applyAffiliate(baseUrl: string, value: string | null | undefined): string {
  if (!value) return baseUrl;
  if (/^https?:\/\//.test(value)) return value;
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${value}`;
}

/**
 * 施設名・住所から各予約プラットフォームへのリンクを組み立てる。
 * Klook: 施設名でのサイト内検索が機能することを確認済み。
 * Agoda: 施設名検索は不可のため都道府県単位のシティページを使用。
 * KKday / Trip.com: 直リンク可能な検索URLが存在しないため、ロケール別トップページにフォールバック。
 *
 * `affiliate` はアプリの再デプロイなしで有効化できるよう Supabase の app_settings から渡す
 * 想定（各社の提携プログラム審査が通り次第、DBの値を書き換えるだけで反映される）。
 */
export function getBookingLinks(
  facilityName: string,
  addressJa: string | undefined,
  lang: SupportedLang,
  affiliate?: AffiliateParams
): BookingLinks {
  const query = encodeURIComponent(facilityName);
  const prefecture = extractPrefecture(addressJa);
  const prefSlug = prefecture ? PREFECTURE_SLUG[prefecture] : null;

  return {
    klook: applyAffiliate(
      `https://www.klook.com/${KLOOK_LOCALE[lang]}/search/result/?query=${query}`,
      affiliate?.klook
    ),
    agoda: applyAffiliate(
      prefSlug
        ? `https://www.agoda.com/${AGODA_LOCALE[lang]}/city/${prefSlug}-jp.html`
        : `https://www.agoda.com/${AGODA_LOCALE[lang]}/`,
      affiliate?.agoda
    ),
    kkday: applyAffiliate(`https://www.kkday.com/${KKDAY_LOCALE[lang]}`, affiliate?.kkday),
    tripcom: applyAffiliate('https://www.trip.com/', affiliate?.tripcom),
  };
}
