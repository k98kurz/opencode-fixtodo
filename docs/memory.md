# Tooling

- `npm test` is plain `node --test`, so it needs Node >= 22.18 (type stripping
  became default there; 22.6–22.17 need `--experimental-strip-types`). Keep
  tests dependency-free: do not add vitest/jest/tsx/`@types/node` unless the
  human asks.
- `todoread.test.ts` is deliberately outside tsconfig `include`: without
  `@types/node` it can't typecheck (`node:test` TS2307) and its
  `./todoread.ts` import needs `allowImportingTsExtensions` (TS5097). So
  `npm run typecheck` skips it — tests are the runtime source of truth.
- `TodoPlugin` only destructures `client`, so test mocks need only
  `{ client: { session: { todo, message } } }` cast to `PluginInput`.

# OpenCode v1 plugin development

Source of truth: `../opencode/` (v1 plugin SDK: `packages/plugin/src/index.ts`).

- **Plugin signature**: `(input: PluginInput, options?: PluginOptions) => Promise<Hooks>`,
  with `PluginOptions = Record<string, unknown>`. All `Hooks` fields are optional, so
  features can be toggled by conditionally spreading hooks.
- **Options channel**: options only arrive via the tuple form in `opencode.json`
  (`["./plugin.ts", { "ns": { ... } }]`). The tuple survives config merge and the loader
  passes it as arg 2 (`packages/opencode/src/plugin/index.ts:118,122`). Auto-discovered
  plugins (`.opencode/plugins/`) and string-form entries get `undefined` — defaults apply.
  The SDK type does not validate options; narrow them locally with a default `{}`
  (pattern: `CodexAuthPlugin`, `packages/opencode/src/plugin/openai/codex.ts:273`).
- **`config` hook is not for reading own options**: it fires once after all plugins load
  and receives the merged config without any plugin identity. Use arg 2 instead.
- **`experimental.text.complete`**: fires once per completed text part at `text-end`,
  before the part is persisted. Input is `{ sessionID, messageID, partID }`; mutate
  `output.text` in place. Must never throw — a rejected hook aborts the processor turn.
- **Strict config validation**: unknown top-level keys in `opencode.json` hard-fail
  opencode, so plugin settings must live in the plugin tuple, not in a custom top-level
  config key.
- This project targets v1, not v2 (`src/v2/…` in the opencode repo is a separate system).
