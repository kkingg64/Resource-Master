# Release Notes - v1.2.0

Release date: 2026-03-24
Branch: `release/v1.2.0`
Target production branch: `main`

## Summary
This release focuses on planner reliability, cleaner planner toolbar UX, and executive reporting/export capabilities for stakeholder updates.

## Highlights
- Planner timeline now auto-fits to assignment date range (with buffer), reducing manual timeline adjustments.
- Planner top bar redesigned for a cleaner, more elegant interaction model.
- Core toolbar actions were simplified with icon-first controls and improved stacking behavior for filter/toggle menus.
- Added project/module/task-level "Clear Actual Dates" actions from planner context menus.
- Improved optimistic update reliability with rollback on API failures across key update flows.
- Added Dashboard Executive Summary section.
- Added one-click `Export 1-Slide PNG` for PPT usage.
- Added `Export Summary TXT` for wording-based project + timeline summaries.

## Reliability and Data Integrity
- Added rollback handling when persistence fails for:
  - Assignment dependency updates
  - Assignment schedule updates
  - Assignment progress updates
  - Assignment resource updates
  - Planner allocation updates
  - Reorder operations (modules, tasks, assignments)

## Reporting / Export
- New executive KPI snapshot in Dashboard.
- Export options:
  - PNG slide export (16:9) for management presentations.
  - Text summary export for email, minutes, or AI-assisted narrative editing.

## Build and Verification
- `npm run build` passed locally on this release branch.
- Type check/problems panel shows no blocking errors in updated files.

## Supabase / Database Changes
No mandatory Supabase SQL migration is required for this release.

Rationale:
- Changes are primarily UI/UX, local export, and client-side behavior.
- New reporting/export features read existing entities and do not require schema extension.
- Existing write paths use current tables/columns already referenced by the app.

## Deployment Notes
- Vercel deployment trigger: push this release into `main`.
- Post-deploy smoke checks:
  - Planner toolbar filter/toggle dropdown visibility
  - Timeline auto-fit behavior
  - Baseline save/delta toggles
  - Executive Summary rendering
  - PNG and TXT export flows

## Rollback
If needed:
1. Revert merge commit on `main`, or
2. Redeploy previous production commit in Vercel.
