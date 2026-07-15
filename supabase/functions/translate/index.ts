// =============================================================================
// supabase/functions/translate/index.ts
// 報告コメントの翻訳 Edge Function
//
// - report_translations テーブルをキャッシュとして使用し、同一 report_id +
//   target_lang の組み合わせでは Claude API を再度呼び出さない。
// - Anthropic API キーはこの Edge Function 内（サーバーサイド）でのみ使用し、
//   ブラウザには一切露出させない。
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LANG_NAMES: Record<string, string> = {
  ja: 'Japanese',
  zh_tw: 'Traditional Chinese (Taiwan)',
  en: 'English',
  ko: 'Korean',
};

interface RequestBody {
  reportId: string;
  targetLang: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { reportId, targetLang } = (await req.json()) as RequestBody;

    if (!reportId || !targetLang) {
      return new Response(JSON.stringify({ error: 'reportId and targetLang are required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ------------------------------------------------------------------
    // 1. キャッシュ確認
    // ------------------------------------------------------------------
    const { data: cached } = await supabase
      .from('report_translations')
      .select('translated_text')
      .eq('report_id', reportId)
      .eq('target_lang', targetLang)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify({ translated: cached.translated_text, cached: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ------------------------------------------------------------------
    // 2. 元コメント取得
    // ------------------------------------------------------------------
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('comment_original, comment_lang')
      .eq('id', reportId)
      .single();

    if (reportError || !report?.comment_original) {
      return new Response(JSON.stringify({ error: 'Report or comment not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const sourceLang = report.comment_lang ?? 'unknown';
    const original = report.comment_original as string;

    // 原文言語と翻訳先が同じ場合は翻訳不要
    if (sourceLang === targetLang) {
      return new Response(JSON.stringify({ translated: original, cached: false }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ------------------------------------------------------------------
    // 3. Claude API で翻訳
    // ------------------------------------------------------------------
    const targetLangName = LANG_NAMES[targetLang] ?? targetLang;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content:
              `Translate the following user review comment into ${targetLangName}. ` +
              `Only output the translated text, with no preamble or explanation.\n\n${original}`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errText);
      // 翻訳失敗時は原文をフォールバックとして返す
      return new Response(JSON.stringify({ translated: original, cached: false, fallback: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const anthropicData = await anthropicRes.json();
    const translated: string = anthropicData.content?.[0]?.text?.trim() ?? original;

    // ------------------------------------------------------------------
    // 4. キャッシュに保存
    // ------------------------------------------------------------------
    await supabase
      .from('report_translations')
      .upsert(
        { report_id: reportId, target_lang: targetLang, translated_text: translated },
        { onConflict: 'report_id,target_lang' },
      );

    return new Response(JSON.stringify({ translated, cached: false }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('translate function failed:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
