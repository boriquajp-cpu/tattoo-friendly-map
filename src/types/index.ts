/**
 * tattoo-friendly-map — 共通型定義
 *
 * このファイルはアプリ全体で使用する型・インターフェースを集約しています。
 * DB スキーマ（Supabase / PostgreSQL）との対応はインターフェースごとにコメントで示しています。
 */

// ─────────────────────────────────────────
// ユニオン型 / リテラル型
// ─────────────────────────────────────────

/**
 * 施設カテゴリ。
 * - `onsen`      : 温泉・銭湯・スパ
 * - `gym_pool`   : ジム・プール
 * - `outdoor`    : アウトドア施設（キャンプ場・ウォーターパーク等）
 */
export type FacilityCategory = 'onsen' | 'gym_pool' | 'outdoor';

/**
 * タトゥーに対する施設の対応結果（ユーザー報告ベース）。
 * - `admitted`              : 無条件で入場できた
 * - `admitted_with_sticker` : シールで隠せば入場できた
 * - `admitted_with_cover`   : テーピング・衣類等で隠せば入場できた
 * - `denied`                : 入場を断られた
 * - `not_asked`             : タトゥーの確認・言及がなかった
 */
export type ReportResult =
  | 'admitted'
  | 'admitted_with_sticker'
  | 'admitted_with_cover'
  | 'denied'
  | 'not_asked';

/**
 * タトゥーのサイズ感。
 * - `small`    : 小さい（手のひら未満）
 * - `medium`   : 中程度（手のひら〜腕全体）
 * - `large`    : 大きい（背面・胸など広範囲）
 * - `multiple` : 複数箇所に分散
 */
export type TattooSize = 'small' | 'medium' | 'large' | 'multiple';

/**
 * タトゥーの体の位置。
 * - `arm`           : 腕（上腕・前腕・手首含む）
 * - `leg`           : 脚（太もも・ふくらはぎ・足首含む）
 * - `back`          : 背中・腰
 * - `chest_stomach` : 胸・腹
 * - `neck_face`     : 首・顔
 * - `other`         : その他
 */
export type TattooLocation =
  | 'arm'
  | 'leg'
  | 'back'
  | 'chest_stomach'
  | 'neck_face'
  | 'other';

/**
 * 施設側の対応方法。
 * - `nothing_asked`        : 特に何も言われなかった
 * - `verbal_check`         : 口頭での確認・説明があった
 * - `written_agreement`    : 書面での同意・規約への署名を求められた
 * - `private_bath_offered` : 個室・貸切風呂を案内された
 * - `other_condition`      : その他の条件が提示された
 */
export type FacilityResponse =
  | 'nothing_asked'
  | 'verbal_check'
  | 'written_agreement'
  | 'private_bath_offered'
  | 'other_condition';

/**
 * 施設のタトゥー受け入れ度の総合ラベル（集計結果から自動算出）。
 * - `high`        : ほぼ確実に入場可能
 * - `conditional` : 条件付きで入場可能
 * - `mixed`       : 報告が分かれており一律判断困難
 * - `low`         : 入場が困難な傾向
 * - `no_data`     : 報告データなし
 */
export type SummaryLabel = 'high' | 'conditional' | 'mixed' | 'low' | 'no_data';

/**
 * 集計データの信頼度。
 * - `high`   : 報告件数が十分にある（目安: 10件以上）
 * - `medium` : 一定数の報告がある（目安: 3〜9件）
 * - `low`    : 報告件数が少ない（目安: 1〜2件）
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * アプリがサポートする表示言語。
 * - `ja`    : 日本語
 * - `zh_tw` : 繁體中文（台湾中国語）
 * - `en`    : English
 */
export type SupportedLang = 'ja' | 'zh_tw' | 'en' | 'ko';

// ─────────────────────────────────────────
// DB テーブル対応インターフェース
// ─────────────────────────────────────────

/**
 * 施設情報。
 * DB テーブル: `facilities`
 */
export interface Facility {
  /** 施設の一意識別子（UUID） */
  readonly id: string;

  /** 施設名（原語） */
  readonly name: string;

  /** 施設の住所（表示言語に応じた値） */
  readonly address: string;

  /** 施設の住所（日本語・都道府県抽出用） */
  readonly address_ja?: string;

  /** 施設カテゴリ */
  readonly category: FacilityCategory;

  /** 緯度 */
  readonly latitude: number;

  /** 経度 */
  readonly longitude: number;

  /** 施設の公式ウェブサイト URL */
  readonly website_url?: string;

  /** 施設の電話番号 */
  readonly phone?: string;

  /** 施設の公式タトゥーポリシーテキスト（原語） */
  readonly official_policy?: string;

  /** 施設が所在する国コード（ISO 3166-1 alpha-2） */
  readonly country_code: string;

  /** レコード作成日時（ISO 8601） */
  readonly created_at: string;

  /** レコード最終更新日時（ISO 8601） */
  readonly updated_at: string;
}

/**
 * ユーザーによる訪問報告。
 * DB テーブル: `reports`
 */
export interface Report {
  /** 報告の一意識別子（UUID） */
  readonly id: string;

  /** 対象施設の ID */
  readonly facility_id: string;

  /** 報告したユーザーの ID（匿名報告の場合は null） */
  readonly user_id: string | null;

  /** タトゥーに対する施設の対応結果 */
  readonly result: ReportResult;

