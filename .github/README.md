# ClosureProof CI

`workflows/ci.yml` runs on every branch push, pull requests targeting `main`, `staging` or `stagging`, and manual dispatch. Commands run from the monorepo root with Node 24, npm 11.6.2 and the root lockfile.

## GitHub setup

1. Create the GitHub environment **`stagging`** under Settings → Environments. This is the exact spelling used by the workflow. Permit the branches you want tested; add required reviewers only if you want a manual approval before integration tests.
2. Migrations are intentionally Git-ignored. Run `npm run ci:prepare-sql` locally. Add the contents of each generated `docs/private/github-ci/CI_SQL_BUNDLE_1.txt` through `CI_SQL_BUNDLE_4.txt` as same-named **environment secrets** in `stagging`. Each chunk fits GitHub's secret-size limit. Do not commit these files. Regenerate the bundle after migration changes.
3. Push the workflow and CI helper scripts. Push later work to a `staging` branch (or another feature branch) and wait for **Ready for review** before opening a PR to `main`.
4. Configure a ruleset/branch protection for `main`: require a pull request and the **Ready for review** status check. This check appears after the workflow has run. CI itself cannot prevent someone opening a PR early; required status checks prevent merging failures.

If GitHub CLI is already authenticated to the intended repository, you can upload the four chunks yourself after creating the environment:

```sh
for part in 1 2 3 4; do
  gh secret set "CI_SQL_BUNDLE_$part" --env stagging < "docs/private/github-ci/CI_SQL_BUNDLE_$part.txt"
done
```

No Supabase, OpenAI, Resend or Vercel credentials are required by CI. SQL checks run in PGlite; browser tests start local Supabase/provider contract fixtures. The environment name does not create a hosted staging app or database.

## Checks and artifacts

- Quality: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
- Integration: restore SQL bundle, `npm run test:db`, install Google Chrome with OS dependencies, `npm run test:e2e` across desktop and mobile.
- Gate: both jobs must succeed. Missing/stale SQL bundles and skipped integration tests cannot produce a successful gate.
- Browser HTML reports and failure traces are retained for seven days. CI retries browser failures once and rejects focused (`test.only`) tests.

Fork PRs run quality checks without environment secrets. Integration is skipped and the gate fails until the maintainer tests the change from a trusted repository branch. Never use `pull_request_target` to run untrusted PR code with secrets.

Vercel deployment is separate. Keep its Production Branch as `main` and use preview deployments for `staging` if desired. This workflow does not deploy, alter live databases, send email, or wait for a Vercel deployment. Existing Vercel Git integration may start a preview independently of CI.
