import { clientBundle } from './.dsh/packages/client/tsdown.client.ts'

const PLUGIN_ID = 'dsh-prompt-studio'

// `clientBundle(id, libEntry)` returns a face-selecting function; evaluate it
// without `DSH_BUILD_FACE` and keep the client config (the trailing entry).
// The node library half is discarded — this package bundles its server half
// directly from `src/index.ts` below.
const clientConfig = clientBundle(PLUGIN_ID, [])({ env: {} }).at(-1)

export default [
  {
    entry: { index: 'src/index.ts' },
    outDir: 'dist',
    format: 'esm',
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    // The server half bundles its only runtime value dependency (schemastery,
    // pulled in by config.ts) so a linked/installed plugin is self-contained;
    // every other `@deepseek-ai/*` import is type-only and erased. Type-only
    // imports never reach the bundler, so no explicit external list is needed.
  },
  {
    ...clientConfig,
    outDir: 'dist',
  },
]
