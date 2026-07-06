# Codex Workflow

## Working rules for Codex in SSAMENJ repos

- Read `AGENTS.md` and `docs/ssamenj-playbook/00-index.md` before changing code.
- Summarize the planned change before making large edits.
- Keep diffs small and scoped.
- Do not make broad refactors unless the task explicitly needs them.
- Preserve tenant isolation, auth, permissions, audit logs, upload safety, and safe errors.
- Prefer reusable components and tokens over page-specific styling when the same pattern repeats.
- Run targeted tests for the changed area.
- Run the build before handoff for larger changes.

## Reporting rules

- Report files changed.
- Report the module touched.
- Report tests run.
- Report the build result.
- Report risks or skipped checks.
- Report follow-up recommendations when a standard is not yet implemented.

