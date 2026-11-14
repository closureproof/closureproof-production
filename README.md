# ClosureProof

**Evidence before closure.**

ClosureProof is a public pilot for submitting audit findings, uploading corrective-action evidence and recording structured reviews. The application uses Next.js App Router, React and TypeScript. Supabase PostgreSQL RPCs and Storage persist the records and evidence; PDF reports are generated in the browser. The repository uses npm workspaces and Turborepo to coordinate development, builds and checks.

The pilot has no sign-in, protected routes, assigned roles or enforced reviewer-account separation. Everyone using the app shares the pilot workspace. Reviewer names and independence declarations are self-reported. Readiness recommendations remain reviewer-selected. Optional OpenAI document extraction prepares draft findings and cited evidence facts; it does not issue audit verdicts, compliance scores or closure approval. A readiness rules engine is not implemented.

## Architecture and repository structure

```text
apps/
  web/                       @closureproof/web — Next.js application
    src/app/                 App Router pages, layouts and route boundaries
    src/screens/             Landing page, submission and review screens
    src/components/          Shared interface and workflow components
    src/features/            ISO catalogue, protocols, scope and judgement logic
    src/lib/                 Supabase clients, workflow APIs and report generation
    public/                  Brand assets and licensed report fonts
    e2e/                     Desktop and mobile Playwright scenarios
    scripts/                 SQL contract fixtures and schema checks
packages/
  typescript-config/         Shared base and Next.js TypeScript settings
supabase/                    SQL migrations and database test fixtures
turbo.json                   Task graph, environment handling and local caching
package.json                 Root workspace definitions and Turbo commands
package-lock.json            Single lockfile for all workspaces
netlify.toml                 Netlify monorepo build configuration
```

Next.js owns application routing and production builds. React Router and Vite remain test-only tooling for the existing component suite. Node.js runs the application, npm manages workspace dependencies, and Turborepo orchestrates tasks; Turborepo is not the application runtime. Shared TypeScript configuration in `packages/typescript-config` is consumed as the local `@closureproof/typescript-config` workspace.

## Supabase configuration

1. Run [the public pilot SQL](supabase/migrations/20261106000200_public_pilot.sql) in the Supabase SQL Editor. It creates the `cpp_*` tables, public pilot RPC functions, the initial protocol versions and the `closureproof-pilot-evidence` Storage bucket. It can be rerun and creates no sample findings. This migration is standalone.
2. Run [the ISO 27001 checklist migration](supabase/migrations/20261106000300_iso27001_checklists.sql) to install the 153-task source catalogue and mapped `1.0-iso27001` versions of the existing ten templates.
3. Run [the review completion migration](supabase/migrations/20261109000100_review_completion_workflow.sql) to add completed assessments, stored PDF reports, follow-up cycles and recorded final approvals. Existing reviews remain historical records.
4. Run [the control review scope migration](supabase/migrations/20261109000200_control_review_scopes.sql) to enable control selection and scoped completion requirements.
5. Run [the simplified judgement migration](supabase/migrations/20261109000300_simplified_reviewer_judgement.sql) to enable version 2 judgement validation and report template 1.1.
6. Run [the conditional judgement migration](supabase/migrations/20261109000400_conditional_judgement.sql) to validate progressive field requirements and retain earlier schemas.
7. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `apps/web/.env.local` or the hosting platform’s environment configuration. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported. Use only public browser credentials; never a service-role key or database password. Environment files remain ignored.
8. Open the dashboard, submit a finding, attach evidence and record a manual review. No Auth settings, account creation or email confirmation is needed.

The browser key cannot install SQL. Connection failures remain visible and do not create a success message or substitute dummy data. Form fields and protocol choices remain available while a storage problem is resolved.

Earlier `cp_*` and `cpw_*` tables, functions and files are preserved. They are not published through the new pilot or automatically copied into its shared register. The earlier authenticated workspace migration remains historical; it is not required for the public pilot.

## Manual workflow

