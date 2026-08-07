/// <reference types="node" />
/** Resolution and exact replacement of source-declared instruction files. */
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import type { CapturedContextResource, CapturedResourceSnapshot } from './shared.ts'

export class CapturedResourceNotFoundError extends Error {}
export class CapturedResourceConflictError extends Error {}

function sha1(content: string): string {
  return createHash('sha1').update(content).digest('hex')
}

function ancestorDirectories(cwd: string): string[] {
  const directories: string[] = []
  let current = resolve(cwd)
  for (;;) {
    directories.push(current)
    const parent = dirname(current)
    if (parent === current) return directories
    current = parent
  }
}

function fixedPath(displayPath: string): string | undefined {
  if (isAbsolute(displayPath)) return resolve(displayPath)
  if (displayPath.startsWith('$DSH_HOME/')) {
    const dshHome = process.env['DSH_HOME']
    return dshHome === undefined ? undefined : join(dshHome, displayPath.slice('$DSH_HOME/'.length))
  }
  if (displayPath.startsWith('~/.dsh/')) {
    return join(homedir(), '.dsh', displayPath.slice('~/.dsh/'.length))
  }
  return undefined
}

async function readable(path: string): Promise<{ path: string; content: string; digest: string } | undefined> {
  try {
    const content = await readFile(path, 'utf8')
    return { path, content, digest: sha1(content) }
  } catch {
    return undefined
  }
}

function isReadableFile(
  file: { path: string; content: string; digest: string } | undefined,
): file is { path: string; content: string; digest: string } {
  return file !== undefined
}

async function resolveResource(
  cwd: string,
  resource: CapturedContextResource,
): Promise<{ path: string; content: string; digest: string }> {
  const fixed = fixedPath(resource.path)
  if (fixed !== undefined) {
    const file = await readable(fixed)
    if (file !== undefined) return file
    throw new CapturedResourceNotFoundError(`上下文文件不存在或不可读：${resource.path}`)
  }

  const candidates = ancestorDirectories(cwd).map(directory => resolve(directory, resource.path))
  const readableCandidates = (await Promise.all(candidates.map(readable))).filter(isReadableFile)
  const matching = resource.digest === undefined
    ? []
    : readableCandidates.filter(file => file.digest === resource.digest)
  if (matching.length === 1) return matching[0]!
  if (matching.length > 1) {
    throw new CapturedResourceConflictError(`上下文文件路径不唯一：${resource.path}`)
  }
  if (readableCandidates.length === 1) return readableCandidates[0]!
  if (readableCandidates.length > 1) {
    throw new CapturedResourceConflictError(`上下文文件已变化且路径不唯一：${resource.path}`)
  }
  throw new CapturedResourceNotFoundError(`无法从会话工作目录解析上下文文件：${resource.path}`)
}

/** Load the exact current file selected by one captured instructions transition. */
export async function loadCapturedResource(
  cwd: string,
  resource: CapturedContextResource,
): Promise<CapturedResourceSnapshot> {
  const file = await resolveResource(cwd, resource)
  return { path: resource.path, content: file.content, digest: file.digest }
}

/** Replace the source file only if it still has the bytes loaded by the editor. */
export async function saveCapturedResource(
  cwd: string,
  resource: CapturedContextResource,
  content: string,
  expectedDigest: string,
): Promise<CapturedResourceSnapshot> {
  const current = await resolveResource(cwd, resource)
  if (current.digest !== expectedDigest) {
    throw new CapturedResourceConflictError(`上下文文件已在编辑期间变化：${resource.path}`)
  }
  await writeFile(current.path, content, 'utf8')
  return { path: resource.path, content, digest: sha1(content) }
}
