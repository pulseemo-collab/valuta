# Valuta — Deployment Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli` (or use `npx`)
- A Supabase project ([supabase.com](https://supabase.com))
- A Vercel account ([vercel.com](https://vercel.com)) for hosting

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → `anon` `public` key |

**Never commit `.env` to version control.** The `.gitignore` excludes it.

On Vercel, set these as Environment Variables in the project dashboard (Settings → Environment Variables). They must be set for Production, Preview, and Development environments.

---

## Local Development

```bash
npm install
npm run web          # start dev server on localhost:8081
```

## Type Checking

```bash
npm run type-check   # tsc --noEmit, must exit 0 before deploying
```

## Production Build

```bash
npm run build:web    # expo export --platform web → outputs to dist/
```

The `dist/` folder is a fully static site. Preview it locally:

```bash
npx serve dist
```

---

## Deploying to Vercel

### Option A — Vercel CLI (recommended)

```bash
npm install -g vercel
vercel login
vercel --prod
```

Vercel reads `vercel.json` automatically:
- **Build command**: `npx expo export --platform web`
- **Output directory**: `dist`
- **SPA rewrite**: all routes → `index.html` (client-side router handles navigation)

### Option B — Vercel Dashboard (import from Git)

1. Push the repo to GitHub/GitLab/Bitbucket (ensure `.env` is in `.gitignore`)
2. Go to [vercel.com/new](https://vercel.com/new) → Import repository
3. Vercel will detect `vercel.json` automatically
4. Add Environment Variables:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
5. Click **Deploy**

---

## Supabase Configuration

### Redirect URLs

For authentication to work correctly on the deployed domain, add your production URL to the Supabase allowlist:

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Add to **Redirect URLs**:
   ```
   https://your-domain.vercel.app/**
   https://valuta.al/**        (if using a custom domain)
   ```
3. Set **Site URL** to your production domain:
   ```
   https://your-domain.vercel.app
   ```

### Row Level Security (RLS)

Verify RLS is enabled on all tables before going live:

```sql
-- Run in Supabase SQL Editor to check
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables (`expenses`, `budgets`) must show `rowsecurity = true`.

### RLS Policies (required)

Ensure these policies exist on the `expenses` table:

```sql
-- Users can only read their own expenses
CREATE POLICY "Users can read own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own expenses
CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own expenses
CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = user_id);
```

Same pattern for `budgets`:

```sql
CREATE POLICY "Users can read own budget"
  ON budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own budget"
  ON budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget"
  ON budgets FOR UPDATE
  USING (auth.uid() = user_id);
```

---

## Custom Domain

1. In Vercel Dashboard → Project → Settings → Domains → Add domain
2. Follow DNS instructions (CNAME or A record)
3. Update Supabase redirect URLs to include the custom domain (see above)

---

## Brand Assets

All brand assets are pre-generated and committed to the repo:

| File | Size | Usage |
|---|---|---|
| `assets/favicon.png` | 64×64 | Browser tab icon |
| `assets/icon.png` | 1024×1024 | iOS + Android app icon |
| `assets/adaptive-icon.png` | 1024×1024 | Android adaptive icon foreground (transparent bg) |
| `assets/splash.png` | 1284×2778 | Mobile splash screen |

To regenerate assets (e.g. after a brand color change):

```bash
npm run generate-assets
```

The generator (`scripts/generate-assets.js`) uses only Node.js built-ins — no extra packages required.

---

## Production Checklist

- [ ] `.env` is not committed to git (check `.gitignore`)
- [ ] Environment variables are set in Vercel dashboard
- [ ] `npm run type-check` exits with 0 errors
- [ ] `npm run build:web` completes without errors
- [ ] Supabase Site URL matches production domain
- [ ] Supabase Redirect URLs include production domain
- [ ] RLS is enabled on `expenses` and `budgets` tables
- [ ] RLS policies are correctly scoped to `auth.uid() = user_id`
- [ ] Direct URL navigation works (Vercel SPA rewrite is active)
- [ ] Login, signup, and logout work on production domain
- [ ] `assets/favicon.png` exists (run `npm run generate-assets` if missing)
- [ ] App title shows "Valuta" in browser tab
- [ ] No real credentials in `.env.example` or any committed file

---

## Routing on Web

Valuta uses Expo Router's client-side navigation. The `vercel.json` rewrites all paths to `index.html` so that:

- Direct navigation to `/login`, `/onboarding`, etc. works
- Browser refresh at any route works
- The auth guard in `app/_layout.tsx` handles redirecting to the right screen

---

## Troubleshooting

**Build fails with "EXPO_PUBLIC_SUPABASE_URL is missing"**
→ Set environment variables in Vercel before building, or in `.env` for local builds.

**App shows blank page after deploy**
→ Check browser console for JS errors. Most commonly a missing env var or a Supabase URL mismatch.

**Authentication redirects loop after login**
→ Check that Supabase Site URL is set to the correct production domain (not localhost).

**"Failed to fetch" errors in production**
→ The Supabase URL or anon key is wrong. Re-verify from Supabase Dashboard → Settings → API.
