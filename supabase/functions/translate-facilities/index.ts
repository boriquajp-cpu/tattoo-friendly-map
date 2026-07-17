// =============================================================================
// supabase/functions/translate-facilities/index.ts
// 施設名・住所の英語/韓国語翻訳 Edge Function（バッチ処理）
//
// - facility_translations テーブルをキャッシュとして使用し、同一 facility_id +
//   target_lang の組み合わせでは Claude API を再度呼び出さない。
// - 複数施設をまとめて1回の Claude 呼び出しで翻訳することで、
//   マップ・一覧画面のように多数の施設を同時に表示する場面でのレイテンシと
//   コストを抑える。
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  ko: 'Korean',
};

interface RequestBody {
  facilityIds: string[];
  targetLang: 'en' | 'ko';
}

interface TranslationResult {
  id: string;
  name: string;
  address: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { facilityIds, targetLang } = (await req.json()) as RequestBody;

    if (!Array.isArray(facilityIds) || facilityIds.length === 0 || !LANG_NAMES[targetLang]) {
      return new Response(JSON.stringify({ error: 'facilityIds and a valid targetLang are required' }), {
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
      .from('facility_translations')
      .select('facility_id, name, address')
      .in('facility_id', facilityIds)
      .eq('target_lang', targetLang);

    const translations: Record<string, { name: string; address: string }> = {};
    for (const row of cached ?? []) {
      translations[row.facility_id] = { name: row.name, address: row.address };
    }

    const missingIds = facilityIds.filter((id) => !translations[id]);

    // ------------------------------------------------------------------
    // 2. 未キャッシュ分を Claude で一括翻訳
    // ------------------------------------------------------------------
    if (missingIds.length > 0) {
      const { data: facilities } = await supabase
        .from('facilities')
        .select('id, name_ja, address_ja')
        .in('id', missingIds);

      if (facilities && facilities.length > 0) {
        const targetLangName = LANG_NAMES[targetLang];
        const inputPayload = facilities.map((f) => ({ id: f.id, name: f.name_ja, address: f.address_ja }));

        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content:
                  `Translate the "name" and "address" fields of each item below from Japanese into ${targetLangName}, ` +
                  `for a tourist-facing facility directory. Keep proper nouns natural (e.g. transliterate facility ` +
                  `names, translate address components like city/ward/prefecture). ` +
                  `Respond with ONLY a JSON array in the exact same order, each item shaped as ` +
                  `{"id": string, "name": string, "address": string}. No prose, no markdown fences.\n\n` +
                  JSON.stringify(inputPayload),
              },
            ],
          }),
        });

        if (anthropicRes.ok) {
          const anthropicData = await anthropicRes.json();
          const rawText: string = anthropicData.content?.[0]?.text?.trim() ?? '[]';
          try {
            const jsonText = rawText.replace(/^```json\s*|```$/g, '').trim();
            const parsed = JSON.parse(jsonText) as TranslationResult[];
            const upsertRows = parsed
              .filter((item) => item.id && item.name && item.address)
              .map((item) => ({
                facility_id: item.id,
                target_lang: targetLang,
                name: item.name,
                address: item.address,
              }));

            if (upsertRows.length > 0) {
              await supabase
                .from('facility_translations')
                .upsert(upsertRows, { onConflict: 'facility_id,target_lang' });
            }

            for (const row of upsertRows) {
              translations[row.facility_id] = { name: row.name, address: row.address };
            }
          } catch (parseErr) {
            console.error('Failed to parse translation JSON:', parseErr, rawText);
          }
        } else {
          console.error('Anthropic API error:', anthropicRes.status, await anthropicRes.text());
        }
      }
    }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('translate-facilities function failed:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
