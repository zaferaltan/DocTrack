# DocTrack

DocTrack is a cross-platform desktop application for managing documents, document versions, statuses, and workspace files.

It is built with:

- Electron for the desktop shell
- React + TypeScript for the UI
- SQLite for offline workspace data
- `better-sqlite3` for fast local database access
- Tailwind CSS for styling
- Zustand for UI state
- TanStack Table for the document overview grid

The app is designed to work fully offline. Each workspace is its own SQLite file, and each open workspace appears in its own tab.

## What DocTrack Does

DocTrack lets you:

- Create a new workspace
- Open an existing workspace
- Keep multiple workspaces open at the same time
- Create documents with automatically generated numeric document IDs
- Add new versions to existing documents
- Change document status
- Manage document types and their number prefixes
- Search, sort, and filter documents in a table view
- Store document files locally next to the workspace

## How Workspaces Work

A workspace is a SQLite database file on disk.

Example:

```text
Quality.sqlite
Quality.files/
```

The `.sqlite` file stores metadata such as:

- documents
- document versions
- document types
- statuses
- workspace information

The `.files` folder stores copied document files for that workspace.

Example managed file path:

```text
Quality.files/documents/01202600001/v2/specification.pdf
```

This means:

- the workspace stays portable
- the app works offline
- file paths inside the database can stay relative

## Document ID Format

Each document gets a permanent ID that does not change across versions.

Format:

```text
TTYYYYNNNNN
```

Where:

- `TT` = 2-digit document type prefix
- `YYYY` = year
- `NNNNN` = sequence number for that type and year

Examples:

```text
01202600001
01202600002
02202600001
```

Important rules:

- document IDs are numeric only
- document IDs are generated automatically
- document IDs are unique
- document IDs stay the same across versions
- only the version number changes when you create a new version

## Versioning Model

DocTrack separates the document record from the version records.

At a high level:

- `Documents` stores the main identity of a document
- `DocumentVersions` stores each uploaded version of that document

That means:

- one document can have many versions
- creating a new version adds a new row to `DocumentVersions`
- changing status updates the latest version
- changing status does not create a new version

## Project Status

This repository currently includes:

- the desktop app shell
- workspace creation and opening
- document overview screen
- document type management
- version management logic
- theme switching
- seeded example data
- automated backend and workflow tests

This repository does **not** yet include installer/packaging configuration for shipping `.dmg` or `.exe` builds.

## Requirements

Recommended:

- Node.js 20+  
- npm 10+

This project was developed and verified with a modern Node environment and uses native SQLite bindings through `better-sqlite3`.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app in development mode

```bash
npm run dev
```

This starts:

- an Electron-targeted rebuild of `better-sqlite3`
- the Electron main process
- the preload script
- the React renderer

### 3. Build the app

```bash
npm run build
```

This creates a production build in:

```text
out/
```

### 4. Preview the production build

```bash
npm run preview
```

### 5. Run tests

```bash
npm test
```

### 6. Run type checking

```bash
npm run typecheck
```

## Available Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Electron app in development mode |
| `npm run build` | Rebuilds native Electron modules and builds the main, preload, and renderer bundles |
| `npm run preview` | Rebuilds native Electron modules and runs a local preview |
| `npm test` | Rebuilds `better-sqlite3` for plain Node and runs the Vitest test suite |
| `npm run test:watch` | Rebuilds `better-sqlite3` for plain Node and runs tests in watch mode |
| `npm run typecheck` | Runs strict TypeScript checking |
| `npm run rebuild:native` | Rebuilds `better-sqlite3` for Electron |
| `npm run rebuild:node` | Rebuilds `better-sqlite3` for the local Node.js runtime |

## How To Use The App

### Create a workspace

1. Launch the app
2. Click `New Workspace`
3. Enter a workspace name
4. Choose where to save the SQLite file
5. Optionally keep example data enabled
6. Create the workspace

When a workspace is created:

- the SQLite file is created
- the database schema is initialized
- the four fixed statuses are seeded
- starter document types are seeded
- optional sample documents are added

### Open an existing workspace

1. Click `Open Workspace`
2. Choose an existing `.sqlite` workspace file
3. The workspace opens in a new tab

### Create a document

1. Open a workspace
2. Click `New Document`
3. Enter:
   - title
   - author
   - document type
   - notes
   - source file
