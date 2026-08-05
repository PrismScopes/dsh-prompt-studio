/** Settings namespace shared by the Host registration and browser editor. */
export const PROMPT_STUDIO_NAMESPACE = 'prompt-studio'

/** Conversation-view placement: Chat is 0 and Trajectory is 10. */
export const PROMPT_STUDIO_VIEW_ORDER = 20

/** Initial order assigned to a newly added deployment section. */
export const DEFAULT_USER_SECTION_ORDER = 200

/** Namespace reserved for ordered replacement markers owned by the Host half. */
export const PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX = 'prompt-studio:override-marker:'

/** One deployment-authored prompt section persisted in settings.yaml. */
export interface StudioSection {
  name: string
  order: number
  enabled: boolean
  text: string
}

/** Resolved value of the prompt-studio settings namespace. */
export interface StudioConfig {
  sections: StudioSection[]
  overrides: BuiltinSectionOverride[]
}

/** One persisted replacement for a shipped prompt section. */
export interface BuiltinSectionOverride {
  name: string
  order: number
  enabled: boolean
  text: string
}

/** Inventory row for a shipped prompt section. */
export interface BuiltinSection {
  name: string
  order: number
  text: string
  origin: string
}

/** Shipped row resolved against its optional persisted replacement. */
export interface ResolvedBuiltinSection extends BuiltinSection {
  enabled: boolean
  overridden: boolean
}

/** One row participating in the assembled-template preview. */
export interface PreviewSection {
  name: string
  order: number
  text: string
  origin: 'builtin' | 'user'
}

/**
 * Shipped section inventory. The registry remains authoritative at runtime;
 * this browser-safe snapshot gives the editor readable text and source labels
 * without opening a second Host API beside the settings seam.
 */