- Record the finding, owner, source scope, affected resources, root cause and corrective action. AWS IAM is one optional review protocol; submission is generic.
- Upload PDF, DOCX, PNG, JPG, CSV, JSON or TXT evidence with source metadata. Limits: 25 MB per file, 30 files / 250 MB per finding. Files are unscanned and shared with pilot users.
- Inspect text and image previews or download originals. PDF originals are download-only.
- Open a queue entry directly in its reviewer workspace; evidence inspection and judgements are available there, while uploads remain on the submission/finding page.
- Enter the reviewer name, protocol observations and detailed closure judgements: scope and evidence requirements, root cause/action effectiveness, population coverage, exceptions, operating history/deadlines, retest and outstanding follow-up. Expanded judgements are retained in review snapshots and history.
- Save a draft or select **Complete Review** with a manually selected recommendation: **Not closure ready**, **Implemented but evidence incomplete**, **Ready for retest** or **Closure ready**. Check observations do not automatically determine the recommendation.
- Finding/evidence changes create new revisions. Earlier review snapshots remain in history; the dashboard uses only published or completed recommendations against the current revision.

Completing a review does not formally close a finding or certify an organisation. The workbook’s indicative mappings and category mappings still need qualified review. Spreadsheet import/export and live provider integrations remain future work.

## Optional AI document extraction

The submission page supports **Upload audit report** alongside manual entry. OpenAI reads a PDF/DOCX and proposes separate finding drafts. Users check the source, correct missing details, select scope and explicitly confirm each submission. The original audit report is source context, not remediation evidence.

Within a review, **Prepare review from evidence** reads current PDF/DOCX attachments that have not been extracted yet, then uses OpenAI to map their extracted facts to the finding’s pinned checklist, structured judgements and category-specific engine fields. The draft carries filenames, evidence IDs, source locations and rationale. **Use draft in review** populates the editable form and evaluates the draft through the rules engine. Reviewers correct proposals, resolve missing information, and accept or justify an override before completing the review. AI never selects the readiness recommendation or formal closure decision.

**Analyse submitted documents** remains available for inspecting and correcting individual extracted facts. Preparation uses the latest current-version extraction for each eligible document, including saved corrections and exclusions. Unreadable or unsupported evidence is not silently treated as assessed. Missing information stays unknown; conflicts prevent the proposed draft from establishing successful results automatically. Completed snapshots and reports retain adopted facts and exact evidence versions.

Documents go directly to OpenAI’s Responses file-input API; no custom PDF/DOCX text extractor is used. Application code validates file signatures/package metadata and structured output. Source quotations/pages/sections are AI-proposed and require checking against the original; they are not independently machine-verified citations. DOCX references use sections/paragraphs rather than page numbers. Scanned/image-only documents are not a supported guarantee.

Apply `supabase/migrations/20261111000100_ai_document_extraction.sql` after the earlier active migrations. It adds extraction history, DOCX MIME support, append-only fact decisions, idempotent confirmed-draft submissions and completion validation. Historical private records remain untouched. Configure these **server-only** values in `apps/web/.env.local` or the hosting environment:

```dotenv
AI_EXTRACTION_ENABLED=true
OPENAI_API_KEY=your-server-api-key
SUPABASE_SERVICE_ROLE_KEY=your-server-supabase-service-key
OPENAI_EXTRACTION_MODEL=gpt-4.1-mini
AI_EXTRACTION_DAILY_LIMIT=20
```

Never use a `NEXT_PUBLIC_` prefix for these secrets. The service key is elevated and used only by server routes; it is not the public browser key. Sources upload directly to signed paths in the existing Supabase bucket, avoiding large file bodies through Next.js endpoints. Analysis has persistent daily start/call caps, a processing lease, three explicitly requested attempts maximum and no automatic provider retry. Retried or interrupted calls may still be billed. `store:false` does not assert zero provider retention.

