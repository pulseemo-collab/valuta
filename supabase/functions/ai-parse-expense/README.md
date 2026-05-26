# ai-parse-expense — Supabase Edge Function

Parses natural-language Albanian expense text using OpenAI GPT-4o-mini.
The OpenAI key is stored as a Supabase project secret — never in the frontend.

## Deploy

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login and link to your project
supabase login
supabase link --project-ref <your-project-ref>

# 3. Set the OpenAI secret (never commit this)
supabase secrets set OPENAI_API_KEY=sk-...

# 4. Deploy the function
supabase functions deploy ai-parse-expense --no-verify-jwt
```

## Request format

```json
POST /functions/v1/ai-parse-expense
Authorization: Bearer <user-jwt>
Content-Type: application/json

{ "text": "kafe 150 lek" }
```

## Response format

```json
{
  "result": {
    "amount": 150,
    "currency": "ALL",
    "category": "ushqim",
    "note": "Kafe",
    "date": "2026-05-24",
    "confidence": 0.95
  }
}
```

## Error responses

| status | error field           | meaning                                |
|--------|-----------------------|----------------------------------------|
| 400    | `invalid_input`       | Text too short or missing              |
| 401    | `unauthorized`        | No Bearer token in request             |
| 422    | `parse_failed`        | OpenAI returned non-JSON               |
| 502    | `openai_error`        | OpenAI API returned an HTTP error      |
| 503    | `ai_not_configured`   | `OPENAI_API_KEY` secret not set        |
| 500    | `internal_error`      | Unexpected runtime error               |

The app-side `aiService.ts` handles all error cases and falls back to the local parser automatically.