export const BUILTIN_SECTIONS: readonly BuiltinSection[] = [
  {
    name: 'harness:identity',
    order: -100,
    origin: 'core/system-prompt (constructor)',
    text: 'You are an AI agent powered by the DeepSeek Harness SDK.',
  },
  {
    name: 'harness:source',
    order: -99,
    origin: 'ui/app-boot addHarnessSourceSection',
    text: 'The DeepSeek Harness implementation checkout is at <sourceRoot>. The checkout location and current working directory are separate values and may differ; never infer the working directory from this path. Use pwd to determine the current working directory. Use this checkout only to inspect or extend DSH itself.',
  },
  {
    name: 'app:web-surface',
    order: -98,
    origin: 'apps/cli/src/web.ts webSurfacePrompt',
    text: 'You are interacting with the user through the DeepSeek Harness Web GUI at <webUrl>. When the user refers to "this page", "this GUI", or "this app" without naming another target, they mean this GUI. The browser provides no implicit DOM, route, or screenshot context. Starting another server does not update this GUI. Do not start a replacement server unless the user asks; if one is needed, use a managed background task and verify its exact URL.',
  },
  {
    name: 'deployment:persona',
    order: 0,
    origin: 'web.cordis.yml persona',
    text: 'You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.',
  },
  {
    name: 'plan:policy',
    order: 50,
    origin: 'plan/plan-mode (dynamic, plan mode only)',
    text: '<plan fold policy, non-empty only when plan mode folds>',
  },
  {
    name: 'tool:read',
    order: 100,
    origin: 'fs/tool-fs/src/read.ts',
    text: 'Use the read tool — not shell commands like cat — to inspect text files. Results include line numbers. Use offset and limit to continue reading large files.',
  },
  {
    name: 'tool:write',
    order: 101,
    origin: 'fs/tool-fs/src/write.ts',
    text: 'Use the write tool to create files or completely replace file contents. Existing files are overwritten, so read an existing file first (the default fs-policy requires it) and prefer edit for targeted changes.',
  },
  {
    name: 'tool:edit',
    order: 102,
    origin: 'fs/tool-fs/src/edit.ts',
    text: 'Use the edit tool for targeted changes to existing UTF-8 text files. It replaces literal old_string with new_string; by default old_string must appear exactly once. If old_string appears multiple times, provide a more specific old_string or set replace_all to true. Read the file first (the default fs-policy requires it), unless you just created or edited it in this session.',
  },
  {
    name: 'tool:glob',
    order: 103,
    origin: 'fs/tool-fs-search/src/glob.ts',
    text: 'Use the glob tool — not shell find — to discover files by path pattern. A pattern with no "/" matches basenames at any depth, so "*" matches every file in the tree rather than its top level. Results are files only, never directories, and include hidden and ignored files.',
  },
  {
    name: 'tool:grep',
    order: 104,
    origin: 'fs/tool-fs-search/src/grep.ts',
    text: 'Use the grep tool — not shell grep or rg — to search file contents. Use read on a matched file when you need surrounding context.',
  },
  {
    name: 'tool:bash',
    order: 105,
    origin: 'bash/tool-bash/src/index.ts',
    text: 'Check the [exit code: N] marker on every bash result; investigate failures before moving on.',
  },
  {
    name: 'tool:pwsh',
    order: 105,
    origin: 'bash/tool-pwsh/src/index.ts',
    text: 'Non-zero exits are reported as [exit code: N] markers; investigate failures before moving on.',
  },
  {
    name: 'tool:pty',
    order: 106,
    origin: 'pty/tool-pty/src/index.ts',
    text: 'Use a terminal session only when work needs persistent terminal state or interactive stdin; prefer bash/read/write/edit for bounded one-shot operations. Track every terminal session id and close sessions that no longer matter.',
  },
  {
    name: 'tool:tasks',
    order: 106,
    origin: 'tasks/tool-tasks/src/index.ts',
    text: "Track every background task id you start. You are notified in-session when a task finishes — do not busy-poll or sleep on one; keep working on independent steps and do not duplicate a running task's work. Before giving a final answer, collect every still-relevant task with task_output (set wait: true only when you are genuinely blocked on it), and task_kill tasks that stopped mattering.",
  },
  {
    name: 'tool:web_search',
    order: 110,
    origin: 'web/tool-web/src/search.ts',
    text: 'Use the web_search tool to discover current information on the web. It returns an optional answer plus a list of source URLs.',
  },
  {
    name: 'tool:web_fetch',
    order: 111,
    origin: 'web/tool-web/src/fetch.ts',
    text: 'Use the web_fetch tool to retrieve the content of a specific HTTP(S) URL (for example a result from web_search). It returns the page content decoded to text. Cite the URL as a markdown link when you use its content.',
  },
  {
    name: 'tool:lsp',
    order: 112,
    origin: 'lsp/tool-lsp/src/index.ts',
    text: 'Use search/read for ordinary navigation. Use lsp when textual matches are ambiguous or before a change requires precise definitions, implementations, or references.',
  },
  {
    name: 'tool:session-query',
    order: 113,
    origin: 'session-query/tool-session-query/src/index.ts',
    text: 'Use session_search to find relevant work from prior sessions, or session_event_search to search earlier events in one session.',
  },
  {
    name: 'tool:goal',
    order: 114,
    origin: 'goal/tool-goal/src/index.ts',
    text: 'Use goal tools for one long-running completion objective in the current session.',
  },
  {
    name: 'tool:workflow',
    order: 115,
    origin: 'workflow/tool-workflow/src/index.ts',
    text: 'Use the workflow tool ONLY when the user explicitly asks for a workflow or for large multi-agent orchestration.',
  },
  {
    name: 'tool:ralph',
    order: 116,
    origin: 'workflow/tool-ralph/src/index.ts',
    text: 'Use the ralph tool ONLY when the direct human explicitly asks for a Ralph loop or fresh-agent iterative execution.',
  },
]

const BUILTIN_NAMES = new Set(BUILTIN_SECTIONS.map(section => section.name))

/**
 * Validate the constraints the system-prompt registry cannot express in the settings object schema.
 * @param sections - deployment-authored rows to validate.
 */