A missing migration, disabled feature, unavailable key or processing failure leaves manual submission/review available. Default tests use synthetic documents and deterministic provider fixtures; they do not establish model accuracy. An explicit, uncached provider smoke check is available with `RUN_AI_LIVE_SMOKE=1 npm run test --workspace @closureproof/web -- src/lib/server/document-analysis.live.test.ts`; it sends only the small synthetic PDF/DOCX fixtures to the configured OpenAI account and creates no live workspace records. Provider keys are not configured by committing code. ClosureProof’s output is a readiness recommendation and evidence pack for an external closure decision.

## Completed reviews and follow-up

**Complete Review** validates checklist results, evidence references, detailed judgements, exceptions, population counts, operating dates and retest details. It atomically saves an immutable assessment, activity event and pending report. Repeated completion requests cannot create duplicate assessments. Readiness remains the reviewer’s choice.

The browser generates a **Review Assessment Report** for insufficient-evidence or retest outcomes, or a **Closure Evidence Pack** for a closure-ready recommendation. PDFs use saved snapshots, retain report/assessment IDs and template version, and are stored with a checksum in the existing Supabase bucket. Closure packs provides PDF and ZIP downloads; ZIPs include the report, exact evidence versions and a manifest. Failed or interrupted generation preserves the assessment and offers retry. Generation requires an open browser; no background report server is implied.

Return for Remediation and Request retest record actions, owners and evidence expectations. Requests appear on the finding and in dashboard activity/action notices. Resubmission creates a new numbered cycle; earlier decisions and reports remain available for comparison. Corrections append a linked assessment revision.

**Submit for Final Approval** is available only for a current closure-ready assessment with its report ready. Record the actual decision-maker, supporting reference, decision date/reason and recorder separately. Only an approved decision sets Closed. Rejection requests follow-up; a material change invalidates pending approval. Reopening a closed finding starts a new cycle. These are recorded decisions within the current shared workspace, without verified identities or account roles.

## Workspace sections

Public “See how it works” and demo actions open `/request-demo`. Public pages do not link into the workspace. `/app` remains available by direct URL, with noindex metadata; `/dashboard.html`, `/preview` and `/workbench` are retired and return not found. This reduces discovery without enforcing access permissions. The original dashboard design and sidebar destinations are retained: overview, findings, evidence library, manual upload, closure protocols, reviewer queue, decision history, closure packs, integrations, participants and organisation settings.

Dashboard counts, finding rows and recent activity come from saved pilot submissions. Records refresh after mutations, on focus and periodically. No sample findings or automatic scores populate the interface.

The public pilot permits anyone using the app to read, submit, edit and manually review pilot records and download submitted evidence. It does not establish verified identity, authorisation or independent review. Original-file replacement remains versioned, and stale-revision checks prevent silently publishing against changed evidence. Use test material suitable for sharing.

## Public website

Navy/blue/white branding and rounded controls remain. Demo enquiries use the built-in `/api/demo-requests` route and the server-only Supabase client to save `demo_requests`. Apply [the enquiry/notification migration](supabase/migrations/20261113000100_demo_request_notifications.sql); it supports existing tables and adds notification tracking. The obsolete `NEXT_PUBLIC_DEMO_REQUEST_URL` is no longer used. The survey opens Google Forms in a new tab. Providers remain **Planned integration**; only their logos scroll, with hover/focus pause and reduced-motion support.

## Workspace commands and validation

Use the npm version declared by `packageManager` in the root `package.json` (currently npm 11.6.2) with a compatible Node.js release. Install dependencies once from the repository root:

```sh
npm ci
```

Run all commands below from that same root. Application tasks are dispatched through Turborepo.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Next.js development server. |
| `npm run build` | Create the production build in `apps/web/.next`. |
| `npm run start` | Build if needed, then start the production server. |
| `npm run preview` | Build if needed, then serve the production preview. |
| `npm run typecheck` | Generate Next.js route types and check TypeScript. |
| `npm test` | Run Vitest component and feature tests. |
| `npm run test:db` | Run isolated PostgreSQL/WASM migration and workflow checks. |
| `npm run test:e2e` | Build and run desktop/mobile Playwright scenarios against an isolated Supabase fixture. |
| `npm run check:supabase` | Check the configured live public schema without creating records or files. |