4. Save

DocTrack will:

- generate a new `DocumentID`
- copy the selected file into the workspace-managed files folder
- create the document record
- create version `1`
- set the initial status to `Draft`

### Create a new version

1. Select an existing document
2. Click `New Version`
3. Choose a new file
4. Add notes
5. Save

DocTrack will:

- keep the same document ID
- increment the version number
- copy the new file into the managed storage folder
- create a new `DocumentVersions` row

### Change document status

1. Select a document
2. Click `Change Status`
3. Pick a new status
4. Save

The latest version is updated in place.

### Manage document types

1. Open a workspace
2. Go to `Document Types`
3. Add, edit, or delete document types

Each type needs:

- a name
- a unique 2-digit numeric prefix

## Default Seed Data

New workspaces are seeded with these statuses:

- `Draft`
- `In Review`
- `Released`
- `Archived`

New workspaces are also seeded with starter document types:

- `01` Specification
- `02` Procedure
- `03` Report

If example data is enabled, sample documents are created automatically.

## Tech Stack Explained

If you are new to this stack, this is the most important part:

### Electron

Electron lets us build a desktop app using web technologies.

In this app, Electron has 3 important layers:

- `main` process
- `preload` script
- `renderer` app

### React

React builds the user interface.

In DocTrack, React renders:

- the top toolbar
- workspace tabs
- the sidebar
- the documents table
- modal dialogs
- the document details panel

### TypeScript

TypeScript adds types on top of JavaScript so the code is safer and easier to understand.

### SQLite

SQLite is a single-file local database. It is a great fit here because:

- it works offline
- it is fast
- it is easy to copy and back up
- each workspace can be its own file

### better-sqlite3

`better-sqlite3` is the library used by the Electron main process to read and write SQLite data.

### Zustand

Zustand is a lightweight state management library. It stores UI state like:

- which workspaces are open
- which workspace is active
- the current theme
- notifications

### TanStack Table

TanStack Table powers the document overview table:

- sorting
- filtering
- searching
- table row rendering

### Tailwind CSS

Tailwind is the utility CSS framework used to style the app.

## How The Codebase Works

The project is split into clear layers:

```text
src/
  main/       Electron main process, SQLite, services, IPC handlers
  preload/    Safe API bridge from Electron to the UI
  renderer/   React app and UI components
  shared/     Shared TypeScript types and IPC contracts
migrations/   SQL schema files
```

### `src/main`

This is the backend of the desktop app.

It handles:

- opening windows
- registering IPC handlers
- managing workspace connections
- reading and writing SQLite data
- copying files into managed storage

Important files:

- `src/main/index.ts`  
  App startup and service wiring

- `src/main/ipc.ts`  
  Connects UI requests to backend services

- `src/main/database/workspaceManager.ts`  
  Opens, caches, and closes workspace database connections

- `src/main/services/workspaceService.ts`  
  Workspace creation, opening, summaries, and seed data

- `src/main/services/documentService.ts`  
  Document creation, version creation, status updates, file opening

- `src/main/services/documentTypeService.ts`  
  CRUD operations for document types

- `src/main/services/documentIdGeneratorService.ts`  
  Generates numeric IDs like `01202600001`

- `src/main/services/fileStorageService.ts`  
  Calculates workspace file paths and copies files

### `src/preload`

This is the safe bridge between the Electron backend and the React frontend.

Why it exists:

- the UI should not directly access Node.js APIs
- the UI should only get a limited, typed API

`src/preload/index.ts` exposes `window.docTrack`.

That API includes methods like:

- `workspace.create`
- `workspace.open`
- `documents.create`
- `documents.createVersion`
- `documents.updateStatus`
- `documentTypes.create`

### `src/renderer`

This is the frontend React app.

Main areas:

- `src/renderer/src/App.tsx`  
  Main UI shell and feature screens

- `src/renderer/src/store/useAppStore.ts`  
  Global UI state with Zustand

- `src/renderer/src/components/ui/`  
  Reusable UI building blocks like buttons, dialogs, inputs, badges

- `src/renderer/src/lib/utils.ts`  
  Small frontend helpers

### `src/shared`

This folder contains types shared between the frontend and backend.

Important files:

- `src/shared/types.ts`  
  Domain models and DTOs