export function validateStudioSections(sections: readonly StudioSection[]): void {
  const names = new Set<string>()
  for (const section of sections) {
    if (section.name.length === 0 || section.name.trim() !== section.name) {
      throw new TypeError('prompt section names must be non-empty and have no surrounding whitespace')
    }
    if (!Number.isFinite(section.order)) {
      throw new TypeError(`prompt section "${section.name}" order must be a finite number`)
    }
    if (BUILTIN_NAMES.has(section.name)) {
      throw new TypeError(`prompt section "${section.name}" is built in and cannot be replaced by Prompt Studio`)
    }
    if (section.name.startsWith(PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX)) {
      throw new TypeError(`prompt section names beginning with "${PROMPT_STUDIO_OVERRIDE_MARKER_PREFIX}" are reserved by Prompt Studio`)
    }
    if (names.has(section.name)) {
      throw new TypeError(`prompt section "${section.name}" is listed more than once`)
    }
    names.add(section.name)
  }
}

/**
 * Validate that persisted built-in replacements name one shipped row each.
 * @param overrides - complete built-in replacement rows to validate.
 */
export function validateBuiltinOverrides(overrides: readonly BuiltinSectionOverride[]): void {
  const names = new Set<string>()
  for (const override of overrides) {
    if (!BUILTIN_NAMES.has(override.name)) {
      throw new TypeError(`prompt section "${override.name}" is not a built-in prompt section`)
    }
    if (!Number.isFinite(override.order)) {
      throw new TypeError(`prompt section "${override.name}" order must be a finite number`)
    }
    if (names.has(override.name)) {
      throw new TypeError(`prompt section "${override.name}" is listed more than once`)
    }
    names.add(override.name)
  }
}

/**
 * Resolve every shipped row to its default or persisted editor state.
 * @param overrides - persisted replacements indexed by built-in name.
 * @returns the complete shipped inventory in editor state.
 */
export function resolveBuiltinSections(
  overrides: readonly BuiltinSectionOverride[],
): ResolvedBuiltinSection[] {
  validateBuiltinOverrides(overrides)
  const byName = new Map(overrides.map(override => [override.name, override]))
  return BUILTIN_SECTIONS.map((section) => {
    const override = byName.get(section.name)
    if (override === undefined) return { ...section, enabled: true, overridden: false }
    return { ...section, ...override, origin: section.origin, overridden: true }
  })
}

/**
 * Resolve enabled built-ins and deployment sections in registry order.
 * @param sections - deployment-authored prompt rows.
 * @param overrides - persisted built-in replacements.
 * @returns enabled preview rows sorted by numeric order.
 */
export function buildPreviewSections(
  sections: readonly StudioSection[],
  overrides: readonly BuiltinSectionOverride[] = [],
): PreviewSection[] {
  const rows: PreviewSection[] = [
    ...resolveBuiltinSections(overrides).filter(section => section.enabled).map(section => ({
      name: section.name,
      order: section.order,
      text: section.text,
      origin: 'builtin' as const,
    })),
    ...sections.filter(section => section.enabled).map(section => ({
      name: section.name,
      order: section.order,
      text: section.text,
      origin: 'user' as const,
    })),
  ]
  return rows.sort((left, right) => left.order - right.order)
}

/**
 * Produce the exact blank-line concatenation used by renderPrompt before variable interpolation.
 * @param sections - deployment-authored prompt rows.
 * @param overrides - persisted built-in replacements.
 * @returns complete unresolved prompt preview.
 */
export function renderPreview(
  sections: readonly StudioSection[],
  overrides: readonly BuiltinSectionOverride[] = [],
): string {
  return buildPreviewSections(sections, overrides)
    .map(section => section.text)
    .filter(text => text.length > 0)
    .join('\n\n')
}

/**
 * Allocate the first readable user-section name absent from the draft.
 * @param sections - existing deployment-authored prompt rows.
 * @returns the first available `user:section` name.
 */
export function nextSectionName(sections: readonly StudioSection[]): string {
  const names = new Set(sections.map(section => section.name))
  const base = 'user:section'
  if (!names.has(base)) return base
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${String(suffix)}`
    if (!names.has(candidate)) return candidate
  }
}