Target a workspace using Turbo’s filter, for example:

```sh
npm run build -- --filter=@closureproof/web
```

Keep one root lockfile; do not create application-level lockfiles or install dependencies separately in each workspace. Add application dependencies with `npm install <package> --workspace @closureproof/web`.

### Task caching and environment configuration

Turbo caches production builds and unit tests locally. Build hashes include the declared public environment values, application `.env*` files and shared TypeScript configuration. Next.js runtime output is retained, while `.next/cache` and `.next/dev` are excluded from build artifacts. Development servers, production servers, type checks, database checks, browser tests and live schema checks are not cached. Remote caching is not configured.

Environment files, `.next`, `node_modules` and `.turbo` stay ignored. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) for the web application. Legacy `VITE_*` equivalents remain supported by `next.config.ts` during migration. Public values are included in the browser build; never place service-role credentials or database passwords in them. Rebuild after changing public deployment values.

### Validation boundaries

Database tests cover the account-free schema and preservation of historical schemas. Browser tests use an isolated PostgreSQL-backed Supabase contract fixture for navigation, submission, upload/download, completion, report retries, corrections, resubmission, approvals and stale-review history. These checks do not prove the live project’s complete Storage implementation. SQL fixtures under `supabase/tests/` must not be run in the live project.

## Deployment

### Vercel

- Set **Root Directory** to `apps/web` and select the **Next.js** framework preset.
- Allow source files outside the app root so shared workspace packages are available.
- `apps/web/vercel.json` installs from the root lockfile and builds through Turbo. Remove obsolete dashboard command overrides.
- Keep the framework’s default output directory; do not use the former Vite `dist` setting.
- Configure the public application environment values before building.

### Netlify

The root `netlify.toml` installs from the repository workspace and runs the filtered Turbo build. Set **Package directory** to `apps/web` so Netlify detects the Next.js application. The publish path is `apps/web/.next`; the Next.js adapter handles framework deployment. Deployment itself is separate from running the local build.

## ISO 27001 checklist-backed reviews

The ten existing finding categories are retained. Their new template versions map relevant items from the supplied workbook into each review. The full library contains 153 ISO 27001-tagged tasks and 626 source steps; SOC 2-only and ISO 27701-only rows are excluded. Task IDs, evidence descriptions, requirement labels, source frequencies, steps and page references are retained. Workflow guidance uses vendor-neutral evidence instructions while retaining source task IDs and page references. Existing pinned definitions are adapted for display without rewriting stored assessment snapshots; previously generated report files remain unchanged.

New findings pin the mapped checklist version. Existing findings keep their original checklist until a reviewer selects **Apply selected checklist**. Reviewers can use category defaults or choose additional tasks from the full library. A changed checklist creates a new finding revision, retains evidence and earlier review snapshots, and invalidates prior recommendations against the changed basis. An unchanged scope creates no extra revision.

Checklist observations remain separate from the existing detailed closure-judgement sections and manually selected readiness recommendation. Source “Required” labels are not universal closure requirements; applicability must be reviewed for each finding. The catalogue is not a claim of complete ISO certification coverage. The separate benchmark remains under ignored documentation.

Checklist review dropdowns use the supplied SoA workbook’s applicability options (**Yes**, **No**, **Under review**) and implementation statuses (**Not assessed**, **Not implemented**, **Partially implemented**, **Implemented**, **Not applicable**). Exact statuses are retained in review JSON and history; older evidence assessments are not automatically reclassified as implementation decisions. Not-applicable assessments require a No applicability decision and an explained rationale. The finding’s closure recommendation remains separate.


## Control-based review scope

New submissions select a finding category and one or more ISO 27001 controls. The form previews the relevant checklist, expected evidence and review sections before saving. There are 22 configured control mappings; all 93 Annex A control names from the supplied SoA workbook are searchable. Unmapped or unidentified controls use an explicit provisional category checklist, with a required explanation and documented reviewer confirmation before completion. Configured mappings are finding-level guidance, not a certification coverage claim.