- `src/shared/ipc.ts`  
  IPC channel names and the typed preload API contract

This helps keep the app consistent because both sides agree on the same types.

## How Data Flows Through The App

This is the most useful mental model for understanding the project.

### Example: creating a document

1. The user fills in the `Create Document` dialog in React
2. React calls `window.docTrack.documents.create(...)`
3. The preload script forwards that request through Electron IPC
4. `src/main/ipc.ts` receives the request
5. `DocumentService` runs the business logic
6. `DocumentIdGeneratorService` generates the new document ID
7. `FileStorageService` copies the selected file into managed workspace storage
8. SQLite rows are inserted into `Documents` and `DocumentVersions`
9. The updated document list is returned to the UI
10. React refreshes the table and detail panel

That same pattern is used for other actions too.

## Database Schema

The initial schema lives in:

```text
migrations/001_initial.sql
```

Main tables:

- `Workspaces`
- `Statuses`
- `DocumentTypes`
- `Documents`
- `DocumentVersions`

High-level relationships:

- one workspace database contains many documents
- one document type can be used by many documents
- one document can have many versions

## Tests

The repository includes automated tests for core business rules:

- document ID generation
- file storage path behavior
- workspace lifecycle
- document creation
- version creation
- status updates

Test files live under:

```text
src/main/services/*.test.ts
```

## Common Beginner Questions

### Why is database logic not inside React?

Because React is only the UI layer.

In Electron apps, file system access and database access are safer in the main process. That is why DocTrack keeps SQLite and file operations in `src/main`.

### Why is there a preload script?

Electron apps can expose too much power to the UI if you are not careful.

The preload script gives the UI only the specific methods it needs.

### Why are types shared?

So the frontend and backend agree on the same data shapes.

That reduces bugs and makes refactoring easier.

### Why use SQLite workspaces instead of one central database?

Because the product is workspace-based and offline-first:

- each workspace is portable
- users can keep multiple separate databases
- backup is simple
- sharing a workspace file is easy

## Troubleshooting

### `npm install` fails on `better-sqlite3`

This package uses native bindings.

Usually it installs fine with prebuilt binaries, but if it does not:

- make sure Node.js is installed correctly
- update npm
- try again after clearing old installs

If you are on Windows and a native build is required, you may need local C++ build tools.

### I get a `NODE_MODULE_VERSION` error from `better-sqlite3`

That means the native SQLite binding was compiled for the wrong runtime.

Common cases:

- Electron needs one binary
- plain Node.js tests need another binary

DocTrack includes helper scripts for this:

```bash
npm run rebuild:native
```

Use that before running the Electron app if needed.

```bash
npm run rebuild:node
```

Use that before running Node-based tests if needed.

Normally you do not need to remember this manually because:

- `npm run dev` rebuilds for Electron
- `npm run build` rebuilds for Electron
- `npm run preview` rebuilds for Electron
- `npm test` rebuilds for Node

### Electron starts in the terminal but behaves like plain Node

If the environment variable below is set:

```bash
ELECTRON_RUN_AS_NODE=1
```

Electron will not behave like the desktop runtime.

If that happens in zsh or bash:

```bash
unset ELECTRON_RUN_AS_NODE
npm run dev
```

### The app builds but does not create an installer

That is expected right now.

This repository currently builds the Electron app bundles, but installer packaging has not been added yet.

## Suggested Learning Order

If you are new to the stack, read the code in this order:

1. `package.json`
2. `src/main/index.ts`
3. `src/shared/types.ts`
4. `src/shared/ipc.ts`
5. `src/preload/index.ts`
6. `src/main/ipc.ts`
7. `src/main/services/workspaceService.ts`
8. `src/main/services/documentService.ts`
9. `src/renderer/src/store/useAppStore.ts`
10. `src/renderer/src/App.tsx`

That order usually makes the architecture click faster.

## Next Steps You Could Add Later

- packaged installers for macOS and Windows
- richer metadata fields
- file attachments per version
- import/export tools
- audit trail/history screens
- user preferences
- stronger end-to-end UI automation

---

If you are new to Electron or React, the big idea is:

- React renders the UI
- preload exposes a safe API
- Electron main runs the backend logic
- SQLite stores the workspace data

That is the core architecture of DocTrack.
