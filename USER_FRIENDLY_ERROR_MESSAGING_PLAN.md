# User-Friendly Error Messaging Implementation Plan

## Summary

DocTrack should stop showing developer-oriented error language in any user-visible part of the app. Messages such as `SQLite Error`, `SqliteError`, `UNIQUE constraint failed`, `Error invoking remote method`, service-availability internals, and other low-level system wording should never appear in notifications, inline validation areas, dialog error states, boot errors, or maintenance flows.

The implementation should introduce one consistent error-presentation policy that converts raw failures into calm, plain-language, action-oriented messages. Technical details should remain available for debugging and developer investigation, but they should not be rendered directly to end users.

This plan is intentionally decision-complete so another AI agent or engineer can implement it without needing to choose the architecture, scope, or behavior policy.

## Goals

- Make every user-visible error message understandable to a non-technical user.
- Centralize error sanitization and presentation so the app behaves consistently.
- Preserve useful domain-specific messages that are already user friendly.
- Prevent low-level transport, database, and filesystem implementation details from leaking into the UI.
- Preserve technical diagnostics for debugging without exposing them in normal UI copy.
- Maintain backwards compatibility for existing workspaces and persisted data.

## Non-Goals

- Do not redesign the notification component visually.
- Do not add new workspace schema changes, migrations, or persisted settings.
- Do not add a user-facing “show technical details” control in this pass.
- Do not rewrite every service error string if the same outcome can be achieved centrally.
- Do not weaken existing validation or permission checks.

## Current State In Repo

The current repo already has a partial sanitization layer:

- [src/renderer/src/lib/utils.ts](/Users/zaferaltan/Developer/GitHub/DocTrack/src/renderer/src/lib/utils.ts:1) contains `formatUserFacingError`.
- That helper currently removes Electron IPC wrapper text and leading `Error:` prefixes in production mode.
- [src/renderer/src/App.tsx](/Users/zaferaltan/Developer/GitHub/DocTrack/src/renderer/src/App.tsx:1835) wraps it through `getErrorMessage(...)`.
- `notifyError(...)` in [src/renderer/src/App.tsx](/Users/zaferaltan/Developer/GitHub/DocTrack/src/renderer/src/App.tsx:2289) is the central notification path.
- The same helper is also used for some inline error states, boot errors, sign-in errors, repair flows, and access-recovery flows.
- There is already at least one regression test ensuring a raw `SqliteError` does not appear in the recovery UI in [src/renderer/src/App.test.tsx](/Users/zaferaltan/Developer/GitHub/DocTrack/src/renderer/src/App.test.tsx:3488).

The gap is that the current helper is string-only, production-only in practice, lightly sanitized, and not opinionated enough to normalize the full set of user-visible errors across the app.

## Required Outcome

After implementation:

- No user-visible error string anywhere in the app may contain storage-engine jargon like `SQLite`, `SqliteError`, or `constraint failed`.
- No user-visible error string may contain transport jargon like `Error invoking remote method`.
- No user-visible error string may expose internal service labels such as `workspace user service is unavailable`.
- Friendly domain messages such as “Incorrect username or password.” or “This document type is already used by documents and cannot be deleted.” should still appear as-is when appropriate.
- All error surfaces should use the same sanitization and presentation policy.
- Raw technical details must remain available in logs/devtools for debugging.

## Scope

This plan covers all user-visible error surfaces in the renderer, including:

- Global notifications/toasts via `setNotification(...)` and `notifyError(...)`
- Inline form and dialog error states in `App.tsx`
- Boot-time error messages such as `bootError`
- Authentication and access recovery error states
- Maintenance, repair, integrity, backup, restore, and update flows
- Any other renderer state that currently stores a message produced by `getErrorMessage(...)`

This plan also covers normalization at the main-process and IPC boundary where that materially improves consistency.

## Backwards Compatibility Requirements

This repo’s `AGENTS.md` explicitly requires backwards compatibility. For this task, that means:

- Do not modify workspace schemas.
- Do not add or alter migrations.
- Do not change on-disk workspace formats.
- Do not change successful behavior for existing workspaces.
- Restrict the change to error modeling, formatting, and presentation behavior.
- If a service currently throws a user-friendly domain error, preserve that message unless standardization requires a wording update that does not change meaning.

Because this work does not require persistence changes, no migration strategy is needed. The implementation should remain fully compatible with older workspaces and previously stored data.

## Implementation Strategy

### 1. Replace the string-only formatter with a structured error presentation helper

Create a central helper in the renderer layer, replacing the current “sanitize a string and return a string” design with a structured result.

