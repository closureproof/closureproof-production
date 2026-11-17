# Closure-readiness assessment engine

This package evaluates finding-specific, reviewer-confirmed inputs. It recommends closure readiness; it does not certify ISO compliance, discover infrastructure issues or grant final closure approval.

## Code map

- `src/review-contracts.ts`: provider-neutral draft schemas, shared fields and outcome labels.
- `src/readiness-rules.ts`: common scope, implementation, cause, evidence, coverage, exception, operating-period and retest rules.
- `src/protocol-catalogue.ts`: ten category definitions, explicit checklist mappings and category-specific requirements. The persisted finding category selects its method.
- `src/aws-iam.ts`: AWS IAM candidate definition and compatibility exports for earlier integrations. This is one method, not the engine's universal entry point.
- `src/checklist-mapping.ts`: generic mapping evaluator. Unmapped scoped tasks remain unknown; source-specific requirements are not silently generalised.
- `src/index.ts`: evaluation and decision tracing; `src/contracts.ts`: typed inputs, versions and provenance.
- `src/publication.ts`: protocol publication tooling; registration and completion are controlled by server routes and database RPCs.

## Method coverage

| Category | Method scope |
| --- | --- |
| `aws-iam` | AWS IAM privileged access |
| `access` | Periodic access reviews |
| `leavers` | Joiner, mover and leaver access |
| `mfa` | MFA enforcement |
| `patch` | Vulnerability and patch remediation |
| `backup` | Backup restoration testing |
| `supplier` | Supplier security review |
| `logging` | Security logging and monitoring |
| `changes` | Change management and approval |
| `incidents` | Incident response and follow-up |

Generic category names do not mean every source checklist item applies to every provider. Imported tasks can explicitly require AWS configuration. The finding's pinned controls and task scope determine applicable checks; other environments require appropriate scope and supporting evidence. No live AWS, Azure, GCP or identity-provider connector is implied.

All ten methods remain candidate definitions awaiting independent validation. No universal observation period or compliance score is assumed. Unknown facts remain unknown. Document interpretation prepares editable inputs; it does not independently establish remediation effectiveness.

## Verification and compatibility

Run `npm test`, `npm run typecheck` and `npm run build` from the repository root. Tests under `apps/web/src/features/` exercise all ten methods, scoped mappings, missing evidence, four recommendation outcomes and cross-category draft rejection. `engine-baseline.test.ts` pins the pre-refactor definitions so this structural cleanup cannot silently change registered versions or saved assessment semantics. Historical snapshots and generated reports remain unchanged.
