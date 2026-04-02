# DocTrack

DocTrack is an offline-first desktop application for managing controlled document workspaces. It combines a local SQLite database with a predictable folder structure so document metadata, version history, managed files, templates, and recovery snapshots stay together in a single portable workspace.

The application is built with Electron, React, TypeScript, and SQLite. Packaged releases are configured for Windows and macOS, and the source code can be run locally for development with Node.js.

## Contents

- [Overview](#overview)
- [Current Scope](#current-scope)
- [Core Capabilities](#core-capabilities)
- [Technology Stack](#technology-stack)
- [Workspace Model](#workspace-model)
- [Document Model](#document-model)
- [Document IDs, Versions, and Storage Layout](#document-ids-versions-and-storage-layout)
- [File Tracking and Reconciliation](#file-tracking-and-reconciliation)
- [Catalogs, Templates, Dashboards, and Exports](#catalogs-templates-dashboards-and-exports)
- [Backups, Restore, and Integrity Checks](#backups-restore-and-integrity-checks)
- [Requirements](#requirements)
- [Development Quick Start](#development-quick-start)
- [Available Scripts](#available-scripts)
- [Repository Structure](#repository-structure)
- [Architecture Notes](#architecture-notes)
- [Database and Migrations](#database-and-migrations)
- [Packaging and Updates](#packaging-and-updates)
- [Contributor Notes](#contributor-notes)
- [Troubleshooting](#troubleshooting)

## Overview

DocTrack is designed for teams or individuals who need structured document control without depending on a hosted service. Each workspace is stored as a normal folder on disk and can be copied, backed up, inspected, or archived with standard file system tools.

The application separates document metadata from document files:

- The SQLite database stores document records, version history, file tracking, workspace settings, catalogs, and recovery metadata.
- The workspace folders store the actual managed files, templates, and snapshots.
- The user interface keeps multiple workspaces open at the same time in separate tabs.

This model keeps the product simple to deploy, easy to back up, and practical for environments where documents must remain local.

## Current Scope

DocTrack currently provides:

- Offline local workspaces
- Desktop application packaging for Windows and macOS
- A single-user local workflow
- No central server, user accounts, cloud sync, or multi-user concurrency layer

That scope is intentional and is worth understanding before adopting the source code. The application is optimized for portable local workspaces, not for hosted document management.

## Core Capabilities

- Create and open multiple workspaces in parallel
- Track document shells separately from versioned files
- Generate document IDs from configurable presets or custom templates
- Support multiple version schemes: `001`, `v1`, and `1.0`
- Manage file roles such as working files, concept PDFs, and final PDFs
- Detect and reconcile file system drift inside managed folders
- Track document metadata including project, language, confidentiality class, company, department, and review interval
- Provide dashboards, recent activity, health flags, and filtered document tables
- Reuse template folders when creating documents
- Export document overviews to CSV or PDF
- Create manual or safety backups and restore them with diff previews
- Run integrity checks against the workspace database and managed files
- Store application-level preferences such as theme, shortcuts, table density, and update settings

## Technology Stack

- Electron for the desktop runtime
- React 19 and TypeScript for the renderer
- `electron-vite` and Vite for development and build orchestration
- SQLite and `better-sqlite3` for local persistence
- Tailwind CSS for styling
- Zustand for renderer state
- TanStack Table for the document overview grid
- Chokidar for workspace file system watching
- `electron-updater` for packaged update support
- Vitest for automated testing

## Workspace Model

Each workspace is self-contained. By default, a new workspace uses the following root layout:

```text
<Workspace>/
  Database/
    workspace.sqlite
  Documents/
  Templates/
  Backups/
```

Those root directory names are configurable in workspace settings, but the default layout is a good mental model for understanding the application.

### What lives where

- `Database/workspace.sqlite`
  Stores the document register, versions, tracked files, workspace settings, catalogs, activity log, and migration history.
- `Documents/`
  Stores managed document folders and version folders.
- `Templates/`
  Stores reusable template folders that can seed a document with initial files.
- `Backups/`
  Stores manual snapshots and safety snapshots created before high-risk operations such as migration or restore.

### Example

```text
Quality-System/
  Database/
    workspace.sqlite
  Documents/
    Procedure/
      02202600001/
        001/
          audit-procedure.docx
  Templates/
    Procedure Starter/
      audit-template.docx
  Backups/
    <backup-id>/
      manifest.json
      ...
```

## Document Model

DocTrack treats a document as a long-lived record that may or may not already have files.

### Document shell

A document can be created as a shell first. The shell stores core metadata such as:

- title
- document type
- author
- project
- language
- confidentiality class
- company
- department
- start date
- revision interval in months

This allows the register to exist before a first deliverable is ready.

### Version history

Each document can then accumulate versions. A version stores:

- version label
- version-specific document ID
- status
- release date
- reviewer
- approver
- revision description
- tracked files

The latest version is what drives the status shown in the main document overview.

### Status workflow

The current status set is fixed in the application and database:

- `Draft`
- `In Review`
- `Released`
- `Archived`
- `Obsolete`

### Starter data

New workspaces are initialized with:

- starter document types: `Specification (01)`, `Procedure (02)`, `Report (03)`
- starter language codes: `NL`, `EN`, `DE`
- optional example documents when example data is enabled during workspace creation

## Document IDs, Versions, and Storage Layout

DocTrack lets each workspace define how document IDs and file paths should behave.

### Document ID formats

Built-in presets include:

- `legacy-numeric`: `<docTypePrefix><year><sequence:5>`
- `type-year-sequence`: `<docType>-<year>-<sequence:4>`
- `type-language-year-sequence`: `<docType>-<language>-<year>-<sequence:4>`
- `custom`: user-defined template

Custom templates support placeholders such as:

- `<docTypePrefix>`
- `<docType>`
- `<year>` and `<year2>`
- `<month>` and `<day>`
- `<author>`
- `<language>`
- `<company>`
- `<department>`
- `<project>`
- `<title>`
- `<sequence>` or `<sequence:n>`

Template validation is enforced in the main process. A valid template must include exactly one sequence placeholder.

### Version schemes

Supported version label schemes are:

- `numeric-3`: `001`, `002`, `003`
- `v-prefix`: `v1`, `v2`, `v3`
- `major-minor`: `1.0`, `1.1`, `2.0`

### Version management modes

The workspace can also decide how document IDs behave across versions:

- `shared-document-id`
  Every version in the history keeps the same document ID.
- `version-specific-document-id`
  Each new version receives a new document ID while remaining linked to the same document record.

### Storage layout options

Workspace settings control both the folder naming strategy and the version file organization:

| Setting | Options | Effect |
| --- | --- | --- |
| Storage layout preset | `stable-id`, `friendly-id` | Chooses whether document folders are based on the document ID alone or on the document ID plus title |
| File organization mode | `flat`, `role-subfolders` | Chooses whether version files are stored directly in the version folder or grouped by role |

Examples:

```text
Documents/Procedure/02202600001/001/audit-procedure.docx
Documents/Procedure/02202600001 - Internal Audit Procedure/001/final-pdf/audit-procedure.pdf
```

### Automatic status handling

When `autoMarkPreviousVersionObsolete` is enabled in workspace settings, creating a new version automatically marks the previous version as `Obsolete`.

## File Tracking and Reconciliation

DocTrack does more than store files. It also tracks the state of version folders relative to the database.

### Supported file roles

- `working`
- `concept-pdf`
- `final-pdf`
- `other`

These roles influence how files are stored and displayed. Template imports also use file name and extension heuristics to suggest a role.

### File operations

For each version, the application can:

- import files into managed storage
- rename tracked files
- change file roles
- delete tracked files
- open files or containing folders in the operating system
- preview supported local files

Preview support currently includes:

- PDF
- images
- text
- CSV

### Drift detection

The application watches the workspace `Documents` and `Templates` roots and emits file system drift events when managed paths change outside the app.

Each version can be evaluated as:

- `clean`
- `dirty`
- `ambiguous`

Detected changes include:

- missing tracked files
- new unmanaged files or folders
- renamed files
- role moves
- content changes
- collisions
- nested unmanaged paths

The reconciliation workflow lets the user inspect those differences and apply selected fixes back to the tracked metadata.

### Version comparison

Adjacent versions can be compared by tracked files, file paths, roles, and content hashes. This gives contributors a lightweight way to inspect what changed between revisions without leaving the app.

## Catalogs, Templates, Dashboards, and Exports

### Catalogs

Each workspace maintains local catalogs for:

- document types
- projects
- confidentiality classes
- languages

These values are stored in the workspace database and referenced by documents.

### Templates

Templates are stored as folders inside the workspace `Templates` directory. A template can contain one or more files and can be selected during document creation to seed the first version automatically.

### Dashboard and health signals

The workspace dashboard summarizes:

- document counts by status
- document counts by type
- document counts by project
- recent activity
- health insights

Current document health flags include:

- `overdueReview`
- `missingFiles`
- `unversionedShell`
- `unmanagedPaths`
- `staleDocument`

### Activity log

When activity logging is enabled, DocTrack records workspace and document events such as creation, opening, settings changes, version creation, and backup activity. Retention is configurable per workspace through `activityLogMaxRows`.

### Exports

The document table can be exported as:

- CSV
- PDF

Export scope can be either the current filtered table or the whole workspace. PDF exports support grouping by metadata such as document type, status, project, language, confidentiality class, company, department, or author. If a company logo is configured for the workspace, it can be included in the report.

## Backups, Restore, and Integrity Checks

DocTrack includes built-in recovery tooling because each workspace is treated as a durable local asset.

### Backups

Two backup types exist:

| Type | When it is created |
| --- | --- |
| `manual` | Created explicitly by the user |
| `safety` | Created automatically before migration or restore operations that could alter the live workspace |

Each snapshot contains:

- the workspace database directory
- the managed documents directory
- the templates directory when present
- a manifest with summary metadata

### Restore options

Backups can be restored in two ways:

- overwrite the current workspace database and managed content
- export the backup into a brand-new restored workspace folder

Before restoring, the application can generate:

- a destination preview
- a structured diff of workspace settings
- diffs for document types, projects, classifications, languages, documents, versions, and tracked files

### Integrity checks

The integrity checker verifies that tracked workspace assets still exist and can be read. It reports issues such as:

- missing database file
- missing document folder
- missing version folder
- missing managed file
- unreadable path

## Requirements

Recommended local environment:

- Node.js 20 or later
- npm 10 or later

Additional notes:

- `better-sqlite3` uses native bindings and must match the runtime it is built for.
- Packaging is most reliable on the target operating system because Electron bundles a native SQLite dependency.

## Development Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start the application in development mode

```bash
npm run dev
```

This command rebuilds `better-sqlite3` for Electron and then starts:

- the Electron main process
- the preload script
- the React renderer

### 3. Run the test suite

```bash
npm test
```

### 4. Run type checking

```bash
npm run typecheck
```

### 5. Build production bundles

```bash
npm run build
```

Build output is written to `out/`.

### 6. Package installers

```bash
npm run dist
```

Packaged artifacts are written to `release/`.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Rebuilds native Electron modules and starts the app in development mode |
| `npm run build` | Rebuilds native Electron modules and creates production bundles in `out/` |
| `npm run preview` | Rebuilds native Electron modules and previews the built application |
| `npm run dist` | Builds the app and packages installers without publishing |
| `npm run dist:win` | Builds and packages a Windows NSIS x64 installer |
| `npm run dist:win:compat` | Windows packaging fallback that disables executable resource editing |
| `npm run dist:mac` | Builds and packages macOS universal DMG and ZIP artifacts |
| `npm run release` | Builds and publishes to the configured release provider |
| `npm run release:win` | Publishes a Windows release |
| `npm run release:win:compat` | Publishes a Windows release with compatibility packaging settings |
| `npm run release:mac` | Publishes a macOS release |
| `npm run rebuild:native` | Rebuilds `better-sqlite3` for Electron |
| `npm run rebuild:node` | Rebuilds `better-sqlite3` for the local Node.js runtime |
| `npm test` | Rebuilds `better-sqlite3` for Node.js and runs the Vitest suite |
| `npm run test:watch` | Rebuilds `better-sqlite3` for Node.js and runs Vitest in watch mode |
| `npm run typecheck` | Runs TypeScript checks for the app and Node-side configs |

## Repository Structure

| Path | Purpose |
| --- | --- |
| `src/main/` | Electron main process, database access, services, file operations, IPC handlers |
| `src/preload/` | Safe bridge between Electron and the renderer |
| `src/renderer/src/` | React application, UI components, local utilities, and client-side state |
| `src/shared/` | Shared domain types, settings models, and IPC contracts |
| `migrations/` | Numbered SQL migrations applied to workspace databases |
| `build/` | Icons and macOS entitlements used by packaging |
| `electron-builder.yml` | Packaging and publish configuration |

## Architecture Notes

### Process boundaries

DocTrack follows the standard Electron split:

- `main`
  Owns SQLite access, file system access, migrations, backup logic, updater logic, and all business rules
- `preload`
  Exposes a typed and limited API to the renderer through `window.docTrack`
- `renderer`
  Renders the React interface and calls the preload API instead of touching Node.js directly

This is an important rule for contributors: database and file system code belongs in the main process, not in React components.

### Shared contracts

The main process and renderer share their contracts through `src/shared/`. In practice, the most important shared files are:

- `src/shared/types.ts`
- `src/shared/workspaceLayout.ts`
- `src/shared/applicationSettings.ts`
- `src/shared/ipc.ts`

### Application catalog vs workspace data

Workspace data lives inside each workspace folder. Application-level state does not.

Recent workspaces and global application settings are stored in a catalog file under Electron `userData`:

- recent workspace list
- theme and layout preferences
- keyboard shortcuts
- launch behavior
- updater preferences

This distinction matters when debugging. If a setting seems global across workspaces, it is probably coming from the application catalog rather than the workspace database.

### Typical data flow

Creating a document follows this path:

1. The renderer collects form input.
2. The renderer calls `window.docTrack.documents.create(...)`.
3. The preload layer forwards the request over IPC.
4. `src/main/ipc.ts` routes the request to `DocumentService`.
5. The service validates input, generates the document ID, creates folders, writes database rows, and records activity.
6. The updated document detail is returned to the renderer.

Most features follow that same pattern.

## Database and Migrations

Workspace schema changes are handled through numbered SQL migrations in `migrations/`.

Current migration chain:

- `001_initial.sql`
- `002_workspace_layout.sql`
- `003_document_metadata.sql`
- `004_version_management.sql`
- `005_document_id_format.sql`
- `006_workspace_branding.sql`
- `007_activity_log.sql`
- `008_document_review_metadata.sql`
- `009_workspace_root_directories.sql`
- `010_activity_log_settings.sql`

### Migration behavior

- New workspaces are created with the full migration chain applied.
- Existing workspaces are checked for pending migrations when opened.
- If pending migrations exist, DocTrack creates a safety snapshot before applying them.
- Database connections are configured with foreign keys enabled and SQLite WAL mode.

### Main tables

The most important workspace tables are:

- `Workspaces`
- `Statuses`
- `DocumentTypes`
- `Projects`
- `ConfidentialityClasses`
- `Languages`
- `Documents`
- `DocumentVersions`
- `DocumentVersionFiles`
- `ActivityLog`
- `__Migrations`

## Packaging and Updates

DocTrack uses `electron-builder` for packaging.

### Current packaging targets

- Windows: NSIS x64 installer
- macOS: universal `dmg` and `zip`

Linux packaging is not configured in the current release setup.

### Output locations

- `npm run build` writes compiled bundles to `out/`
- `npm run dist*` writes packaged artifacts to `release/`

### Release publishing

The release configuration is currently set to publish draft GitHub releases for:

- repository: `zaferaltan/DocTrack`

Publishing is driven by the `release*` scripts and requires appropriate credentials such as `GH_TOKEN`.

### Auto-update behavior

Packaged Windows and macOS builds include updater wiring through `electron-updater`.

Current behavior:

- updates are only supported in packaged Windows and macOS builds
- the updater can check automatically on launch when enabled in settings
- updates are not auto-downloaded
- users must explicitly download the update
- installation happens through a separate quit-and-install step after download completes
- unpackaged development runs do not use the production update feed

### Release hardening notes

- Public macOS releases require working code signing and notarization credentials
- Unsigned Windows builds may show SmartScreen or trust warnings
- Release builds should be generated and smoke-tested on the target operating system

## Contributor Notes

### Good to know before changing storage code

- The workspace layout is configurable. Avoid hard-coding `Database`, `Documents`, `Templates`, or `Backups` unless the code is intentionally using the default fallback.
- File paths stored in the database are relative to the workspace root.
- Storage layout changes can require both file moves on disk and path rewrites in SQLite.
- File system watcher behavior matters when moving or reconciling managed files. Suppression and pause/resume logic already exists for this.

### Good to know before changing schema or persistence

- Add a new migration instead of rewriting an old one that may already exist in user workspaces.
- Review backup, restore, and integrity behavior when changing database tables or stored path semantics.
- If the change affects document identity, versioning, or file layout, update the relevant service tests.

### Testing coverage

The repository already includes tests for:

- document ID generation
- document workflows
- file storage
- workspace creation and migration behavior
- backup and restore flows
- updater logic
- IPC contracts
- preload behavior
- renderer helpers and store behavior

When changing business rules in `src/main/services/`, extending the corresponding tests should be part of the same change.

## Troubleshooting

### `better-sqlite3` runtime mismatch

If the native module was built for the wrong runtime, rebuild it for the environment you are using:

```bash
npm run rebuild:native
```

Use that for Electron development and packaging.

```bash
npm run rebuild:node
```

Use that for Node.js test runs.

### `npm install` fails on native dependencies

`better-sqlite3` may require local native build tooling if a prebuilt binary is unavailable. On Windows, that can mean C++ build tools depending on the environment.

### `npm run build` did not create an installer

`npm run build` only creates application bundles in `out/`. Use a packaging command such as:

```bash
npm run dist
npm run dist:win
npm run dist:mac
```

### Electron behaves like plain Node.js

If `ELECTRON_RUN_AS_NODE=1` is set in the shell environment, Electron will not start as the desktop runtime. Clear that variable and run the app again.

### Auto-updates do not work in development mode

That is expected. The updater is only supported in packaged Windows and macOS builds.
