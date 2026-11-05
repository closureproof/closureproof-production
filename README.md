# ClosureProof

**Evidence before closure.**

ClosureProof helps security teams, auditors, and compliance partners understand whether corrective-action evidence supports closing an audit finding. It connects the finding, root cause, corrective actions, evidence gaps, and independent review into an explainable closure-readiness workflow.

The current implementation is a React frontend with synthetic walkthroughs, an interactive workspace preview, a demo-request form, and a Supabase database migration for demo enquiries. Production assessment, evidence storage, and review services are planned.

## Product experience

- **Public website:** introduces the product, manual-evidence workflow, and planned integrations.
- **Assurance Lab:** a read-only demonstration of findings, assessment checks, protocols, and decision history.
- **Workspace preview:** supports finding and corrective-action drafts using sample records. Changes remain in memory and reset on refresh.
- **Demo requests:** collects requester name, email, company, contact person, and optional contact email and phone.
- **Research survey:** the lower landing-page callout opens Google Forms in a new tab. The final footer button opens the demo-request page.
- **Provider showcase:** scrolling logos pause on hover or keyboard focus. Reduced-motion preferences show a static list.

The preview includes findings, evidence metadata, protocol checks, a reviewer queue, decision history, sample JSON snapshots, membership concepts, and organisation settings. Backend-dependent operations clearly report that they are unavailable rather than recording a successful upload, approval, or formal closure.

## Closure-readiness workflow

1. Record the finding, affected scope, accountable owner, and root cause.
2. Define corrective actions and document implementation.
3. Attach evidence with its source, coverage, dates, and exceptions.
4. Review passed, failed, unknown, and not-applicable checks.
5. Obtain an independent retest against the current evidence revision.
6. Record an authorised decision and generate a traceable closure pack.

The four readiness states are **Not closure ready**, **Implemented but evidence incomplete**, **Ready for retest**, and **Closure ready**. Current assessments are illustrative fixtures; authoritative decisions will belong to the backend.

Ten draft protocol families cover privileged access, joiners and leavers, MFA, patching, backup restoration, suppliers, logging, change control, incident response, and training. Their operating thresholds are pilot assumptions, not requirements imposed by ISO 27001. Closure readiness is a recommendation, not certification or an auditor’s final decision.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/request-demo` | Demo-request contact form |
| `/dashboard.html` | Public read-only synthetic walkthrough |
| `/preview` | Interactive sample workspace |
| `/preview/findings` | Finding register, search, and filters |
| `/preview/evidence` | Evidence manifest and file-preparation interface |
| `/preview/protocols` | Draft protocol catalogue |
| `/preview/reviews` | Sample reviewer queue |
| `/preview/history` | Decision and revision history |
| `/preview/exports` | Synthetic snapshot downloads |
| `/preview/integrations` | Planned provider catalogue |

Member and organisation previews are available under `/preview/members` and `/preview/settings`. Authentication is deferred; `/app` and legacy authentication URLs redirect to `/request-demo`.

## Technology and repository structure

The frontend uses **React 19, TypeScript, Vite, React Router, Tailwind CSS, and Lucide icons**. Shared components and theme tokens provide the navy, blue, and white visual identity.

```text
frontend/
  src/
    app/          Routing and workspace state
    components/   Layout, controls, branding, and provider carousel
    features/     Protocols, provider definitions, and sample records
    lib/          Types, API client, survey URL, and enquiry delivery
    pages/        Landing, demo-request, and workspace screens
    styles/       Tailwind theme and animation utilities
  public/brand/   Logo assets, attribution, and licences
  e2e/            Browser tests
supabase/
  migrations/     Versioned database schema changes
  tests/          Rollback-only SQL checks
netlify.toml      Frontend build and hosting configuration
```

## Demo-request persistence

The form submits JSON to the endpoint configured by `VITE_DEMO_REQUEST_URL`. It confirms receipt only after HTTP 204 or a successful JSON response containing `{"accepted":true}`. Without an endpoint, it reports that details were not sent and retains the entries on screen. Contact information is not stored in browser storage.

The [demo-request migration](supabase/migrations/20261105000100_create_demo_requests.sql) creates `public.demo_requests` with:

- Requester name/email, company name, contact person, and optional contact email/phone.
- A generated UUID, timezone-aware creation timestamp, and input constraints.
- Row-level security and trusted server-role insert access; browser roles cannot access submitted enquiries.

The SQL can be applied through the Supabase SQL Editor. [Database checks](supabase/tests/demo_requests.sql) verify constraints, defaults, permissions, and fixture rollback. Creating the table does not connect the form: the intake endpoint must validate requests and persist them before acknowledging receipt. Keep service-role keys and other secrets out of frontend configuration.

## Planned integrations

AWS, Azure / Entra ID, Google Cloud, Okta, GitHub, Jira / ServiceNow, Tenable / Qualys, CrowdStrike / Microsoft Defender, Veeam / Rubrik, and an on-premises collector are labelled **Planned integration**. No live provider connections or agents are implemented. Provider logos identify roadmap capabilities; asset sources and licences are retained alongside the files.

## Quality and deployment

Vitest and React Testing Library cover component behavior. Playwright checks desktop and mobile workflows, navigation, form validation, carousel hover behavior, and reduced motion. PostgreSQL checks cover the demo-request schema.

```sh
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run test:e2e
npm --prefix frontend run build
```

Netlify installs dependencies, builds the frontend, and publishes `frontend/dist`. SPA fallback supports direct route navigation. Same-origin `/api/*` requests return an explicit unconfigured response until a backend is provided. Public environment values must be supplied through the deployment configuration; no credentials are included in this repository.

## Next implementation stages

- Public demo-request intake, persistence, and delivery.
- Authentication, organisations, memberships, and tenant isolation.
- Private evidence uploads to Amazon S3 with validation and quarantine.
- Backend-owned assessments, independent retests, approvals, and revision invalidation.
- Formal closure decisions and complete, authorised closure-pack exports.

The planned backend stack is FastAPI, SQLModel, and Supabase PostgreSQL, with Supabase Auth and private Amazon S3 storage. These services are not implemented by the current frontend.