The helper should live alongside the existing renderer utility code, likely by evolving [src/renderer/src/lib/utils.ts](/Users/zaferaltan/Developer/GitHub/DocTrack/src/renderer/src/lib/utils.ts:1) or splitting dedicated error logic into a new file such as `src/renderer/src/lib/errors.ts`.

Required interface:

```ts
interface UserFacingErrorResult {
  userMessage: string;
  diagnosticMessage?: string;
  code?: string;
}

function formatUserFacingError(
  error: unknown,
  fallbackMessage: string,
  options?: {
    isDevelopment?: boolean;
  }
): UserFacingErrorResult;
```

Behavior rules:

- Always return `userMessage`.
- `diagnosticMessage` should contain the most useful raw technical detail available, if any.
- `code` is optional, but if introduced it should be a stable app-level code such as `duplicate_record`, `not_found`, `permission_denied`, `invalid_input`, `filesystem_conflict`, `network_failure`, or `unknown`.
- The visible UI should always use `userMessage`.
- Debug logging may use `diagnosticMessage` or the original `error`.

Compatibility step:

- Add a thin compatibility wrapper if needed:

```ts
function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return formatUserFacingError(error, fallbackMessage).userMessage;
}
```

- Migrate call sites incrementally, but the final state should make it easy for all renderer error surfaces to use the structured result.

### 2. Add deterministic sanitization rules

The formatter must normalize the following categories before deciding what the user should see.

#### Transport wrapper cleanup

Strip wrappers such as:

- `Error invoking remote method '...':`
- repeated `Error:` prefixes
- equivalent wrapper chains that occur when Electron IPC rethrows or wraps exceptions

#### Database jargon cleanup

Remove or translate messages containing:

- `SqliteError:`
- `SQLite Error:`
- `UNIQUE constraint failed: ...`
- `FOREIGN KEY constraint failed`
- similar better-sqlite3 low-level phrasing

The formatter must never surface those raw strings directly to end users.

#### Internal service wording cleanup

Translate messages such as:

- `Workspace user service is unavailable.`
- `Workspace role service is unavailable.`
- `Workspace session service is unavailable.`

into generic app-safe messages such as:

- `That action is temporarily unavailable. Please try again.`

or, if a better action-specific fallback exists, use the provided fallback instead.

#### Filesystem and path jargon cleanup

Detect low-level path/storage wording and prefer user-oriented phrasing. Examples:

- “must stay inside the workspace folder”
- “could not be found on disk”
- “symbolic links or junctions”

These may remain somewhat specific if they are already comprehensible, but must avoid sounding like implementation errors. Prefer copy that explains the user constraint, not the system mechanism.

### 3. Add classification before display

The formatter should classify the error before choosing the final visible message.

Suggested classification order:

1. If the message is already clearly user friendly, preserve it.
2. If the message matches a known low-level pattern, map it to a stable user-safe message and optional code.
3. If the message is technical or ambiguous, use the action-specific fallback message.
4. If the input is not an `Error` or contains no useful message, use the fallback message.

Heuristics for “already user friendly”:

- Short plain-language sentences
- No stack traces
- No engine/framework class names
- No SQL terminology
- No IPC method wrappers
- No internal module/service names

Examples:

- Preserve: `Incorrect username or password.`
- Preserve: `A workspace user with the username "admin" already exists.`
- Preserve: `Select at least one file to add.`
- Replace with friendly conflict wording: `UNIQUE constraint failed: WorkspaceUsers.Username`
- Replace with fallback: `Workspace user service is unavailable.`

### 4. Use stable app-level mapping for common low-level failures

Implement a small mapping table in the formatter or a shared error helper module. This mapping should not depend on exact one-off call sites in `App.tsx`.

Required mapped categories and default messages:

- Duplicate record / unique constraint:
  - Default: `That value is already in use. Choose a different one and try again.`
- Missing record / missing target:
  - Default: `The selected item could not be found. Refresh and try again.`
- Permission denied / session required:
  - Default: `You do not have permission to do that.`
  - Preserve more specific domain permission messages if they are already user friendly.
- Validation error:
  - Preserve domain validation messages if already user friendly.
- Filesystem conflict:
  - Default: `A file or folder with that name already exists.`
- Network/update/download issue:
  - Default: `DocTrack could not complete that online action right now. Please try again.`
- Unknown/internal failure:
  - Default: use the caller-provided fallback.

When the main process already throws a better domain message than the default, prefer the domain message.

### 5. Keep diagnostics out of the UI but available to developers

The visible app must only render `userMessage`.

Implementation requirements:

