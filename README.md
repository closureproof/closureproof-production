# ClosureProof

**Evidence before closure.**

ClosureProof is a public pilot for submitting audit findings, uploading corrective-action evidence and recording structured reviews. React and TypeScript provide the interface; Supabase PostgreSQL and Storage persist the records and files. No separate application server is required.

The pilot has no sign-in, protected routes, assigned roles or enforced reviewer-account separation. Everyone using the app shares the pilot workspace. Reviewer names and independence declarations are self-reported. No audit verdict, compliance score, AI assessment or readiness engine is generated.

## Supabase configuration

1. Run [the public pilot SQL](supabase/migrations/20261106000200_public_pilot.sql) in the Supabase SQL Editor. It creates the `cpp_*` tables, public pilot RPC functions, the initial protocol versions and the `closureproof-pilot-evidence` Storage bucket. It can be rerun and creates no sample findings. This migration is standalone.
2. Run [the ISO 27001 checklist migration](supabase/migrations/20261106000300_iso27001_checklists.sql) to install the 153-task source catalogue and mapped `1.0-iso27001` versions of the existing ten templates.
3. Run [the review completion migration](supabase/migrations/20261109000100_review_completion_workflow.sql) to add completed assessments, stored PDF reports, follow-up cycles and recorded final approvals. Existing reviews remain historical records.
4. Run [the control review scope migration](supabase/migrations/20261109000200_control_review_scopes.sql) to enable control selection and scoped completion requirements.
5. Run [the simplified judgement migration](supabase/migrations/20261109000300_simplified_reviewer_judgement.sql) to enable version 2 judgement validation and report template 1.1.
6. Run [the conditional judgement migration](supabase/migrations/20261109000400_conditional_judgement.sql) to validate progressive field requirements and retain earlier schemas.
7. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend environment. `VITE_SUPABASE_ANON_KEY` is also supported. Use only public browser credentials; never a service-role key or database password. Environment files remain ignored.
8. Open the dashboard, submit a finding, attach evidence and record a manual review. No Auth settings, account creation or email confirmation is needed.

The browser key cannot install SQL. Connection failures remain visible and do not create a success message or substitute dummy data. Form fields and protocol choices remain available while a storage problem is resolved.

Earlier `cp_*` and `cpw_*` tables, functions and files are preserved. They are not published through the new pilot or automatically copied into its shared register. The earlier authenticated workspace migration remains historical; it is not required for the public pilot.

## Manual workflow

- Record the finding, owner, source scope, affected resources, root cause and corrective action. AWS IAM is one optional review protocol; submission is generic.
- Upload PDF, PNG, JPG, CSV, JSON or TXT evidence with source metadata. Limits: 25 MB per file, 30 files / 250 MB per finding. Files are unscanned and shared with pilot users.
- Inspect text and image previews or download originals. PDF originals are download-only.
- Open a queue entry directly in its reviewer workspace; evidence inspection and judgements are available there, while uploads remain on the submission/finding page.
- Enter the reviewer name, protocol observations and detailed closure judgements: scope and evidence requirements, root cause/action effectiveness, population coverage, exceptions, operating history/deadlines, retest and outstanding follow-up. Expanded judgements are retained in review snapshots and history.
- Save a draft or select **Complete Review** with a manually selected recommendation: **Not closure ready**, **Implemented but evidence incomplete**, **Ready for retest** or **Closure ready**. Check observations do not automatically determine the recommendation.
- Finding/evidence changes create new revisions. Earlier review snapshots remain in history; the dashboard uses only published or completed recommendations against the current revision.

Completing a review does not formally close a finding or certify an organisation. The workbook’s indicative mappings and category mappings still need qualified review. Spreadsheet import/export and live provider integrations remain future work.

## Completed reviews and follow-up

**Complete Review** validates checklist results, evidence references, detailed judgements, exceptions, population counts, operating dates and retest details. It atomically saves an immutable assessment, activity event and pending report. Repeated completion requests cannot create duplicate assessments. Readiness remains the reviewer’s choice.

The browser generates a **Review Assessment Report** for insufficient-evidence or retest outcomes, or a **Closure Evidence Pack** for a closure-ready recommendation. PDFs use saved snapshots, retain report/assessment IDs and template version, and are stored with a checksum in the existing Supabase bucket. Closure packs provides PDF and ZIP downloads; ZIPs include the report, exact evidence versions and a manifest. Failed or interrupted generation preserves the assessment and offers retry. Generation requires an open browser; no background report server is implied.

Return for Remediation and Request retest record actions, owners and evidence expectations. Requests appear on the finding and in dashboard activity/action notices. Resubmission creates a new numbered cycle; earlier decisions and reports remain available for comparison. Corrections append a linked assessment revision.

**Submit for Final Approval** is available only for a current closure-ready assessment with its report ready. Record the actual decision-maker, supporting reference, decision date/reason and recorder separately. Only an approved decision sets Closed. Rejection requests follow-up; a material change invalidates pending approval. Reopening a closed finding starts a new cycle. These are recorded decisions within the current shared workspace, without verified identities or account roles.

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

Database tests execute PostgreSQL/WASM SQL, including an account-free pilot schema and preservation of the historical schemas. Browser tests use an isolated PostgreSQL-backed Supabase contract fixture to check public navigation, submission, upload/download, review completion, report retry/download, assessment corrections, resubmission, approval decisions, dashboard population and stale-review history on desktop/mobile. They do not prove the remote project's complete Storage implementation. `check:supabase` checks the live public schema without creating user records or files.

Netlify publishes `frontend/dist`; configure the public Supabase environment values there. SQL fixtures under `supabase/tests/` are test-only and must not be run in the real project.

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
