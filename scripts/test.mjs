import { join } from 'node:path'
import { run, withDshEnvironment } from './dsh-env.mjs'

await withDshEnvironment(async ({ dshRoot }) => {
  await run(join(dshRoot, 'node_modules/.bin/vitest'), ['run', '--config', 'vitest.config.ts'])
})
