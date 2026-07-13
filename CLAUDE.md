# CLAUDE.md — tattoo-friendly-map

## プロジェクト概要

タトゥーがある人が日本国内で入れる施設（温泉・銭湯・ジム・プール・屋外）を探せる地図アプリ。
メインターゲット：台湾人観光客。繁体中文対応が差別化ポイント。

詳細仕様: `docs/tattoo-friendly-map-setup.md`

---

## 技術スタック

| 領域 | 技術 |
|------|------|
| フロントエンド | React 18 + TypeScript + Vite |
| 地図 | Mapbox GL JS (react-map-gl) |
| バックエンド/DB | Supabase (PostgreSQL) |
| 多言語 | react-i18next |
| 自動翻訳 | Claude API（コメントの自由記述のみ） |
| ホスティング | Vercel（予定） |

---

## ディレクトリ構成

```
src/
├── components/
│   ├── Map/          ← 地図コンポーネント
│   ├── FacilityCard/ ← 施設カード
│   ├── ReportForm/   ← 報告フォーム
│   ├── FacilityDetail/ ← 施設詳細
│   └── Layout/       ← ナビ・レイアウト
├── pages/            ← ルートページ
├── lib/
│   ├── supabase.ts   ← Supabaseクライアント
│   └── claudeApi.ts  ← Claude翻訳API
├── locales/          ← i18n JSONファイル
│   ├── ja.json
│   ├── zh-TW.json
│   └── en.json
├── types/
│   └── index.ts      ← 全TypeScript型定義
└── hooks/            ← カスタムフック
supabase/
└── migrations/       ← SQLマイグレーション
```

---

## 環境変数（.env.localに設定）

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_MAPBOX_TOKEN=pk.your-mapbox-token
```

---

## データモデル（主要テーブル）

### facilities — 施設マスタ
- `category`: `'onsen' | 'gym_pool' | 'outdoor'`
- `name_ja`, `name_zh_tw`, `address_ja`, `address_zh_tw`
- `lat`, `lng`, `booking_url_klook`, `booking_url_kkday`, `booking_url_agoda`, `booking_url_trip_com`

### reports — ユーザー報告
- `result`: `'admitted' | 'admitted_with_sticker' | 'admitted_with_cover' | 'denied' | 'not_asked'`
- `tattoo_size`, `tattoo_location[]`, `facility_response`
- `comment_original`, `comment_lang`, `photo_url`, `flagged`

### facility_stats — 集計キャッシュ（自動更新）
- `summary_label`: `'high' | 'conditional' | 'mixed' | 'low' | 'no_data'`
- `confidence_level`: `'high' | 'medium' | 'low'`
- 直近12ヶ月の重み付き集計（3ヶ月=3, 4-6ヶ月=2, 7-12ヶ月=1）

---

## 集計ロジック（facility_stats）

| 入れた系の重み付き割合 | summary_label |
|---|---|
| ≥ 90% | high |
| 50〜90% | conditional |
| 10〜50% | mixed |
| < 10% | low |
| 報告なし | no_data |

- `'not_asked'`は集計から除外（別枠カウント）
- 信頼度：件数5件以上=high, 2-4=medium, 1=low

---

## 画面構成

| ルート | ページ | 説明 |
|--------|--------|------|
| `/` | MapPage | 地図メイン、カテゴリフィルター、色付きピン |
| `/list` | FacilityListPage | 施設一覧 |
| `/facility/:id` | FacilityDetailPage | 集計・報告一覧・予約リンク |
| `/facility/:id/report` | ReportFormPage | 体験報告投稿 |
| `/login` | LoginPage | メール認証 |

---

## 開発コマンド

```bash
npm run dev    # 開発サーバー起動
npm run build  # ビルド
npm run lint   # ESLint
```

---

## 重要な設計方針

- **土日を休日扱いしない**（施設の定休日はDBのbusiness_hoursに入れる）
- コメント翻訳はClaudeAPIを使うが**キャッシュ必須**（report_translationsテーブル）
- 写真は施設外観・シールのみ許容（利用規約で明示）
- 将来の有料掲載は表示順位のみ影響させる（集計結果には影響させない）
- 弁護士チェック前に本番ローンチしない
