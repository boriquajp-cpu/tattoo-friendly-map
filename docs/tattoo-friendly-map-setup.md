# タトゥーフレンドリー施設マップアプリ - 準備資料

最終更新: 2026-07-09

## 1. プロジェクト概要

- **目的**: タトゥーがある人が日本国内で入れる施設(温泉・銭湯・ジム・プール・屋外)を探せる地図アプリ
- **メインターゲット**: 台湾人観光客
- **差別化ポイント**: 繁体中文対応、幅広い施設カテゴリ、クラウドソーシングによる詳細な条件情報

## 2. 技術スタック

| 領域 | 選定技術 | 理由 |
|---|---|---|
| フロントエンド | React + Mapbox GL JS | 地図のカスタムピン表示に柔軟に対応 |
| バックエンド/DB | Supabase (PostgreSQL) | 認証・DB・ストレージが一体型、個人開発向き |
| 多言語UI | react-i18next | 繁体中文/日本語/英語のUI切り替え |
| 翻訳(自由記述のみ) | Claude API | 選択式項目は翻訳不要、自由記述コメントのみ翻訳しキャッシュ |
| ホスティング | Vercel（予定） | 実装フェーズで決定 |

## 3. データベース設計

### facilities(施設マスタ)
- id, category(onsen/gym_pool/outdoor)
- name_ja, name_zh_tw
- address_ja, address_zh_tw, lat, lng
- phone, official_url, business_hours
- booking_url_klook, booking_url_kkday (日帰りチケット向け)
- booking_url_agoda, booking_url_trip_com (宿泊施設向け)
- created_at

### reports(ユーザー報告)
- id, facility_id, user_id, visit_date
- result(admitted/admitted_with_sticker/admitted_with_cover/denied/not_asked)
- tattoo_size(small/medium/large/multiple)
- tattoo_location(array: arm/leg/back/chest_stomach/neck_face/other)
- facility_response(nothing_asked/verbal_check/written_agreement/private_bath_offered/other_condition)
- comment_original, comment_lang(ja/zh_tw/en/unknown)
- photo_url, created_at, flagged

### report_translations(自由記述の翻訳キャッシュ)
- report_id, target_lang, translated_text, translated_at

### users
- id, email, preferred_lang, created_at

### facility_stats(集計結果キャッシュ)
- facility_id, summary_label(high/conditional/mixed/low/no_data)
- confidence_level(high/medium/low)
- report_count_12mo, top_condition_text, last_updated

## 4. 集計ロジック

1. 直近12ヶ月の報告のみ対象(重み付け: 直近3ヶ月=3, 4-6ヶ月=2, 7-12ヶ月=1)
2. 「入れた系」の割合でラベル決定: 90%以上=ほぼ確実/50-90%=条件付き/10-50%=施設による/10%未満=断られやすい/0件=情報なし
3. 件数による信頼度: 5件以上=高、2-4件=中、1件=低
4. 「聞かれなかった」は許可レベル集計から除外、別枠で件数のみ表示

## 5. 画面構成(MVP)

1. マップ画面(メイン) - カテゴリフィルター、許可レベルのピン色分け
2. 施設一覧画面(リスト)
3. 施設詳細画面 - 集計結果、報告一覧、予約リンク、投稿ボタン
4. 報告投稿画面 - 選択式中心、自由記述は任意
5. ログイン/会員登録 - メール認証(+検討: Google/LINE)
6. マイページ - 投稿履歴、お気に入り

## 6. リスク対応方針

- **施設側からの訂正申請**: 運営が手動で確認・修正。営業日3日以内に一次返信を目安
- **利用規約**: 「情報の正確性は保証しない」「訪問前に施設へ確認を」を日本語・繁体中文の両方で明記。正式ローンチ前に弁護士チェックを入れる
- **写真モデレーション**: 「施設外観・シールのみ」ガイドライン明示、不適切コンテンツの自動検出を検討
- **B2B有料掲載との利益相反**: 将来的な有料掲載は表示順位・デザインのみに影響、報告データの集計結果には影響させない

## 7. シードデータ収集方針

- **方法**: AIで公式サイト一次スクレイニング → 人力で原文と突き合わせて検証
- **対象エリア(第一弾)**: 東京・大阪・京都などの主要観光地 + 箱根・別府など台湾人に人気の温泉地
- **注意**: スクレイニング対象は公式サイト・公式SNSのみ(個人ブログ・口コミサイトは対象外)

## 8. リポジトリ構成

```
tattoo-friendly-map/
├── README.md
├── docs/
│   └── tattoo-friendly-map-setup.md  (このファイル)
├── src/
│   ├── components/
│   │   ├── Map/
│   │   ├── FacilityCard/
│   │   ├── ReportForm/
│   │   ├── FacilityDetail/
│   │   └── Layout/
│   ├── pages/
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── claudeApi.ts
│   ├── locales/
│   │   ├── ja.json
│   │   ├── zh-TW.json
│   │   └── en.json
│   └── types/
│       └── index.ts
├── supabase/
│   └── migrations/
├── scripts/
│   └── seed-scraper/
├── .env.example
└── package.json
```
