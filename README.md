# ClosureProof

**Evidence before closure.**

ClosureProof is a public pilot for submitting audit findings, uploading corrective-action evidence and recording structured human reviews. React and TypeScript provide the interface; Supabase PostgreSQL and Storage persist the records and files. No separate application server is required.

The pilot has no sign-in, protected routes, assigned roles or enforced reviewer-account separation. Everyone using the app shares the pilot workspace. Reviewer names and independence declarations are self-reported. No audit verdict, compliance score, AI assessment or readiness engine is generated.

## Supabase configuration

1. Run [the public pilot SQL](supabase/migrations/20261106000200_public_pilot.sql) in the Supabase SQL Editor. It creates the `cpp_*` tables, public pilot RPC functions, the initial protocol versions and the `closureproof-pilot-evidence` Storage bucket. It can be rerun and creates no sample findings. This migration is standalone.
2. Run [the ISO 27001 checklist migration](supabase/migrations/20261106000300_iso27001_checklists.sql) to install the 153-task source catalogue and mapped `1.0-iso27001` versions of the existing ten templates.
3. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend environment. `VITE_SUPABASE_ANON_KEY` is also supported. Use only public browser credentials; never a service-role key or database password. Environment files remain ignored.
4. Open the dashboard, submit a finding, attach evidence and record a manual review. No Auth settings, account creation or email confirmation is needed.

The browser key cannot install SQL. Connection failures remain visible and do not create a success message or substitute dummy data. Form fields and protocol choices remain available while a storage problem is resolved.

Earlier `cp_*` and `cpw_*` tables, functions and files are preserved. They are not published through the new pilot or automatically copied into its shared register. The earlier authenticated workspace migration remains historical; it is not required for the public pilot.

## Manual workflow

- Record the finding, owner, source scope, affected resources, root cause and corrective action. AWS IAM is one optional review protocol; submission is generic.
- Upload PDF, PNG, JPG, CSV, JSON or TXT evidence with source metadata. Limits: 25 MB per file, 30 files / 250 MB per finding. Files are unscanned and shared with pilot users.
- Inspect text and image previews or download originals. PDF originals are download-only.
- Open a queue entry directly in its reviewer workspace; evidence inspection and judgements are available there, while uploads remain on the submission/finding page.
- Enter the reviewer name, protocol observations and detailed closure judgements: scope and evidence requirements, root cause/action effectiveness, population coverage, exceptions, operating history/deadlines, retest and outstanding follow-up. Expanded judgements are saved in the existing review JSON and displayed in review history; no additional SQL migration is required.
- Save a draft or publish a manually selected recommendation: **Not closure ready**, **Implemented but evidence incomplete**, **Ready for retest** or **Closure ready**. Check observations do not automatically determine the recommendation.
- Finding/evidence changes create new revisions. Earlier review snapshots remain in history; the dashboard uses only published recommendations against the current revision.

Publishing a recommendation does not formally close a finding or certify an organisation. The workbook’s indicative mappings and the proposed category mappings still need qualified review. Formal closure packs, spreadsheet import/export and live provider integrations remain future work.

## Workspace sections

“See how it works” opens `/app` directly. `/dashboard.html`, `/preview` and `/workbench` remain aliases. The original dashboard design and sidebar destinations are retained: overview, findings, evidence library, manual upload, closure protocols, reviewer queue, decision history, closure packs, integrations, participants and organisation settings.

Dashboard counts, finding rows and recent activity come from saved pilot submissions. Records refresh after mutations, on focus and periodically. No sample findings or automatic scores populate the interface.

The public pilot permits anyone using the app to read, submit, edit and manually review pilot records and download submitted evidence. It does not establish verified identity, authorisation or independent review. Original-file replacement remains versioned, and stale-revision checks prevent silently publishing against changed evidence. Use test material suitable for sharing.

## Public website

Navy/blue/white branding and rounded controls remain. Demo enquiries use `VITE_DEMO_REQUEST_URL` and the separate [demo-request migration](supabase/migrations/20261105000100_create_demo_requests.sql). The survey opens Google Forms in a new tab. Providers remain **Planned integration**; only their logos scroll, with hover/focus pause and reduced-motion support.

## Development and validation

```sh
npm --prefix frontend ci
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run test:db
npm --prefix frontend run test:e2e
npm --prefix frontend run check:supabase
npm --prefix frontend run build
```

Database tests execute PostgreSQL/WASM SQL, including an account-free pilot schema and preservation of the historical schemas. Browser tests use an isolated PostgreSQL-backed Supabase contract fixture to check public navigation, submission, upload/download, manual publication, dashboard population and stale-review history on desktop/mobile. They do not prove the remote project's complete Storage implementation. `check:supabase` checks the live public schema without creating user records or files.

Netlify publishes `frontend/dist`; configure the public Supabase environment values there. SQL fixtures under `supabase/tests/` are test-only and must not be run in the real project.

## ISO 27001 checklist-backed reviews

The ten existing finding categories are retained. Their new template versions map relevant items from the supplied workbook into each review. The full library contains 153 ISO 27001-tagged tasks and 626 source steps; SOC 2-only and ISO 27701-only rows are excluded. Task IDs, evidence descriptions, requirement labels, source frequencies, steps and page references are retained. Vendor-specific source instructions remain labelled; equivalent evidence may be inspected without integrating the named vendor.

New findings pin the mapped checklist version. Existing findings keep their original checklist until a reviewer selects **Apply selected checklist**. Reviewers can use category defaults or choose additional tasks from the full library. A changed checklist creates a new finding revision, retains evidence and earlier review snapshots, and invalidates prior recommendations against the changed basis. An unchanged scope creates no extra revision.

Checklist observations remain separate from the existing detailed closure-judgement sections and manually selected readiness recommendation. Source “Required” labels are not universal closure requirements; applicability must be reviewed for each finding. The catalogue is not a claim of complete ISO certification coverage. The separate benchmark remains under ignored documentation.
