# AGENTS.md

## General Coding Guidelines

- Always make sure that when changing code, you also update the tests when neccesary so there are no mismatches.

## Backwards Compatibility Guidelines

As AI agents, you must always prioritize maintaining backwards compatibility in all development activities. This ensures that users can seamlessly update the application without losing access to their existing data or workspaces.

### Key Principles

- **Workspace Accessibility**: When database schemas are updated, existing workspaces must remain fully accessible and functional after app updates. No user data should be lost or corrupted.
- **Migration Handling**: Implement migration interfaces or scripts to handle schema changes gracefully. Always provide options for data transformation or fallback mechanisms.
- **Planning and Code Generation**: During code generation or planning phases, proactively identify potential backwards compatibility issues. Ask targeted questions to the developer for guidance, such as:
  - How should we handle deprecated fields in the schema?
  - Do we need to add version checks or migration prompts?
  - What fallback behavior is acceptable if migration fails?
- **Developer Choice**: Always present options to the developer, allowing them to decide on migration strategies, data preservation methods, or alternative approaches to avoid breaking changes.

By adhering to these guidelines, we ensure a robust and user-friendly experience across all app versions.
