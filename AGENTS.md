# Production Safety Rules for Codex

This repo is treated as production. Avoid back-and-forth breakages.

Before making any code change, follow these rules:

1. Scope first

Every task must start by identifying the exact module being changed.

Use this format:

Scope:
Only touch this module: [module name]

Do not touch:
Smart Pages, NFC, Reports, Students, Photos, Auth, Settings, unless directly required.

If a requested fix requires touching another module, explain why before making the change.

2. Do not make broad unrelated edits

Do not refactor unrelated files.
Do not polish unrelated UI.
Do not rename routes, tokens, roles, or shared helpers unless required by the task.
Do not change Smart Pages while fixing NFC.
Do not change NFC while fixing Smart Pages.
Do not change Auth unless the task is explicitly about Auth.
Do not change Settings unless the task is explicitly about Settings.

3. Protect completed flows

Before committing, make sure these critical flows are not broken:

* Admin login
* Gate Security login redirects to `/nfc/gate`
* Gate Security can access `GET /api/nfc/gate`
* Gate Security can scan using `POST /api/nfc/gate/scan`
* Gate Security cannot access `/api/settings`
* Student list loads
* Student passport photo upload uses school auth
* Smart Pages upload starts extraction
* Smart Pages public page loads
* Smart Pages PDF download works
* Report preview loads
* Build passes

4. Tests after every change

After every change, run:

* affected tests for the module changed
* critical smoke tests
* build

Use:

```powershell
npm run build
```

If `test:critical` exists, run:

```powershell
npm run test:critical
```

If `test:critical` does not exist yet, create it as a follow-up or run the closest existing tests for Auth, NFC Gate, Students, Smart Pages public/PDF, and Reports.

5. Commit rule

Do not commit if:

* build fails
* affected tests fail
* a critical smoke flow fails
* an unrelated module was changed accidentally

6. Response format

When finishing a task, report:

* Files changed
* Module touched
* Tests run
* Build result
* Any risks or skipped checks

This instruction is mandatory for all future Codex work in this repo.
