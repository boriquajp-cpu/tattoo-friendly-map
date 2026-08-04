/**
 * tattoo-friendly-map — 施設向けタトゥーポリシー・アンケート フォーム生成スクリプト
 *
 * 使い方:
 *   1. https://script.google.com/ で新規プロジェクトを作成し、このファイルの中身を貼り付ける。
 *   2. 左メニュー「プロジェクトの設定」→「スクリプト プロパティ」に以下を追加する
 *        SUPABASE_URL              : https://xxxxxxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY : Supabaseダッシュボード > Settings > API の service_role キー
 *      （このキーはフロントエンドに絶対に置かないこと。GASのプロパティはこのスクリプト実行者以外には見えない）
 *   3. 関数選択プルダウンで `buildForm` を選び、実行する（初回はGoogleアカウントの権限承認が必要）。
 *      実行ログに生成されたフォームの編集URL・公開URLが出力される。
 *   4. 続けて `installTrigger` を実行する（フォーム回答が来るたびに onFormSubmit が自動実行されるようにする）。
 *   5. 生成された公開URL（フォームURL）を、35件の送付先メール本文に貼り付けて送信する。
 *
 * 設計方針:
 *   - フォーム回答は Google スプレッドシートにも自動保存されるが、それとは別に
 *     onFormSubmit トリガーで Supabase の `official_facility_responses` テーブルへ直接 INSERT する。
 *   - 同テーブルへの INSERT は RLS 上 service_role のみ許可されているため、Script Properties に
 *     保存した service_role キーで REST 経由アクセスする（このスクリプト自体はGoogle側でのみ実行され、
 *     一般公開されるのはフォーム画面のみなのでキーが外部に漏れることはない）。
 *   - フォーム回答はあくまで「未承認の一次情報」として溜まるだけで、facilities テーブルへの反映は
 *     管理画面（/admin）での人力承認を経てから行われる（migration 011 のポリシー通り）。
 */

// ─────────────────────────────────────────
// CONFIG — 実スキーマ（supabase/migrations/011_create_official_facility_responses.sql）と一致させること
// ─────────────────────────────────────────
const CONFIG = {
  formTitle: 'タトゥーがあるお客様のご利用について（アンケート）',
  formDescription:
    'いつもお世話になっております。「Tattoo Map Japan」というタトゥーフレンドリーな施設を探すサービスを運営しております。\n' +
    '貴施設における、タトゥーのあるお客様のご利用可否について教えていただけますと幸いです。\n' +
    '所要時間は1〜2分程度です。回答内容は担当者が内容を確認したうえで掲載いたします（勝手に即時公開されることはありません）。\n' +
    'Googleアカウントへのログインは不要です。',

  // facilities.category と一致する3値。フォーム上は日本語ラベルで表示し、回答時にこのマップで enum へ変換する。
  categoryLabelToEnum: {
    '温泉・銭湯（スパ含む）': 'onsen',
    'ジム・プール': 'gym_pool',
    '屋外施設（キャンプ場・ウォーターパーク等）': 'outdoor',
  },

  // official_tattoo_policy enum と一致させる。ラベルの並び順がそのまま分岐条件になる。
  policyLabelToEnum: {
    '制限なくご利用いただけます': 'allowed',
    '条件付きでご利用いただけます': 'conditional',
    '貸切風呂・客室風呂・個室のみご利用いただけます': 'private_only',
    'ご利用をお断りしています': 'not_allowed',
  },

  // conditions は text[] にそのまま格納する自由記述寄りの選択式（複数選択可 + その他）
  conditionChoices: [
    'シールで隠していただければ利用可能',
    'テーピング等で隠していただければ利用可能',
    '小さいサイズ（手のひら程度まで）のみ利用可能',
    '事前にご連絡・申告いただければ利用可能',
    '個室・貸切での利用に限り可能',
  ],

  wantsListedLabelToBool: {
    'はい、掲載してほしい': true,
    'いいえ、掲載しないでほしい': false,
  },
};