Four judgement areas remain common: scope/evidence, root cause/corrective action, exceptions and conclusion. Population coverage, operating history and retest sections appear where the selected mapping requires them. Reviewers can add tasks/modules or exclude suggested items with recorded reasons through **Amend review scope**. Scope confirmation does not replace the SoA applicability and implementation assessments for retained tasks.

The database resolves and saves the versioned scope and checklist atomically. Completed assessments, PDF reports and ZIP manifests retain their exact scope, exclusions and confirmation. Scope amendments create a revision, preserve drafts/history and invalidate pending approval; changed completed cases need resubmission. Existing findings retain their original checklist and validation until explicitly adopting control-based scope. Readiness remains manually selected.


The control selector groups the SoA catalogue into **Organisational (37)**, **People (8)**, **Physical (14)** and **Technological (34)**. Suggested controls remain the initial view; All controls supports cross-theme browsing. Search narrows the active section, while a search started from Suggested searches the complete catalogue. Selected controls remain visible across sections and can be removed individually. Browsing sections does not change saved scopes or readiness.


Checks may remain **Under review / Not assessed** when a review is completed. Reviewers can supply one shared explanation for unassessed checks whose individual rationale is blank. The saved check records and report retain that explanation and its shared origin without changing applicability or implementation status. Existing individual notes remain intact; Not applicable decisions still require their own justification.


The reviewer form has three steps: **Checklist**, **ClosureProof reviewer judgement**, and **Conclusion & recommendation**. Next/Back and the step navigation retain entered values without validating unfinished steps. Save review draft is available throughout and retains the current step for reopening. Complete Review is available only on the final step; validation returns the reviewer to the relevant step when information is missing. The saved assessment and report format remain the same.


Judgement version 2 removes duplicate population, exception, operating-history and retest notes. Corrective-action effectiveness and recurrence prevention share one assessment. Exceptions use structured records and one overall closure-impact assessment only when exceptions exist. Accepted exceptions record the decision authority, date and reference; mitigated exceptions record compensating controls. Population review distinguishes full coverage, a sample and an unestablished basis; samples require their method and limitations. Retest fields depend on status: planned/outstanding work, completed results and independence with linked evidence, or a justified not-applicable decision. Reviewers can link submitted evidence directly to judgement sections and inspect the submitted scope/actions alongside them. Existing assessment snapshots retain their original judgement schema; completed version 2 reviews use report template 1.1.


Judgement version 3 begins with explicit reviewer decisions. Scope/evidence and cause/action use short assessment choices; satisfactory decisions do not require invented gap narratives. Population, operating history and independent retest start with **Required**, **Not required** or **Not yet established**. The last two require a reason; detailed fields appear only for Required assessments. Exceptions distinguish none, identified exceptions and an unknown position. Follow-up and limitations reveal their narrative fields only when relevant. No choice is inferred from checklist implementation statuses. Completion removes inactive details from the snapshot; reports show the saved decisions and reasons rather than blank or passed sections. Version 3 uses report template 1.2. Versions 1 and 2 remain supported for historical records and earlier clients.

### Rules-supported assessments

All ten categories support source-backed engine inputs alongside the pinned checklist. Inputs may be entered directly or adopted from an AI-prepared draft. Reviewers accept the computed recommendation or record a justified override with supporting evidence. All current protocols are candidates awaiting independent validation. No universal operating period is assumed.

`@closureproof/assessment-engine` contains the evaluator and category protocols. Next.js `/api/assessments/evaluate` and `/complete` recompute assessments using the server-only Supabase service key. Apply `20261111000200_rules_supported_assessment.sql` after the extraction migration. Completion compares the current basis transactionally, preserves one immutable assessment, and preserves the assessment trace in the applicable report template. Saved PDFs/ZIP manifests include the rule trace and reviewer disposition. Completion never issues final closure approval. The protocol registry is server-controlled; it has no public authoring endpoint.

`npm run test:db` includes the engine completion contract. Browser tests use an isolated fake service-role credential, never a real project credential or OpenAI call.


## Checklist-linked AWS IAM assessment