  /** タトゥーのサイズ感 */
  readonly tattoo_size?: TattooSize;

  /** タトゥーの体の位置（複数選択可） */
  readonly tattoo_locations?: readonly TattooLocation[];

  /** 施設側の対応方法 */
  readonly facility_response?: FacilityResponse;

  /** 訪問日（YYYY-MM-DD 形式） */
  readonly visit_date?: string;

  /** ユーザーが記入したフリーテキストコメント（原文） */
  readonly comment?: string;

  /** 報告言語 */
  readonly lang: SupportedLang;

  /** 他のユーザーからの「参考になった」数 */
  readonly helpful_count: number;

  /** 報告作成日時（ISO 8601） */
  readonly created_at: string;
}

/**
 * 報告コメントの翻訳データ。
 * DB テーブル: `report_translations`
 */
export interface ReportTranslation {
  /** 翻訳レコードの一意識別子（UUID） */
  readonly id: string;

  /** 元報告の ID */
  readonly report_id: string;

  /** 翻訳先言語 */
  readonly lang: SupportedLang;

  /** 翻訳済みコメント本文 */
  readonly translated_comment: string;

  /** 翻訳エンジン・方式の識別子（例: 'gpt-4o', 'deepl', 'human'） */
  readonly translator?: string;

  /** 翻訳作成日時（ISO 8601） */
  readonly created_at: string;
}

/**
 * 施設ごとの集計統計データ。
 * DB テーブル: `facility_stats`
 * このテーブルはバックグラウンドジョブが自動更新する。
 */
export interface FacilityStats {
  /** 対象施設の ID */
  readonly facility_id: string;

  /** 総報告件数 */
  readonly total_reports: number;

  /** 入場できた（無条件）報告件数 */
  readonly admitted_count: number;

  /** 条件付き入場報告件数（シール・カバー等） */
  readonly conditional_count: number;

  /** 入場拒否報告件数 */
  readonly denied_count: number;

  /** 総合ラベル */
  readonly summary_label: SummaryLabel;

  /** データ信頼度 */
  readonly confidence: ConfidenceLevel;

  /** 統計最終更新日時（ISO 8601） */
  readonly last_updated: string;
}

/**
 * アプリユーザー。
 * DB テーブル: `users`
 */
export interface User {
  /** ユーザーの一意識別子（UUID / Auth プロバイダー ID） */
  readonly id: string;

  /** 表示名 */
  readonly display_name?: string;

  /** アバター画像 URL */
  readonly avatar_url?: string;

  /** ユーザーが設定した優先表示言語 */
  preferred_lang: SupportedLang;

  /** アカウント作成日時（ISO 8601） */
  readonly created_at: string;
}

// ─────────────────────────────────────────
// 派生型 / 複合型
// ─────────────────────────────────────────

/**
 * 施設情報に集計統計を付加した複合型。
 * マップ上のピン表示やリスト表示で使用する。
 * `stats` は集計データが未生成の場合 null となる。
 */
export type FacilityWithStats = Facility & {
  readonly stats: FacilityStats | null;
};

// ─────────────────────────────────────────
// UI / 状態管理用インターフェース
// ─────────────────────────────────────────

/**
 * マップの表示ビューポート。
 * Mapbox GL JS / MapLibre の `LngLatLike` に準拠。
 */
export interface MapViewport {
  /**
   * 中心座標。タプル形式 `[経度, 緯度]`。
   * 経度: -180〜180、緯度: -90〜90。
   */
  center: [lng: number, lat: number];

  /** ズームレベル（0〜22） */
  zoom: number;
}

/**
 * マップ・リスト表示の絞り込みフィルター。
 */
export interface FacilityFilter {
  /**
   * 絞り込むカテゴリの配列。
   * 空配列の場合はすべてのカテゴリを表示する。
   */
  categories: FacilityCategory[];

  /**
   * 絞り込む総合ラベルの配列。
   * 空配列の場合はすべてのラベルを表示する。
   */
  summaryLabels: SummaryLabel[];
}

// ─────────────────────────────────────────
// フォームデータ型
// ─────────────────────────────────────────

/**
 * 報告投稿フォームの入力データ。
 * DB の `reports` テーブルに対応するが、`id` / `user_id` / `created_at` / `helpful_count` は
 * サーバー側で自動付与されるため除外している。
 */
export interface ReportFormData {
  /** 報告対象の施設 ID */
  facility_id: string;

  /** タトゥーに対する施設の対応結果（必須） */
  result: ReportResult;

  /** タトゥーのサイズ感 */
  tattoo_size?: TattooSize;

  /** タトゥーの体の位置（複数選択可） */
  tattoo_locations?: TattooLocation[];

  /** 施設側の対応方法 */
  facility_response?: FacilityResponse;

  /** 訪問日（YYYY-MM-DD 形式） */
  visit_date?: string;

  /** フリーテキストコメント */
  comment?: string;

  /** 報告の入力言語 */
  lang: SupportedLang;
}

// ─────────────────────────────────────────
// API 共通型
// ─────────────────────────────────────────

/**
 * API エラーレスポンスの共通フォーマット。
 */
export interface APIError {
  /** エラーの概要メッセージ（ユーザー向け表示に使用可） */
  readonly message: string;

  /**
   * エラーコード（機械的な識別用）。
   * 例: `'FACILITY_NOT_FOUND'`, `'UNAUTHORIZED'`, `'VALIDATION_ERROR'`
   */
  readonly code: string;
}
