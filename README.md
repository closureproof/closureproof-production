# ClosureProof

React + TypeScript + Vite + React Router + Tailwind frontend for manual-evidence-first audit closure.

## Local development

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:3005. Stop any other server using this port first.

- `/`: blue-and-white landing page with demo links in the header/hero and new-tab survey buttons in the footer area.
- `/request-demo`: requester name/email, company name, contact person and optional contact email/phone.
- `/dashboard.html`: public read-only synthetic Assurance Lab.
- `/preview`: public sample workspace with in-memory finding/action drafts; refresh resets them.
- Legacy auth routes and `/app` redirect to `/request-demo`. Sign-in is deferred.

## Demo requests

Copy `frontend/.env.example` to `frontend/.env.local`. Set `VITE_DEMO_REQUEST_URL` to a real public lead-intake endpoint when available, then restart Vite. The endpoint must accept a JSON POST containing `name`, `email`, `companyName`, `contactPerson`, `contactEmail`, and `contactPhone`. Return HTTP 204, or a successful JSON response containing `{"accepted":true}`, only after accepting the request. The service must provide persistence/delivery and appropriate validation and abuse controls.

Without a configured endpoint the form reports that details were not sent. It does not fake success or store contact information in the browser. No backend is implemented in this phase.

## Validation

```sh
cd frontend
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Google Chrome on desktop and a mobile viewport. `npm run preview` serves the production build on port 3005 after stopping the dev server.

## Deployment

Root `netlify.toml` builds the frontend and publishes only `frontend/dist`. SPA fallback supports `/request-demo`, `/dashboard.html` and nested preview URLs. No deployment is performed automatically. Root `.env.example` documents future backend settings; keep secrets out of `VITE_` variables.

A Supabase SQL migration creates the demo-request table; see [database setup](docs/demo-request-database.md). The intake endpoint, authentication, private evidence uploads, authoritative assessments and formal closure exports remain deferred. See the [migration guide](docs/frontend-migration.md) and [design direction](docs/design-direction.md).
