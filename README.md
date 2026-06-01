# VinylVault 🎵

> Album catalogue manager with automated eBay listing and AI-powered pricing.

---

## What It Does

VinylVault lets you:
1. **Import** your vinyl catalogue via CSV or manual entry
2. **Auto-price** albums using live Discogs sales history and eBay comparable listings
3. **List** albums directly to your eBay seller account in one click
4. **Track** inventory status and sales in a unified dashboard

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend/Database:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **Deployment:** Vercel
- **APIs:** Discogs API, eBay Browse API, eBay Trading API

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account and project
- A [Discogs](https://www.discogs.com/settings/developers) developer account + personal token
- An [eBay Developer](https://developer.ebay.com/) account with a sandbox and production app

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Discogs (server-side only — users supply their own token via Settings)
DISCOGS_USER_AGENT=VinylVault/1.0

# eBay
EBAY_CLIENT_ID=your-ebay-client-id
EBAY_CLIENT_SECRET=your-ebay-client-secret
EBAY_REDIRECT_URI=https://your-domain.com/api/ebay/callback
EBAY_ENVIRONMENT=production  # or sandbox

# Encryption key for storing eBay tokens
TOKEN_ENCRYPTION_KEY=32-char-random-string-here
```

---

## Current Build Status

- **Auth + Catalog + CSV import + Photo upload:** fully wired against Supabase.
- **Pricing (Discogs):** live — fetches condition-graded suggestions via the `/marketplace/price_suggestions` and `/marketplace/stats` endpoints, with smart catalog-#/artist/title normalization and a 24h cache.
- **Pricing (eBay):** live — uses the Browse API (`client_credentials` app token, no user OAuth) as a fallback when Discogs has no match. Sandbox returns very few real listings; production credentials return real comparables.
- **eBay listing OAuth:** sandbox-ready. Set `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`/`EBAY_RU_NAME`. Leaving `EBAY_CLIENT_ID` blank enables a stub OAuth flow for UI testing.
- **eBay listing creation:** stubbed — `/api/ebay/list` returns a fake listing ID and stores the album as listed. Replace with Trading API `AddFixedPriceItem` when ready.

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/your-org/vinylvault.git
cd vinylvault

# 2. Install dependencies
npm install

# 3. Set up environment variables (see above)
cp .env.example .env.local

# 4. Run Supabase migrations
npx supabase db push

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database Setup (Supabase)

All migrations live in `supabase/migrations/`. The schema creates:

- `albums` — your catalogue
- `pricing_cache` — cached Discogs/eBay price data (24h TTL)
- `ebay_credentials` — encrypted OAuth tokens per user

Run migrations:
```bash
npx supabase db push
# or apply manually via the Supabase dashboard SQL editor
```

**Row Level Security (RLS) is enforced on all tables** — users can only see their own data.

---

## CSV Import Format

VinylVault accepts CSVs with the following columns (header row optional; column order flexible):

| Column | Required | Description |
|--------|----------|-------------|
| `album_title` | ✅ | Album name |
| `artist` | ✅ | Artist/band name |
| `genre` | ✅ | Music genre |
| `condition` | ✅ | `Mint`, `Great`, `Good`, `Fair`, or `Poor` |
| `catalog_number` | ✅ | Label catalog number (used for Discogs matching) |
| `notes` | ❌ | Internal notes |
| `purchase_price` | ❌ | What you paid (for P&L tracking) |

**Example row:**
```
Buzz Buzz Buzz,The Hollywood Flames,Doo Wop,Great,SP 2166
```

---

## eBay Setup

1. Go to **Settings → eBay Account** in VinylVault
2. Click **Connect eBay Account**
3. Authorize VinylVault in the eBay OAuth flow
4. Select your default shipping profile from the dropdown

VinylVault will automatically map genres to eBay music category IDs. You can override the category per album.

---

## Discogs Setup

1. Log in to [discogs.com](https://www.discogs.com)
2. Go to **Settings → Developers → Generate new token**
3. Paste the token into **VinylVault → Settings → Discogs API Key**

VinylVault uses this token to search the Discogs marketplace and fetch recent sale prices.

---

## Pricing Engine

The auto-price algorithm:

```
suggested_price = median(discogs_recent_sales, ebay_sold_prices) × condition_multiplier
```

**Condition multipliers:**

| Condition | Multiplier |
|-----------|-----------|
| Mint / Sealed | 1.30× |
| Great | 1.00× |
| Good | 0.75× |
| Fair | 0.50× |
| Poor | 0.25× |

You can always override the suggested price before listing. A global **minimum floor price** (default: $3.00) can be set in Settings.

---

## Project Structure

```
vinylvault/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login, signup, reset password
│   ├── dashboard/          # Main dashboard
│   ├── albums/             # Catalogue table + detail pages
│   ├── import/             # CSV import flow
│   ├── settings/           # eBay, Discogs, preferences
│   └── api/                # API routes
│       ├── ebay/           # OAuth callback, listing CRUD
│       ├── discogs/        # Price fetch
│       └── pricing/        # Auto-price engine
├── components/             # Shared UI components
├── lib/                    # Supabase client, API helpers, utils
├── supabase/
│   └── migrations/         # SQL migrations
└── public/
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/albums/import` | POST | Parse and import CSV |
| `/api/pricing/fetch` | POST | Fetch Discogs + eBay prices for an album |
| `/api/pricing/bulk` | POST | Batch price fetch for multiple albums |
| `/api/ebay/connect` | GET | Initiate eBay OAuth |
| `/api/ebay/callback` | GET | eBay OAuth callback |
| `/api/ebay/list` | POST | Create eBay listing |
| `/api/ebay/revise` | PATCH | Update eBay listing |
| `/api/ebay/end` | DELETE | End eBay listing |
| `/api/ebay/sync` | POST | Poll for sold status |

---

## Rate Limits

| API | Limit | Strategy |
|-----|-------|----------|
| Discogs | 60 req/min | Queue with 1s delay between requests |
| eBay Browse | 5,000 req/day | Cache results 24h |
| eBay Trading | 5,000 calls/day | Only on user-triggered actions |

---

## Deploy to Vercel

VinylVault is configured for one-click Vercel deployment. The repo includes a `vercel.json` that pins the build/install commands, picks the `iad1` (US East) region, and raises the serverless function timeout to 60s for the pricing/import routes (the default 10s isn't enough for sequential Discogs calls with rate limiting).

### Step-by-step

1. **Push to GitHub** (already done if you're reading this in the repo).

2. **Import the project on Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Pick this repo
   - Framework preset auto-detects as **Next.js** — leave the defaults

3. **Set environment variables** (Vercel → Project → Settings → Environment Variables)

   **Required:**
   | Variable | Where to get it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_APP_URL` | Your Vercel URL, e.g. `https://your-app.vercel.app` |

   **Recommended (pricing):**
   | Variable | Where to get it |
   |---|---|
   | `DISCOGS_PERSONAL_ACCESS_TOKEN` | [discogs.com/settings/developers](https://www.discogs.com/settings/developers) — "Generate new token" |
   | `DISCOGS_USER_AGENT` | Any string, e.g. `VinylVault/1.0` |

   **Optional (eBay):**
   | Variable | Where to get it |
   |---|---|
   | `EBAY_CLIENT_ID` | [developer.ebay.com/my/keys](https://developer.ebay.com/my/keys) (use **Production** keys for real data) |
   | `EBAY_CLIENT_SECRET` | Same keyset |
   | `EBAY_RU_NAME` | Same keyset → "User Tokens" tab |
   | `EBAY_REDIRECT_URI` | `https://your-app.vercel.app/api/ebay/callback` |
   | `EBAY_ENVIRONMENT` | `sandbox` or `production` |
   | `TOKEN_ENCRYPTION_KEY` | Run `openssl rand -base64 32 \| head -c 32` |

   Apply all three environments (**Production**, **Preview**, **Development**) unless you have a reason not to.

4. **Deploy** — click **Deploy**. Vercel builds + deploys; takes ~90s.

5. **Update Supabase Auth redirects** so the production callback works:
   - Supabase → **Authentication** → **URL Configuration**
   - Set **Site URL** to `https://your-app.vercel.app`
   - Add `https://your-app.vercel.app/**` under **Redirect URLs**

6. **Run database migrations** against your Supabase project if you haven't:
   - Open the Supabase SQL editor and paste each file in `supabase/migrations/` in order (`001_initial.sql`, `002_album_photos_public.sql`, `003_pricing_cache_unique.sql`).

7. **(If using real eBay OAuth)** Update the eBay Developer portal:
   - Go to [developer.ebay.com/my/keys](https://developer.ebay.com/my/keys) → your keyset → **User Tokens**
   - Set the **auth-accepted URL** to `https://your-app.vercel.app/api/ebay/callback`
   - Copy the resulting RuName into `EBAY_RU_NAME`

### CLI alternative

```bash
npm i -g vercel
vercel             # first run: link the project
vercel env add     # add each env var interactively
vercel --prod      # deploy production
```

### Function configuration

`vercel.json` raises timeouts for the long-running routes:

| Route | maxDuration | Why |
|---|---|---|
| `/api/pricing/fetch` | 60s | Up to 12 sequential Discogs API calls × 1.1s rate limit + eBay fallback |
| `/api/pricing/bulk` | 60s | Sequential pricing — server caps at 15 albums/request, client auto-chunks larger selections |
| `/api/albums/import` | 60s | CSV imports of large catalogs |
| `/api/ebay/list`, `/api/ebay/callback`, `/api/ebay/sync` | 30s | Network-bound eBay API calls |

On Vercel **Hobby** plans, 60s is the maximum function duration. If you need longer (e.g. bulk pricing 100+ albums in one shot), upgrade to **Pro** which allows up to 300s and adjust `maxDuration` accordingly.

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit changes: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feat/my-feature`
5. Open a pull request

Please follow the existing code style (ESLint + Prettier config included).

---

## License

MIT — see [LICENSE](LICENSE) for details.
