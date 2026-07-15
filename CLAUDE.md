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

---

## 技術スタックのベストプラクティス（2026年時点リサーチ）

### Supabase（最重要リスク領域）
- **RLSは「有効化した」だけでは不十分。** ポリシー未設定のテーブルは事実上アクセス不能または逆に無防備になる。テーブル追加のたびに毎回監査する（2025年に170件超のAI支援開発アプリがRLSポリシー漏れで実害を受けた事例あり）
- **service_roleキーは絶対にクライアントに渡さない。** Viteでは`VITE_`接頭辞の環境変数がクライアントバンドルに埋め込まれるため、`VITE_SUPABASE_SERVICE_ROLE_KEY`のような命名は絶対にしない（Edge Function内でのみ使用）
- RLSの`USING`/`WITH CHECK`で参照する列には必ずインデックスを張る（パフォーマンス低下の主因）。ロール判定はJWTの`app_metadata`に持たせるとDB往復を減らせる
- Storageは**デフォルトで非公開バケット**にし、ユーザー投稿写真は`createSignedUrl()`（短期有効期限）で配信するのが本来は望ましい。現状`report-photos`はpublicバケットだが、施設外観・シールのみという運用ルールなので許容範囲。将来的にモデレーション前の一時保管が必要になったら非公開化を検討
- Edge Functionsは細かく分割しすぎない（コールドスタートは数ms程度だが、関連ロジックはまとめた方が良い）

### MapLibre GL JS / react-map-gl
- 施設数が増えたら`cluster: true`のクラスタリング設定（`clusterRadius`調整）を維持・強化する。全国展開でPOI数が増える場合はベクタータイル化も検討

### react-i18next
- 現状4言語分をベタで持っているが、将来的にファイルが肥大化したら機能別namespace分割 + `i18next-http-backend`での遅延ロードを検討（初期バンドルサイズ削減）

### Vercel
- SPAルーティング用に`vercel.json`の`rewrites`設定を確認（deep link直リロード404対策）。本プロジェクトでは未確認のため要チェック

---

## iOSアプリ化・App Store申請ロードマップ

### 結論: 既存のReact/Viteコードベースを活かすなら **Capacitor** 一択
| 選択肢 | 工数 | コード再利用 | 備考 |
|---|---|---|---|
| **Capacitor** | 低〜中 | ほぼそのまま流用可 | 推奨。ネイティブプラグインを段階的に追加 |
| PWAラッパー（PWABuilder等） | 極小 | 全部流用 | Guideline 4.2却下リスクが最大。避ける |
| React Native / Expo | 高 | UI層は書き直し | 真のネイティブUIだが今回は非推奨（書き直しコスト） |

### Guideline 4.2（Minimum Functionality）対策 — Capacitorアプリ却下の主因
「ただのWebサイトの再パッケージ」と判定されないために、最低限以下を実装する:
1. **ネイティブのタブバー/ナビゲーション**（Web的なスクロールナビではなく）
2. **プッシュ通知**（iOS SafariはWeb Push非対応のため、ネイティブアプリならではの差別化として最重要。例: フォロー施設のポリシー変更通知、投稿した修正報告のレビュー結果通知）
3. **ネイティブのオフライン対応**（地図・施設データのローカルキャッシュ。オフライン時に白画面ではなく「オフラインです、キャッシュを表示中」の専用UI）
4. **ネイティブ機能の活用**（写真アップロードをWebの`<input type=file>`ではなくCameraプラグイン経由に）
5. KKday/Klook等の外部リンクを「主目的」に見せない（あくまで施設詳細内の副次的CTAとして扱う。「リンク集」と判定されるリスク回避）

### Apple Developer Program
- 年間$99。**個人（Individual）登録なら24〜48時間**で審査完了。組織登録はD-U-N-S番号取得が必要で1〜2週間かかるため、特別な理由がなければ個人登録が無難

