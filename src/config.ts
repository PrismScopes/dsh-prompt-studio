import z from 'schemastery'
import {
  validateBuiltinOverrides,
  validateStudioSections,
  type BuiltinSectionOverride,
  type StudioConfig,
  type StudioSection,
} from './shared.ts'

const finiteOrder = z.transform(z.number(), (value) => {
  if (!Number.isFinite(value)) throw new TypeError('prompt section order must be a finite number')
  return value
}, true)

const sectionSchema: z<StudioSection> = z.object({
  name: z.string().min(1),
  order: finiteOrder,
  enabled: z.boolean().default(true),
  text: z.string(),
})

const uniqueSections = z.transform(z.array(sectionSchema), (sections) => {
  validateStudioSections(sections)
  return sections
}, true)

const overrideSchema: z<BuiltinSectionOverride> = sectionSchema

const uniqueOverrides = z.transform(z.array(overrideSchema), (overrides) => {
  validateBuiltinOverrides(overrides)
  return overrides
}, true)

/** Persisted settings schema for deployment rows and built-in replacements. */
export const studioConfigSchema: z<StudioConfig> = z.object({
  sections: uniqueSections.default([]),
  overrides: uniqueOverrides.default([]),
})
