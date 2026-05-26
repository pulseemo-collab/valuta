// Supabase Edge Function — ai-parse-expense
// Deno runtime. OpenAI key is stored as a Supabase secret:
//   supabase secrets set OPENAI_API_KEY=sk-...
// Never expose this key in the frontend.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_CATEGORIES = [
  'ushqim', 'transport', 'faturat', 'shopping',
  'shendet', 'argetime', 'biznes', 'tjera',
] as const;

const VALID_CURRENCIES = ['ALL', 'EUR', 'USD'] as const;

type ValidCategory = typeof VALID_CATEGORIES[number];
type ValidCurrency = typeof VALID_CURRENCIES[number];

function isValidCategory(v: unknown): v is ValidCategory {
  return VALID_CATEGORIES.includes(v as ValidCategory);
}
function isValidCurrency(v: unknown): v is ValidCurrency {
  return VALID_CURRENCIES.includes(v as ValidCurrency);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // Require Authorization header — Supabase injects the user JWT automatically
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const body = await req.json() as { text?: unknown };
    const text = body.text;

    if (typeof text !== 'string' || text.trim().length < 2) {
      return json({ error: 'invalid_input' }, 400);
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      // AI not configured — return a clear signal so the app falls back to local parser
      return json({ error: 'ai_not_configured' }, 503);
    }

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `You are an expense parser for Albanian users of Valuta, a personal finance app.
Today is ${today}. Parse the user's natural language Albanian expense description.
Return ONLY a JSON object — no extra text, no markdown fences:
{
  "amount": <positive number or null>,
  "currency": <"ALL" | "EUR" | "USD">,
  "category": <"ushqim" | "transport" | "faturat" | "shopping" | "shendet" | "argetime" | "biznes" | "tjera">,
  "note": <short cleaned description, max 80 chars>,
  "date": <"YYYY-MM-DD", today or a past date>,
  "confidence": <0.0 to 1.0>
}
Rules:
- "ALL" (Albanian Lek) is the default currency unless the user specifies otherwise.
- "ushqim" covers food, drinks, cafes, restaurants, groceries.
- "argetime" covers Netflix, Spotify, cinema, subscriptions, entertainment.
- "faturat" covers bills, rent, utilities, insurance, bank payments.
- Use "tjera" when the category is unclear.
- Set confidence high (>0.8) when the input is unambiguous.
Examples:
"kafe 150" → {"amount":150,"currency":"ALL","category":"ushqim","note":"Kafe","date":"${today}","confidence":0.95}
"Netflix 15 euro dje" → {"amount":15,"currency":"EUR","category":"argetime","note":"Netflix","date":"<yesterday>","confidence":0.98}`;

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 180,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text.trim() },
        ],
      }),
      signal: AbortSignal.timeout(7000),
    });

    if (!openaiResp.ok) {
      const errText = await openaiResp.text().catch(() => '');
      console.error('[ai-parse-expense] OpenAI error:', openaiResp.status, errText.slice(0, 300));
      return json({ error: 'openai_error' }, 502);
    }

    const completion = await openaiResp.json() as {
      choices?: { message: { content: string } }[];
    };

    const raw = completion.choices?.[0]?.message?.content ?? '';

    // Strip possible markdown code fences that models sometimes add
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[ai-parse-expense] JSON parse failed. Raw:', raw.slice(0, 200));
      return json({ error: 'parse_failed' }, 422);
    }

    // Sanitize and validate each field before returning
    const amount =
      typeof parsed.amount === 'number' && parsed.amount > 0 && isFinite(parsed.amount)
        ? Math.round(parsed.amount * 100) / 100
        : null;

    const currency: ValidCurrency = isValidCurrency(parsed.currency) ? parsed.currency : 'ALL';
    const category: ValidCategory = isValidCategory(parsed.category) ? parsed.category : 'tjera';
    const note = typeof parsed.note === 'string' ? parsed.note.slice(0, 120).trim() : '';
    const date =
      typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
        ? parsed.date
        : today;
    const confidence =
      typeof parsed.confidence === 'number'
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.7;

    return json({ result: { amount, currency, category, note, date, confidence } });

  } catch (err) {
    console.error('[ai-parse-expense] Unexpected error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});
