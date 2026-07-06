# Product Principles

SSAMENJ products should behave like operator-first school systems, not like generic consumer apps.

## Rules

- Mobile-first is mandatory.
- Admins approve, operators operate.
- Dashboards must show what is pending, what needs action, what changed today, and what can go wrong.
- Dangerous actions need confirmation before they commit.
- Empty, loading, error, and permission states are required for every module.
- Communication that reaches parents, guardians, or schools should be WhatsApp-friendly where relevant.
- Uganda-first rules apply wherever local context matters: terminology, phone formats, time zones, and school workflows should feel native.
- Clean SaaS dashboard styling is the default visual posture.
- Keep the interface calm, measurable, and action-oriented.

## What this means in practice

- The first screen should tell the operator what to do next.
- Progress should be visible through counts, statuses, and workflow stages.
- Error states should explain the failure without exposing internals.
- Permission failures should tell the user what access is missing, not dump raw authorization noise.
- When a workflow can destroy data, reverse a release, or charge money, it needs a guardrail and a reason field.

## Dashboard language standard

- Prefer verbs and status labels over abstract labels.
- Prefer "pending", "needs review", "approved", "released", and "blocked" over marketing language.
- Show actionable counts instead of vanity metrics alone.

