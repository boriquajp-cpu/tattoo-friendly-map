// =============================================================================
// supabase/functions/translate-facilities/index.ts
// 施設名・住所の英語/韓国語翻訳 Edge Function（バッチ処理）
//
// - facility_translations テーブルをキャッシュとして使用し、同一 facility_id +
//   target_lang の組み合わせでは Claude API を再度呼び出さない。
// - 未キャッシュ分は CHUNK_SIZE 件ずつに分割して Claude に投げる。1回の呼び出しに
//   全件（施設数が多いと数百件）をまとめると max_tokens を超えて出力が途中で
//   切れ、JSON パースが丸ごと失敗してキャッシュにも保存されないまま毎回同じ
//   巨大リクエストを繰り返す不具合があったため、チャンク単位で成功/失敗を
//   分離できるようにしている。
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

// 1回の Claude 呼び出しに含める施設数。20件程度なら出力が max_tokens を
// 超えるリスクがほぼなく、かつチャンク数を抑えてレイテンシも許容範囲に収まる。
const CHUNK_SIZE = 20;
// 同時に投げるチャンク数（Anthropic API のレート制限を考慮した緩めの上限）
const CONCURRENCY = 4;

interface RequestBody {
  facilityIds: string[];
  targetLang: 'en' | 'ko';
}

interface TranslationResult {
  id: string;
  name: string;
  address: string;
}

interface FacilityRow {
  id: string;
  name_ja: string;
  address_ja: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function translateChunk(
  facilities: FacilityRow[],
  targetLangName: string,
): Promise<TranslationResult[]> {
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
      max_tokens: 2048,
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

  if (!anthropicRes.ok) {
    console.error('Anthropic API error:', anthropicRes.status, await anthropicRes.text());
    return [];
  }

  const anthropicData = await anthropicRes.json();
  const rawText: string = anthropicData.content?.[0]?.text?.trim() ?? '[]';
  try {
    const jsonText = rawText.replace(/^```json\s*|```$/g, '').trim();
    const parsed = JSON.parse(jsonText) as TranslationResult[];
    return parsed.filter((item) => item.id && item.name && item.address);
  } catch (parseErr) {
    console.error('Failed to parse translation JSON for chunk:', parseErr, rawText);
    return [];
  }
}

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
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
    // 2. 未キャッシュ分をチャンクに分けて Claude で翻訳
    // ------------------------------------------------------------------
    if (missingIds.length > 0) {
      const { data: facilities } = await supabase
        .from('facilities')
        .select('id, name_ja, address_ja')
        .in('id', missingIds);

      if (facilities && facilities.length > 0) {
        const targetLangName = LANG_NAMES[targetLang];
        const chunks = chunk(facilities as FacilityRow[], CHUNK_SIZE);

        const chunkResults = await runWithConcurrency(chunks, CONCURRENCY, (c) => translateChunk(c, targetLangName));

        const upsertRows = chunkResults.flat().map((item) => ({
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
