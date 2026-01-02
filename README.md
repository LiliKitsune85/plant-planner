## 1. Project name
**Plant Planner** – a web application that helps experienced indoor plant collectors keep large collections on schedule through manual plant intake, AI-assisted watering recommendations, and lightweight calendar tracking.

## 2. Project description
Plant Planner focuses on fast manual plant registration plus LLM-powered watering plan suggestions delivered within 5 seconds. Growers capture a species name (with optional nickname, description, purchase date, and photo), review frequency guidance with short justifications, and accept or override plans before they flow straight into monthly and daily calendars. The app tracks confirmations/undos, keeps entries editable, and enforces the 20 AI queries per user per hour limit with clear messaging and manual fallbacks. Secure Supabase-backed auth, double-confirmed account deletion, and compliant storage of minimal user data (email, password, nickname) round out the MVP. See the [Product Requirements Document](./.ai/prd.md) for the full backlog and acceptance criteria.

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
  - Manual plant intake with mandatory species name, optional metadata (nickname, description, purchase date, photo), and automatic numbering for duplicates.
  - Watering plan generation via LLM within 5 seconds, including frequency guidance and short justification.
  - Approve/reject flow for watering plans with forced custom cadence entry on rejection and immediate calendar updates plus decision logging.
  - Monthly and daily calendar views that refresh on every change, allow confirming/undoing waterings, and support entry edits.
  - Limit enforcement of 20 AI queries per user per hour with upfront messaging, lockout notices, and manual-entry fallback.
  - Account lifecycle and data management: secure auth, double-confirmed account deletion, plant detail editing, and compliant data storage.
- **Explicitly out of scope for the MVP:** photo-based plant recognition, timeline/history views beyond the calendar, reminder notifications, non-watering task tracking, calendar sharing or external integrations, and native/mobile apps.
- User stories US-001 to US-011 in the [PRD](./.ai/prd.md) detail the complete flow coverage for the MVP.

## 7. Project status
- **Status:** In development (MVP planning and implementation).

## 8. License
This project is licensed under the MIT License.