// ─────────────────────────────────────────
// フォーム生成
// ─────────────────────────────────────────
function buildForm() {
  const form = FormApp.create(CONFIG.formTitle)
    .setDescription(CONFIG.formDescription)
    .setCollectEmail(false)
    .setRequireLogin(false)
    .setLimitOneResponsePerUser(false)
    .setProgressBar(true);

  // ページ1: 基本情報
  form.addSectionHeaderItem().setTitle('施設情報');

  form.addTextItem()
    .setTitle('施設名')
    .setRequired(true);

  form.addTextItem()
    .setTitle('住所')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('施設の種別')
    .setChoiceValues(Object.keys(CONFIG.categoryLabelToEnum))
    .setRequired(true);

  // ページ2: ポリシー（選択によって分岐）
  const policyPageBreak = form.addPageBreakItem().setTitle('タトゥーのあるお客様のご利用について');
  const policyItem = form.addMultipleChoiceItem().setTitle('タトゥーのあるお客様は現在どのようにご案内していますか？').setRequired(true);

  // ページ3: 条件詳細（「条件付きで利用可能」を選んだ場合のみ表示）
  const conditionsPage = form.addPageBreakItem().setTitle('利用条件の詳細');
  form.addCheckboxItem()
    .setTitle('該当する条件をすべて選択してください（複数選択可）')
    .setChoiceValues(CONFIG.conditionChoices);
  form.addParagraphTextItem()
    .setTitle('その他の条件・補足（自由記述、任意）');

  // ページ4: 案内文・任意情報（全員が到達）
  const finalPage = form.addPageBreakItem().setTitle('掲載内容の確認');
  form.addParagraphTextItem()
    .setTitle('サイト上に掲載する案内文（任意）')
    .setHelpText('例：「刺青が見えないようにシールをお貼りいただければご利用いただけます」など。空欄の場合は上記の選択内容のみ掲載します。');
  form.addTextItem()
    .setTitle('このアンケートに関する公式ページURL（任意）')
    .setHelpText('タトゥーに関する案内が載っている貴施設サイトのページがあれば教えてください。');
  form.addMultipleChoiceItem()
    .setTitle('この情報をTattoo Map Japanに掲載してよろしいですか？')
    .setChoiceValues(Object.keys(CONFIG.wantsListedLabelToBool))
    .setRequired(true);
  form.addTextItem()
    .setTitle('ご担当者名（任意・確認連絡用、サイトには非公開）');
  form.addTextItem()
    .setTitle('確認用メールアドレス（任意・サイトには非公開）');

  // 分岐設定: 「条件付き」→ 条件詳細ページ、それ以外 → 案内文ページへ直接ジャンプ
  const choices = Object.keys(CONFIG.policyLabelToEnum).map((label) => {
    if (CONFIG.policyLabelToEnum[label] === 'conditional') {
      return policyItem.createChoice(label, conditionsPage);
    }
    return policyItem.createChoice(label, finalPage);
  });
  policyItem.setChoices(choices);
  conditionsPage.setGoToPage(finalPage);
  void policyPageBreak;

  Logger.log('Form edit URL: %s', form.getEditUrl());
  Logger.log('Form publish URL: %s', form.getPublishedUrl());
  Logger.log('Linked spreadsheet: %s', form.getDestinationId() || '(未リンク。実行後にGoogle側で自動作成されます)');
  return form;
}

// ─────────────────────────────────────────
// 送信トリガー登録（buildForm実行後に一度だけ実行する）
// ─────────────────────────────────────────
function installTrigger() {
  const form = FormApp.getActiveForm ? FormApp.getActiveForm() : null;
  const targetForm = form || getFormBySearchingRecent_();
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(targetForm)
    .onFormSubmit()
    .create();
  Logger.log('Trigger installed for form: %s', targetForm.getId());
}

function getFormBySearchingRecent_() {
  const files = DriveApp.getFilesByType(MimeType.GOOGLE_FORMS);
  if (files.hasNext()) {
    return FormApp.openById(files.next().getId());
  }
  throw new Error('フォームが見つかりません。先に buildForm() を実行してください。');
}

// ─────────────────────────────────────────
// フォーム回答 → Supabase official_facility_responses への取り込み
// ─────────────────────────────────────────
function onFormSubmit(e) {
  const itemResponses = e.response.getItemResponses();
  const answers = {};
  for (const itemResponse of itemResponses) {
    answers[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  }

  const categoryLabel = answers['施設の種別'];
  const policyLabel = answers['タトゥーのあるお客様は現在どのようにご案内していますか？'];
  const conditionChoices = answers['該当する条件をすべて選択してください（複数選択可）'] || [];
  const conditionsOther = answers['その他の条件・補足（自由記述、任意）'];
  const wantsListedLabel = answers['この情報をTattoo Map Japanに掲載してよろしいですか？'];

  const conditions = Array.isArray(conditionChoices) ? conditionChoices.slice() : [];
  if (conditionsOther) conditions.push(conditionsOther);

  const payload = {
    submitted_name_ja: answers['施設名'] || '',
    submitted_address_ja: answers['住所'] || '',
    category: CONFIG.categoryLabelToEnum[categoryLabel] || null,
    policy: CONFIG.policyLabelToEnum[policyLabel] || null,
    conditions: conditions,
    guidance_text: answers['サイト上に掲載する案内文（任意）'] || null,
    official_url: answers['このアンケートに関する公式ページURL（任意）'] || null,
    wants_listed: CONFIG.wantsListedLabelToBool[wantsListedLabel] !== undefined
      ? CONFIG.wantsListedLabelToBool[wantsListedLabel]
      : true,
    respondent_name: answers['ご担当者名（任意・確認連絡用、サイトには非公開）'] || null,
    respondent_email: answers['確認用メールアドレス（任意・サイトには非公開）'] || null,
  };

  if (!payload.category || !payload.policy) {
    Logger.log('スキップ: category/policy が想定ラベルと一致しませんでした: %s / %s', categoryLabel, policyLabel);
    return;
  }

  const props = PropertiesService.getScriptProperties();
  const supabaseUrl = props.getProperty('SUPABASE_URL');
  const serviceRoleKey = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が Script Properties に設定されていません。');
  }

  const response = UrlFetchApp.fetch(`${supabaseUrl}/rest/v1/official_facility_responses`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'return=minimal',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  if (status >= 300) {
    Logger.log('Supabase insert failed (%s): %s', status, response.getContentText());
  } else {
    Logger.log('Supabase insert OK: %s', payload.submitted_name_ja);
  }
}
