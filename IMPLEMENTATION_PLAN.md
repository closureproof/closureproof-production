# Public pilot integration

The active app uses one shared public Supabase workspace. No sign-in, protected routes, account onboarding, assigned roles or enforced reviewer-account separation. Preserve the original dashboard and all sidebar sections. Do not restore dummy findings or add an assessment engine.

Implemented: public manual finding creation/editing, original-file upload/download/inspection, structured human reviews with self-declared names, manually selected recommendations, revision tracking, retained review snapshots and live-data dashboard population. The standalone migration `20261106000200_public_pilot.sql` creates `cpp_*` tables/RPCs and `closureproof-pilot-evidence`. Earlier `cp_*` / `cpw_*` records and files remain unchanged and are not exposed in the public pilot.

Validation includes PostgreSQL/WASM tests with no auth schema or accounts, isolated desktop/mobile browser workflows and read-only live-project schema/navigation checks. Local contract tests do not by themselves establish remote upload/review success.

Formal closure packs, spreadsheet imports/exports, live provider integrations, scanning and production identity/permissions remain future scope. No automatic audit verdict, readiness calculation or numerical score is implemented.