Current AWS IAM engine version `0.3.0-checklist-candidate` maps the finding's pinned ISO task IDs into closure requirements through `@closureproof/assessment-engine/checklist-mapping`. Only scoped checklist items are evaluated; unrecognised mappings remain unknown. Implemented requires applicability Yes, rationale and current evidence/source references to satisfy a checklist requirement. Partial/not implemented remains unmet; unassessed remains unknown; explicit justified No/Not applicable remains excluded. Checklist satisfaction never replaces cause/effectiveness/coverage/retest judgements. Reviewers may explicitly reuse mapped checklist evidence without auto-confirming qualitative answers.

Evaluation and completion consume the same current checklist answers and pin mapping policy/version, checklist input and trace in snapshots/reports/ZIPs. Checklist edits invalidate the preview. `20261111000300_checklist_linked_engine.sql` permits the new immutable version without rewriting 0.1 definitions or historical completed assessments. All category integrations retain their own pinned mappings; independent validation remains pending.


## All-category rules-supported assessments

All ten existing categories now support the same rules-supported workflow: AWS IAM, access reviews, joiner/mover/leaver access, MFA, vulnerability/patch remediation, backup restoration, supplier review, logging/monitoring, change management and incident response. Select **Rules-supported … assessment**, or adopt an AI-prepared review draft. The saved finding category selects the server protocol; each category has its own explicit ISO task mappings, evidence guidance and additional closure judgements. Manual recommendations remain available.

`packages/assessment-engine/src/protocol-catalogue.ts` is the category catalogue. New nine-category protocols use `0.1.0-checklist-candidate`; AWS IAM uses `0.3.0-checklist-candidate` to extend configured-control coverage without changing its stored older definitions. All methods await independent validation. Timing requirements remain reviewer-entered; no universal ISO period or audit score is introduced.

Apply `20261111000400_all_protocol_engines.sql` after the earlier engine migrations. It extends the server-only registration/completion RPCs and report template 1.5 while preserving existing assessments and report files. Unknown/unmapped/unsupported facts cannot produce computed closure readiness. Completion, reports, resubmission and recorded external decisions continue through the existing workflow. This completes category-engine integration, not independent method validation or unrelated business-plan features such as spreadsheet import and client isolation.

## AI-assisted review preparation

The review has three steps: **Evidence & checklist**, **Gaps & exceptions**, and **Recommendation & report**. AI preparation fills these existing fields; the reviewer handles corrections, uncertain evidence and final disposition. One conclusion and one set of next actions feed the completed assessment and report. Reviewer identity, independence, scope confirmation, risk acceptance and final approval are never invented by AI.

Apply `20261111000500_ai_review_preparation.sql` after the existing migrations. It adds private, immutable `cpp_ai_review_proposals` with durable processing leases, bounded explicit retries and the existing shared AI quota. `/api/assessments/propose` uses [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) against exact pinned IDs, typed values and cited extracted-fact keys. Unsupported references or invalid output cannot populate the form. Unchanged source/model inputs reuse a completed preparation; changed evidence, scope or extracted facts invalidate its source fingerprint before completion.

Drafts remain separate from completed assessments. Adoption and edits are saved in review JSON; completed engine assessments pin the private proposal’s hash, model, source fingerprint and limitations. PDFs include this preparation history and the confirmed evidence references. The existing assessment limit is 20 cited extracted facts; the preparation input is bounded and reports gaps rather than silently truncating evidence. Manual review remains available if extraction or preparation fails.

Contract tests use an isolated local provider fixture, guarded by a fake service credential and fixed test database URL. They verify software behaviour, not real-model accuracy. No live customer records are used by these tests.

An opt-in provider contract check is available with `RUN_AI_REVIEW_LIVE_SMOKE=1 npm run test --workspace @closureproof/web -- src/lib/server/ai-review-preparation.live.test.ts`. It sends a small synthetic extracted-fact set to the configured OpenAI model and writes no Supabase records. A successful smoke check establishes API/schema compatibility, not assessment-method validation or model accuracy on customer evidence.

