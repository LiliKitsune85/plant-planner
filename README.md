## 1. Project name
**Plant Planner** – a web application that helps experienced indoor plant collectors keep their collections healthy through fast AI-powered identification, curated care guidance, and lightweight watering tracking.

## 2. Project description
Plant Planner combines AI-based plant recognition (photo upload with <10 s response time), a vetted care knowledge base, and a calendar-driven watering workflow to increase plant survival while keeping operational costs predictable. Users can confirm or override AI suggestions, add plants manually, review care recommendations with full source attribution, and log/undo watering actions across daily and monthly views. The product stores only essential user data (email, password, nickname), enforces daily/ hourly limits to prevent abuse, and supports immediate, double-confirmed account deletion. See the [Product Requirements Document](./.ai/prd.md) for the full backlog and acceptance criteria.

## 3. Tech stack
- **Frontend:** Astro 5, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, class-variance-authority, clsx, tailwind-merge, tw-animate-css, lucide-react.
- **Backend & data:** Supabase (PostgreSQL, Auth, and SDK clients) acts as the backend-as-a-service and single source of truth for plant, user, and watering data.
- **AI services:** OpenRouter.ai provides access to multiple vision-capable models with budget controls for image-based plant recognition.
- **Tooling & platform:** Node.js 22.14 (see `.nvmrc`), npm, ESLint + Prettier, Husky + lint-staged, GitHub Actions for CI/CD, and DigitalOcean for containerized hosting.
- Additional architectural notes live in [`.ai/tech-stack.md`](./.ai/tech-stack.md).

## 4. Getting started locally
Prerequisites:
- Node.js 22.14.0 (`nvm use` recommended)
- npm 10+ (ships with Node 22)
- Access credentials for Supabase and OpenRouter.ai (environment variable names to be defined during implementation)

Setup steps:
```bash
git clone https://github.com/<org>/plant-planner.git
cd plant-planner
nvm use 22.14.0
npm install
npm run dev
```

Common tasks:
- `npm run build` – generate a production build.
- `npm run preview` – preview the built site locally.
- `npm run lint` / `npm run lint:fix` – run ESLint and auto-fix issues.
- `npm run format` – format the codebase with Prettier (Astro plugin included).

## 5. Available scripts
- `npm run dev` – start the Astro dev server with React-enabled islands.
- `npm run build` – compile the project for production deployment.
- `npm run preview` – serve the production build locally for smoke tests.
- `npm run astro` – access the Astro CLI directly for ad-hoc commands.
- `npm run lint` – run ESLint across `.ts`, `.tsx`, and `.astro` files.
- `npm run lint:fix` – lint with automatic fixes for common issues.
- `npm run format` – apply Prettier (with `prettier-plugin-astro`) to supported files.

## 6. Project scope
- **Core capabilities in scope:**
  - AI-driven photo uploads with confirm/override flow, including manual fallbacks that do not count toward AI stats or limits.
  - Care recommendation review with clear source links, approve/reject flow, and custom watering cadence overrides stored per plant.
  - Calendars: monthly overview, daily execution list, single-plant monthly view, and a rolling 90-day watering history with edit/undo.
  - Limit enforcement (20 AI queries/hour per IP), proactive user messaging, and compliant storage of user credentials.
  - Privacy operations such as double-confirmed account deletion with immediate data purge.
- **Explicitly out of scope for the MVP:** reminder notifications, fertilizing or non-watering tasks, external calendar integrations, native/mobile apps, multi-photo journals, advanced scheduling heuristics, exception handling for limits, telemetry on manual entries, and historical versioning of watering logs.
- User stories US-001 to US-012 in the [PRD](./.ai/prd.md) detail the complete flow coverage for the MVP.

## 7. Project status
- **Status:** In development (MVP planning and implementation).

## 8. License
This project is licensed under the MIT License.