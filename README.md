# VinylVault

Album catalogue manager for vinyl sellers — import your inventory, auto-price from Discogs and eBay, list to marketplaces, track sales, and collaborate with others on a shared collection.

---

## Features

### Catalogue & import
- **CSV import** with flexible columns, server-side validation, and condition normalization
- **Box JSON import** — drop priced `BOX_*_priced.json` files from bulk analysis workflows
- **Manual add** via drawer UI; bulk delete, filter, and sort (including by price)
- **Album photos** — upload JPEG/PNG/WebP/HEIC/HEIF; batch attach covers to titles with AI matching (OCR + Discogs/eBay visual compare)
- **Catalogue table** with cover thumbnails, status badges, and selection for bulk actions

### Pricing
- **Discogs-first pricing** — condition-graded suggestions, median/lowest, 24h cache
- **eBay fallback** — active listing comparables when Discogs has no match
- **Bulk pricing** — price all unlisted albums (client-chunked for serverless limits)
- **AI pricing** (optional) — Anthropic-powered analysis with strategy and range
- **Dashboard collection value** — estimated total plus low/high range from pricing cache

### Marketplaces
- **eBay** — OAuth connect, live `AddFixedPriceItem` listings, delist, sold sync, marketplace reconciliation when listings are removed on eBay directly
- **Discogs** — OAuth connect, marketplace listings, delist, sold detection
- **Cross-platform sync** — mark sold, cancel the other platform, optional Shippo label
- **AI listing descriptions** — generated copy without misleading shipping-time claims

### Shipping
- **Shippo OAuth** (or API key) — auto-create labels when an album sells, seller address in Settings

### Collaboration
- **Shared collections** — invite others by email as **viewer** or **editor**
- **Collection switcher** in the sidebar when you have access to multiple catalogues
- **RLS-scoped** album, pricing cache, and photo access for collaborators
- Marketplace listing/shipping actions remain **owner-only**

### Dashboard & notifications
- Animated stats (album count, listed, sold this month, revenue)
- Monthly sales chart (12-month rolling)
- **Notification bell** — recent sales, collection invites, new collaborators (last 30 days)

### UX
- Light and dark mode
- Help panel (persistent guide; first-time onboarding modal only)
- Landing page with interactive product preview
- Password recovery with stable `NEXT_PUBLIC_APP_URL` redirects

---

## Tech Stack

| Layer | Stack |
|-------|--------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS, shadcn/ui |
| Backend | Supabase (Postgres, Auth, Storage, RLS) |
| Deployment | Vercel |
| APIs | Discogs, eBay (Browse + Trading), Shippo, Anthropic Claude |
| Tests | Vitest (`lib/csv.test.ts`, `lib/pricing.test.ts`) |

---

## Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) project
- (Recommended) [Discogs](https://www.discogs.com/settings/developers) OAuth app or personal token
- (Optional) [eBay Developer](https://developer.ebay.com/) production or sandbox keyset
- (Optional) [Shippo](https://goshippo.com) OAuth app or API key
- (Optional) [Anthropic](https://console.anthropic.com/) API key for AI features

---

## Environment Variables

Copy the template and fill in values:

```bash
cp .env.local.example .env.local
```

See [`.env.local.example`](.env.local.example) for the full list. Minimum for local dev:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin (invites, shared collection owner metadata) |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL for OAuth and auth email links (`http://localhost:3000` locally) |

Recommended for pricing: `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`, and/or `DISCOGS_PERSONAL_ACCESS_TOKEN`, `DISCOGS_USER_AGENT`.

Optional: `EBAY_*`, `SHIPPO_*`, `ANTHROPIC_API_KEY`, `ANTHROPIC_VISION_MODEL`, `TOKEN_ENCRYPTION_KEY`.

---

## Getting Started

```bash
git clone https://github.com/sd12354/Album-Manager.git
cd Album-Manager
npm install
cp .env.local.example .env.local
# Edit .env.local, then apply migrations (Supabase CLI or SQL editor)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run dev:clean` | Clear `.next` cache and start dev |

---

## Database (Supabase)

Migrations in `supabase/migrations/` (apply in order):

| Migration | Purpose |
|-----------|---------|
| `001_initial.sql` | `albums`, `pricing_cache`, `ebay_credentials`, RLS |
| `002_album_photos_public.sql` | Photo storage bucket |
| `003_pricing_cache_unique.sql` | Unique cache per album + source |
| `004_discogs_listing.sql` | Discogs listing columns on albums |
| `005_shipping.sql` | Shipping / buyer address fields |
| `006_listing_description.sql` | AI listing description column |
| `007_collection_sharing.sql` | `collection_members`, `collection_invites`, shared RLS |
| `008_advisor_hardening.sql` | Security hardening for advisor findings |

```bash
npx supabase db push
```

Row Level Security is enforced on all user data. Shared collections use a `is_collection_member()` helper and role checks (`viewer` / `editor` / `owner`).

---

## CSV Import Format

Flexible header row; columns can appear in any order:

| Column | Required | Values |
|--------|----------|--------|
| `album_title` / `title` | Yes | Album name |
| `artist` | Yes | Artist |
| `genre` | No | Genre |
| `condition` | Yes | `Mint`, `Great`, `Good`, `Fair`, `Poor` |
| `catalog_number` | No | Label cat # (improves Discogs matching) |
| `notes` | No | Internal notes |
| `purchase_price` | No | Cost basis |

Example:

```csv
album_title,artist,genre,condition,catalog_number
Abbey Road,The Beatles,Rock,Great,PCS 7088
```

---

## Integrations Setup

### Discogs
1. Create an app at [discogs.com/settings/developers](https://www.discogs.com/settings/developers)
2. Set callback URL to `{NEXT_PUBLIC_APP_URL}/api/discogs/callback`
3. Add `DISCOGS_CONSUMER_KEY` and `DISCOGS_CONSUMER_SECRET` to env
4. In VinylVault **Settings → Integrations**, click **Connect Discogs**

Users can also paste a personal access token as a fallback.

### eBay
1. Create a keyset at [developer.ebay.com/my/keys](https://developer.ebay.com/my/keys)
2. Set `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME`, `EBAY_ENVIRONMENT`
3. **Settings → Integrations → Connect eBay**
4. Fill in seller address under **Shipping** for listing location fields

Leaving `EBAY_CLIENT_ID` unset enables a **stub OAuth** flow for UI testing only.

### Shippo
1. Register a Shippo OAuth app; callback `{NEXT_PUBLIC_APP_URL}/api/shippo/callback`
2. Set `SHIPPO_CLIENT_ID` / `SHIPPO_CLIENT_SECRET` (or `SHIPPO_API_KEY`)
3. **Settings → Integrations → Connect Shippo** and enable auto-labels

### Anthropic (AI)
Set `ANTHROPIC_API_KEY` for AI descriptions, AI pricing, and cover-photo matching. Optional `ANTHROPIC_VISION_MODEL` (defaults to `claude-opus-4-5`).

---

## Pricing Engine

Combined Discogs + eBay pricing with condition multipliers:

| Condition | Multiplier |
|-----------|------------|
| Mint | 1.30× |
| Great | 1.00× |
| Good | 0.75× |
| Fair | 0.50× |
| Poor | 0.25× |

Precedence: Discogs condition price → Discogs median × multiplier → eBay active asks × 0.85 × multiplier → minimum floor (default $3, configurable in Settings).

---

## Project Structure

```
app/
├── (auth)/           # login, signup, reset, update-password
├── (app)/            # dashboard, albums, import, settings
├── about/            # marketing pages
├── policy/
└── api/              # REST routes (albums, pricing, ebay, discogs, shippo,
                      # collection, sync, notifications, shipping)
components/           # UI shell, catalogue, album detail, collaborators, etc.
lib/                  # ebay, discogs, shippo, pricing, collections, AI, csv
supabase/migrations/
types/
```

---

## API Routes (selected)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/albums/import` | POST | CSV album import |
| `/api/albums/import-json` | POST | Box JSON batch import |
| `/api/albums/match-photo` | POST | AI cover → catalogue match |
| `/api/albums/attach-photos` | POST | Batch attach matched photos |
| `/api/albums/generate-description` | POST | AI listing description |
| `/api/pricing/fetch` | POST | Price one album |
| `/api/pricing/bulk` | POST | Price up to 3 albums per request |
| `/api/pricing/ai` | POST | AI price analysis |
| `/api/ebay/connect` | GET | Start eBay OAuth |
| `/api/ebay/callback` | GET | eBay OAuth callback |
| `/api/ebay/list` | POST | Create eBay listing |
| `/api/ebay/delist` | POST | End eBay listing |
| `/api/ebay/sync` | POST | Bulk marketplace reconciliation |
| `/api/discogs/connect` | GET | Start Discogs OAuth |
| `/api/discogs/list` | POST | Create Discogs listing |
| `/api/discogs/delist` | POST | Remove Discogs listing |
| `/api/sync/check` | POST | Check sold / external delist for one album |
| `/api/shipping/label` | POST | Create Shippo label |
| `/api/shippo/connect` | GET | Start Shippo OAuth |
| `/api/collection/invite` | POST | Invite collaborator |
| `/api/collection/members` | GET | List members & invites |
| `/api/collection/active` | GET/POST | Switch active collection |
| `/api/notifications` | GET | Recent notifications |

---

## Rate Limits & Caching

| API | Limit | Strategy |
|-----|-------|----------|
| Discogs | 60 req/min | ~1.1s delay between calls |
| eBay Browse | App token, daily cap | 24h `pricing_cache` |
| eBay Trading | Per-user OAuth | User-triggered list/delist/sync only |

Bulk pricing is chunked client-side (3 albums per API call) to stay within Vercel’s 60s function limit.

---

## Deploy to Vercel

1. Import the GitHub repo on [vercel.com/new](https://vercel.com/new)
2. Set all env vars from `.env.local.example` (at minimum Supabase + `NEXT_PUBLIC_APP_URL`)
3. Deploy

**Supabase Auth** (Project → Authentication → URL Configuration):
- Site URL = your production domain
- Redirect URLs = `https://your-domain.com/**`

**Run migrations** `001` through `008` on your Supabase project.

**eBay** (if using live OAuth): set RuName / auth-accepted URL to `{APP_URL}/api/ebay/callback`.

`vercel.json` sets `maxDuration` to 60s on pricing, import, and marketplace routes.

---

## Auth & email links

Password reset, signup confirmation, and email-change links use `NEXT_PUBLIC_APP_URL` (see `lib/site-url.ts`) so recovery emails always point at your production domain, not an ephemeral Vercel preview URL.

If password reset emails fail to send, check **Supabase → Authentication → SMTP** — custom SMTP credentials must be valid.

---

## Contributing

1. Fork the repo
2. `git checkout -b feat/my-feature`
3. `npm run lint && npm run test && npm run build`
4. Open a pull request

---

## License

MIT — see [LICENSE](LICENSE).