- `notifyError(...)` should set notifications using only `userMessage`.
- Inline dialog/form error state should store only `userMessage` for display.
- The renderer should log the original error object or `diagnosticMessage` in development.
- Production behavior may still log to console if the project already allows that, but no production UI should render the raw detail.

Do not add a new user-facing diagnostics drawer in this pass.

### 6. Normalize at IPC/service boundaries only where it materially improves consistency

The main process already throws many user-friendly domain errors. Those should generally remain in place.

Implementation rule:

- Do not rewrite all service files just for stylistic consistency.
- Only adjust main-process throwing behavior when a low-level error would otherwise leak through and a stable translation belongs closer to the source.

Recommended boundary behavior:

- Catch recognized better-sqlite3 or low-level persistence failures in service or IPC layers when needed.
- Translate them into domain-safe `Error` messages before they cross into the renderer.
- Preserve the original error as a cause when practical, but only if doing so does not complicate the codebase excessively.

If shared typing is added, it should be minimal:

- A shared `AppErrorCode` union in `src/shared` is acceptable if needed.
- Do not introduce a large exception framework.

### 7. Refactor renderer call sites to use the centralized result consistently

The app currently uses `getErrorMessage(...)` broadly in [src/renderer/src/App.tsx](/Users/zaferaltan/Developer/GitHub/DocTrack/src/renderer/src/App.tsx:1835). The implementation should ensure every user-visible error in that file flows through the same policy.

Required renderer integration points:

- `notifyError(...)`
- `bootError`
- repair/integrity flow error objects
- access recovery states
- sign-in states
- dialog submit failure states
- any direct `setNotification({ tone: "error", message: ... })` usage

Required cleanup:

- Remove any direct use of raw `error.message` in renderer-visible state if present.
- Do not duplicate per-call-site sanitization regexes or string replacements.

### 8. Preserve good existing domain messages

Many current service messages are already suitable for users. The implementation should not flatten these into generic copy.

Examples to preserve:

- `Incorrect username or password.`
- `This user is currently inactive.`
- `A template with that name already exists.`
- `The selected document could not be found.`
- `Select at least one file to add.`
- `Create a version before editing the latest version.`

The objective is not genericity. The objective is friendliness and consistency.

### 9. Keep wording guidelines explicit

Use these copy rules when creating or replacing user-visible messages:

- Use plain language.
- Prefer one short sentence, or two if the second gives a helpful next step.
- Avoid engine/framework names.
- Avoid nouns like `constraint`, `remote method`, `service unavailable`, `exception`, `invoke`, `IPC`, `SQLite`, `junction`.
- Prefer “could not” or “unable to” for failures.
- When helpful, tell the user what to do next:
  - try again
  - refresh and try again
  - choose a different name
  - sign in to continue
- Keep a calm tone and avoid blame.

## File-Level Implementation Guidance

This section gives the implementer precise integration guidance without forcing unnecessary file churn.

### Renderer utility layer

Primary edit target:

- [src/renderer/src/lib/utils.ts](/Users/zaferaltan/Developer/GitHub/DocTrack/src/renderer/src/lib/utils.ts:1)

Preferred change:

- Move error formatting into a dedicated block or a new helper file if that keeps the utility module readable.
- Add pattern matching, classification, and structured return values here.

### Renderer application layer

Primary edit target:

- [src/renderer/src/App.tsx](/Users/zaferaltan/Developer/GitHub/DocTrack/src/renderer/src/App.tsx:1835)

Required changes:

- Update `getErrorMessage(...)` or replace it with a structured wrapper.
- Update `notifyError(...)` to use the structured helper.
- Ensure all inline/form/boot/repair error assignments rely on the same user-facing formatting path.
- Add development logging in the central path instead of scattered logs.

### Optional shared typing

Potential edit target if needed:

- `src/shared/...`

Only add shared types if they clearly reduce duplication between main and renderer. Keep this small and focused.

### Main-process boundary normalization

Potential edit targets if needed:

- [src/main/ipc.ts](/Users/zaferaltan/Developer/GitHub/DocTrack/src/main/ipc.ts:1)
- specific service files that currently let low-level persistence errors bubble up

Rule:

- Catch and normalize only where raw low-level errors would otherwise bypass the renderer mapping or where a source-level translation is clearer and safer.

## Detailed Behavior Rules

### Renderer display rule

Every renderer display surface must render only the sanitized `userMessage`.

### Fallback rule

If the system cannot confidently determine a user-friendly replacement, use the action-specific fallback supplied by the call site.

Examples:

- `Unable to save workspace settings.`
- `Unable to delete template.`
- `Unable to open workspace.`

These are preferable to showing technical internals.

### Duplicate-name rule

