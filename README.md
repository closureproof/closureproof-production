# ClosureProof

**Evidence before closure.**

ClosureProof helps businesses and reviewers assess whether remediation evidence is sufficient to recommend closing an audit finding. It sits between the original audit and the final closure decision, bringing findings, corrective actions, supporting evidence and review outcomes into one traceable workflow.

The application combines document extraction, structured reviewer judgement and rules-supported assessment. ClosureProof provides a closure-readiness recommendation; the auditor or authorised management retains the final closure decision.

## Product workflow

1. **Submit findings.** Upload a PDF/DOCX audit report and confirm the extracted findings, or enter a finding manually. Each finding can include its own remediation evidence and source metadata.
2. **Inspect and prepare.** Evidence documents are analysed sequentially. Extracted facts retain source references and can be edited or removed. Review preparation produces editable checklist answers, judgements and assessment inputs.
3. **Assess the evidence.** Reviewers work through **Evidence & checklist**, **Gaps & exceptions**, and **Recommendation & report**. Reviews consider scope, root cause, corrective-action effectiveness, coverage, exceptions, operating history and independent retesting where applicable.
4. **Record a recommendation.** Reviewers can use manual assessment or a rules-supported method. The engine evaluates recorded inputs and explains its recommendation; reviewers accept it or document a justified override. Completion validation checks the assessment before saving an immutable snapshot.
5. **Generate the report.** Completed reviews produce a Review Assessment Report or Closure Evidence Pack, with supporting evidence references and downloadable evidence archives.
6. **Follow up.** Reviewers can request additional evidence or scope corrections against a finding. Submitters respond and resubmit for further review. New cycles and assessment revisions preserve earlier evidence, decisions and reports.

Reports group their related findings in the finding register, reviewer queue and evidence library. Submissions, findings and evidence receive readable references while UUIDs maintain internal relationships. Dates are normalised, shared across assessment fields and reconciled with recorded reasons when sources disagree.

## Assessment scope

The current checklist integration focuses on **ISO/IEC 27001:2022**. Review scope uses the selected controls and finding category to show relevant checklist items rather than requiring every task for every finding.

Rules-supported assessment covers ten finding categories, including access management, access reviews, vulnerability remediation and backup restoration. These versioned protocols remain **candidate methods pending independent validation**. Checklist completion alone does not establish closure readiness, and document extraction does not provide independent verification of remediation.

ClosureProof does not perform live infrastructure audits, issue ISO certification, or automatically approve final closure. Provider integrations shown on the website are planned integrations.

## Architecture

The project is an npm-workspace monorepo coordinated by **Turborepo**.

- **Web application:** Next.js App Router, React, TypeScript and Tailwind CSS.
- **Persistence:** Supabase PostgreSQL, checked RPC functions and Supabase Storage.
- **Document processing:** OpenAI integration through server-only Next.js routes for PDF/DOCX extraction and review preparation.
- **Assessment:** A shared TypeScript rules engine with versioned protocols and explicit source mappings.
- **Reporting:** Browser-generated PDFs using jsPDF and local licensed fonts, stored with report metadata and checksums.
- **Demo enquiries:** Server-side Supabase persistence with Resend email notifications.

```text
apps/web/                       Next.js application
  src/app/                      Pages, layouts and server API routes
  src/screens/                  Public website and workspace screens
  src/components/               Shared interface and workflow components
  src/features/                 Review, scope, checklist and date logic
  src/lib/                      API clients, server services and reporting
  public/                       Brand assets and report fonts
  e2e/                          Desktop and mobile browser tests
  scripts/                      Isolated database checks and contract server
packages/assessment-engine/     Rules evaluator and protocol definitions
packages/document-contracts/    Shared extraction contracts and date normalisation
packages/typescript-config/     Shared TypeScript configuration
supabase/tests/                 Isolated database and provider fixtures
```

## Current access model

The workspace remains accessible directly at `/app` without authentication. Records and evidence are shared among workspace visitors; hiding public navigation links does not enforce access control. Reviewer names and independence declarations are self-reported. The public website directs demo requests to `/request-demo`.

Completed assessments and generated reports preserve their original basis. Corrections append revisions rather than overwriting completed records. Review completion and formal closure remain separate events.

## Build and verification

Use Node.js 24, the npm version declared in `package.json`, and the root `package-lock.json`. Run commands from the repository root:

| Command | Purpose |
| --- | --- |
| `npm ci` | Install all workspace dependencies. |
| `npm run typecheck` | Generate route types and check TypeScript. |
| `npm test` | Run component, feature and service unit tests. |
| `npm run test:db` | Run isolated database and migration checks. |
| `npm run test:e2e` | Run desktop and mobile browser workflows. |
| `npm run build` | Produce the Next.js production build through Turborepo. |

Database and browser tests use isolated fixtures. They do not establish independent protocol validation or live-model accuracy.

Environment files and database migrations are distributed separately and remain Git-ignored. Public Supabase settings are browser configuration; service-role, OpenAI and email credentials stay server-only. Brand attribution and font licences remain alongside their assets.

Vercel uses the Next.js preset with `apps/web` as the project root and the default Next.js output directory.