## Demo enquiries and admin email

The demo form posts to `/api/demo-requests`. Server validation and a stable request ID protect retry handling. Supabase persistence succeeds before notification is attempted; email failure never discards a saved enquiry. Contact rows have no public read/write grants.

Configure these server-only values locally and in Vercel: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `DEMO_NOTIFICATION_FROM` (a sender on a domain verified in Resend), `DEMO_ADMIN_EMAIL` (the recipient), and `DEMO_NOTIFICATION_RETRY_TOKEN` (a long random secret). Supabase URL uses the existing public setting. Local configuration is `apps/web/.env.local`; the application template is `apps/web/.env.example`.

`demo_requests.notification_status` records pending/sending/sent/failed, attempts and errors. Sent means the email provider accepted the message, not confirmed inbox delivery. Missing mail configuration leaves the notification pending.

For a manual retry, POST to `/api/admin/demo-notifications/retry` with `Authorization: Bearer <DEMO_NOTIFICATION_RETRY_TOKEN>`. This protected server endpoint handles up to ten pending/failed/expired-lease notifications, with a five-attempt limit and provider idempotency keys. It is not a public workspace control. No automatic scheduler is installed; retry can be invoked by the operator. Enquiries remain visible to authorised Supabase project administrators if email is unavailable.

`npm run test:db` includes fresh/existing demo-table installation, public-access refusal, request idempotency, mail leases and retry checks. Email unit tests use a fake provider; do not send real mail from browser fixtures.

## Request and upload protection

Apply `supabase/migrations/20261113000200_request_security.sql` before deploying the request-hardening changes. Server endpoints fail closed if their budget RPC is unavailable. Existing workspace routes remain public; these controls do not add authentication or isolate customer records.

Request bodies are checked while streaming, JSON content types are required, and same-origin checks reject browser cross-site writes. Shared PostgreSQL budgets cap demo submissions (10 per client/hour, 100 globally/hour), analysis reads (180/client/minute, 1,200 globally/minute), analysis writes (20/client/10 minutes, 100 globally), assessments (60/client/minute, 300 globally), and upload validation (60/client/10 minutes, 300 globally). Vercel's client-IP header is hashed with a server secret; raw IPs are not stored. Other hosts use a shared client bucket until a trusted proxy integration is configured. Counters are cleaned up when requests arrive. Fixed windows and honeypot filtering reduce abuse; they are not a guarantee against distributed attacks or sophisticated bots.

Evidence stays pending until `/api/evidence/complete` downloads and validates its stored size, checksum and allowed content format, then invokes the service-only finalisation RPC. Direct browser finalisation is denied. DOCX archive safety checks run on the server. Format validation is not antivirus scanning; no malware-scanning provider is configured. Existing historical evidence is not retrospectively certified. Public upload allocation/storage quotas remain enforced by existing RPC and bucket policies.

Global response headers restrict framing, object embedding, form destinations, MIME sniffing, referrer disclosure and device permissions. The CSP is deliberately a baseline compatible with Next.js and document previews, not a claim of comprehensive XSS prevention. Use `npm run test:db` for the isolated permission/budget checks. Hosting firewall configuration and live penetration testing remain separate deployment checks.

## Submission and evidence references

Apply `supabase/migrations/20261113000300_readable_references.sql` to enable server-assigned display references: `CP-SUB-YYYY-000001` for submissions, `CP-FND-YYYY-000001` for findings and `CP-EVD-YYYY-000001` for evidence. Findings confirmed from one uploaded report share its submission reference; manual findings receive separate submission references. Numbering uses the record's UTC creation year and atomic database counters. References are unique identifiers, not gapless counts, and can grow beyond six digits.

Existing UUID relationships, routes, finding revisions and stored assessment/report history stay unchanged. The migration backfills current records; new assessment snapshots and generated reports include their references. Earlier immutable assessments keep their original identifiers. The interface falls back to UUIDs until the migration is applied. Do not truncate `cpp_private.reference_counters` during test-data resets. Regenerate the private GitHub CI SQL bundle after adding the migration.
