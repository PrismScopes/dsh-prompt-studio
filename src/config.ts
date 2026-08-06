import z from 'schemastery'
import {
  validatePromptComponents,
  type PromptComponent,
  type PromptComponentKind,
  type PromptComponentPosition,
  type PromptComponentRole,
  type StudioConfig,
} from './shared.ts'

const finiteOrder = z.transform(z.number(), (value) => {
  if (!Number.isFinite(value)) throw new TypeError('prompt component order must be a finite number')
  return value
}, true)

const kindSchema = z.union([
  z.const('native'),
  z.const('supplement'),
]) as z<PromptComponentKind>

const positionSchema = z.union([
  z.const('after_system'),
  z.const('anchored'),
  z.const('tail'),
]) as z<PromptComponentPosition>

const roleSchema = z.union([
  z.const('system'),
  z.const('user'),
  z.const('assistant'),
]) as z<PromptComponentRole>

const componentSchema: z<PromptComponent> = z.object({
  id: z.string().min(1),
  kind: kindSchema,
  role: roleSchema,
  position: positionSchema,
  order: finiteOrder,
  enabled: z.boolean().default(true),
  template: z.string(),
  origin: z.string().min(1).default(undefined as unknown as string),
})

const uniqueComponents = z.transform(z.array(componentSchema), (components) => {
  validatePromptComponents(components)
  return components
}, true)

/** Persisted settings schema. Only user-authored supplements are stored. */
export const studioConfigSchema = z.object({
  components: uniqueComponents.default([]),
}) as z<StudioConfig>