### 2024年以降の必須対応
- **Privacy Manifest（PrivacyInfo.xcprivacy）**: 2024年5月以降必須。追加するCapacitorプラグイン（カメラ・プッシュ通知・位置情報等）が自身のprivacy manifestを持っているか事前確認（未対応だとApp Store Connectのバリデーション段階で機械的に弾かれる）
- **ATT（App Tracking Transparency）**: 広告SDKやクロスアプリ計測を追加しない限り、本アプリでは基本的に不要
- **位置情報**: `When In Use`権限で十分（`Always`は不要）。`NSLocationWhenInUseUsageDescription`に「近くのタトゥーフレンドリー施設を表示するため」等、明確な理由を記載

### UGCアプリとしての必須要件（Guideline 1.2）— 本アプリは該当
ユーザー投稿（報告・コメント・写真）がある以上、以下が必須:
1. 投稿前の不適切コンテンツフィルタリング手段
2. **通報機能**（コメント・写真ごとに「報告」ボタン）
3. **悪質ユーザーのブロック機能**（投稿者単位で非表示にする程度でも可）
4. **公開された問い合わせ先**（サポートメール等）

→ これは日本法（プロバイダ責任制限法、現：情報流通プラットフォーム対処法。削除要請から概ね7日以内の対応が目安）への対応とも重なるため、**通報・訂正フローを一本化して実装すれば、Apple審査対策と法的リスク対策を同時に満たせる**。現状の`facility_requests`（修正報告）に加えて、reports（口コミ）への通報ボタンの追加を検討

### TestFlight
- 外部テスター最大10,000人。**最初のビルドのみ審査が必要**（平均半日程度、以降のビルドは数分〜数時間で承認されることが多い）。ビルドは90日で失効するのでリリース間隔に注意。公開リンクをLINEグループ等でシェアしてテスター募集可能

### App Store掲載のローカライズ
- **繁体中文(zh-TW)を最優先ロケール**として扱う（簡体字zh-CNとは別物、混在させない）
- 2025年半ばからスクリーンショットのキャプション文言も検索インデックス対象になったため、装飾ではなく実際のキーワードを含んだキャプションを書く
- 説明文・キーワードはロケールごとに個別入力が必要（デフォルトのままにしない）

---

## 台湾人観光客向け集客・プロダクト戦略

- **LINEが最重要チャネル。** LINE Taiwanが日本旅行向けAIアシスタント機能を展開中(2025〜2026)。トリップ計画がLINEグループで行われる実態に合わせ、「この施設をLINEでシェア」的な導線が低コストで効果的な可能性
- **Facebookグループ**は台湾→日本旅行の情報共有ハブとして依然強い。有料広告より先にこうしたコミュニティへの自然な浸透を狙う
- **小紅書(RedNote)は2025年12月から台湾でDNSブロック中(1年間)。** 台湾向けマーケティングとしては現状死んだチャネルなので投資しない
- **KKday/Klookとの提携が有望。** 台湾人の日本旅行における予約プラットフォームとして圧倒的シェア（大阪調査で42.1%）。本アプリのデータモデルには既にKKday/Klook/Agoda/Trip.comの予約リンク項目があるため、単なるリンク設置だけでなく、先方のアフィリエイト/コンテンツパートナープログラムへのアプローチも検討価値あり
- 競合: `tattoo-friendly.com`など日本国内向けタトゥーOK施設ディレクトリは複数存在するが、**繁体中文対応・UGC・アプリ化を同時に満たす競合は未確認**。差別化ポイントは引き続き有効
- **日本の名誉毀損リスクに注意。** 施設のタトゥーポリシーに関する事実言及（「入れない」等）は、口コミサイトが実際に訴訟対象になった前例がある。事実主張は裏取り（電話確認・掲示物の写真等）を推奨し、修正報告への対応を「概ね7日以内」等、明確な目安を持って運用する

---

## ASO（App Store最適化）基本方針
- タイトル30文字にブランド名+核となるキーワードを詰め込む。中国語・日本語は英語より文字あたりの情報密度が高いことを活かす
- サブタイトル・キーワード欄はタイトルと重複しない別のキーワードを追加（キーワード欄はユーザーには非表示なので繁体中文の検索語を惜しみなく詰める）
- スクリーンショットはロケールごとに画像自体を作り分け、実キーワードを含むキャプションを付ける（2025年以降スクリーンショット文言も検索インデックス対象）
- 初期のASO投資は4言語均等ではなく、**繁体中文（zh-TW）に集中**するのが差別化戦略と整合する