If the raw message identifies a duplicate conflict but does not include safe human wording, the formatter should return a friendly conflict message. If the existing message already names the conflicting value in a user-friendly way, preserve it.

### Permission rule

If the error is already phrased as a user-facing permission requirement, keep it. Examples:

- `Sign in to continue.`
- `Workspace settings access is required for this action.`

If the message is too internal, convert it to a more general message.

### Development mode rule

The current implementation shows raw messages in development mode. That behavior should change.

New rule:

- Development mode should still show the same user-facing message as production in the UI.
- Development mode may additionally log the raw detail to the console.

Reason:

- Developers and QA should test the same UI users will see.
- Raw diagnostics belong in logs, not in visible app copy.

This is an intentional behavior change and should be included in tests.

## Testing Plan

### Unit tests for formatter behavior

Update and expand:

- [src/renderer/src/lib/utils.test.ts](/Users/zaferaltan/Developer/GitHub/DocTrack/src/renderer/src/lib/utils.test.ts:1)

Required test cases:

1. Strips Electron IPC wrapper text.
2. Strips repeated `Error:` prefixes.
3. Rewrites `SqliteError: UNIQUE constraint failed: WorkspaceUsers.Username` into a friendly message.
4. Rewrites `SQLite Error:` variants into a friendly message.
5. Preserves friendly domain messages unchanged.
6. Falls back to the caller-provided fallback when the message is empty or unusable.
7. Returns the same visible `userMessage` in development and production modes.
8. Retains diagnostic detail separately when available.

### App-level integration tests

Update and expand:

- [src/renderer/src/App.test.tsx](/Users/zaferaltan/Developer/GitHub/DocTrack/src/renderer/src/App.test.tsx:3488)

Required scenarios:

1. Existing recovery test continues to assert that raw `SqliteError` is not shown.
2. Add a toast/notification-path test where a raw technical error becomes friendly notification text.
3. Add an inline form error test for sign-in, recovery, or settings save that confirms sanitized copy is shown.
4. Add at least one repair, backup, or update flow test where a raw low-level message is converted before rendering.
5. Add a development-mode-oriented test if feasible, proving UI copy stays user-friendly even when diagnostics exist.

### Optional main-process tests

If any normalization is added in the main process, add focused tests near the edited boundary rather than broad end-to-end coverage.

## Acceptance Criteria

The task is complete only when all of the following are true:

- No user-visible error surface in the app displays raw database jargon, IPC wrappers, or internal service wording.
- Global notifications use the centralized user-friendly formatter.
- Inline form and dialog error states use the same centralized formatter.
- Development mode no longer shows raw technical messages in the visible UI.
- Friendly domain messages already in the codebase still appear intact where appropriate.
- Technical details remain accessible in logs/devtools.
- Existing workspace data remains fully compatible and accessible.
- Tests cover both formatter-level behavior and representative UI flows.

## Suggested Implementation Order

1. Refactor the renderer error formatter to return structured results.
2. Add classification and sanitization rules with tests.
3. Update `getErrorMessage(...)` and `notifyError(...)` in `App.tsx`.
4. Sweep all renderer user-visible error assignments so they use the centralized result.
5. Add development logging in the centralized path.
6. Add or adjust source-boundary normalization only where low-level errors still leak through.
7. Expand UI integration tests to cover notifications, inline errors, and one maintenance/update flow.

## Risks And Mitigations

### Risk: Over-sanitizing useful domain messages

Mitigation:

- Preserve any message that is already short, plain-language, and action-safe.
- Add tests that explicitly verify good existing messages remain unchanged.

### Risk: Inconsistent behavior between notification and inline states

Mitigation:

- Route both through the same helper.
- Avoid separate regex cleanup in individual components or handlers.

### Risk: Losing debugging detail

Mitigation:

- Keep `diagnosticMessage` or log the original error object.
- Do not rely on the visible UI to carry developer diagnostics.

### Risk: Hidden backwards-compatibility impact

Mitigation:

- Keep the change isolated to error handling and presentation.
- Do not touch migrations, workspace schemas, or on-disk structures.

## Default Decisions Locked For Implementation

These decisions are already made and should not be reopened during implementation unless the user explicitly asks:

- Scope is all user-visible error surfaces, not only notifications.
- Technical details are hidden by default from users.
- Diagnostics are preserved through logs/devtools, not a new visible UI affordance.
- Centralized formatting is the primary strategy.
- Main-process normalization is secondary and should only be added where it materially prevents leakage.
- No schema or migration changes are part of this work.

## Deliverable

The implementation deliverable should be a centralized, tested, backwards-compatible user-friendly error messaging system that makes DocTrack feel polished and non-technical for end users while keeping debugging practical for developers.
