import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { loadCapturedResource, saveCapturedResource } from '../src/resource.ts'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function digest(value: string): string {
  return createHash('sha1').update(value).digest('hex')
}

describe('captured instruction resource routing', () => {
  it('resolves a project-root-relative path by its producer digest and writes exact file bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prompt-studio-resource-'))
    roots.push(root)
    const cwd = join(root, 'packages', 'app')
    await mkdir(cwd, { recursive: true })
    await writeFile(join(root, 'AGENTS.md'), 'before\n')
    await writeFile(join(cwd, 'AGENTS.md'), 'unrelated\n')
    const resource = {
      id: 'resource:0', path: 'AGENTS.md', action: 'set' as const,
      digest: digest('before\n'), editable: true,
    }

    expect(await loadCapturedResource(cwd, resource)).toMatchObject({ content: 'before\n' })
    await saveCapturedResource(cwd, resource, 'after\n', digest('before\n'))
    expect(await readFile(join(root, 'AGENTS.md'), 'utf8')).toBe('after\n')
    expect(await readFile(join(cwd, 'AGENTS.md'), 'utf8')).toBe('unrelated\n')
  })

  it('rejects a stale editor rather than replacing newer bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prompt-studio-resource-'))
    roots.push(root)
    await writeFile(join(root, 'AGENTS.md'), 'current')
    const resource = {
      id: 'resource:0', path: 'AGENTS.md', action: 'replace' as const,
      digest: digest('current'), editable: true,
    }
    await expect(saveCapturedResource(root, resource, 'mine', digest('old'))).rejects.toThrow('编辑期间变化')
  })
})
