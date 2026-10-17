import { z } from 'zod'

export const patchAccountSchema = z.object({
  label: z.string().trim().min(1).max(191).optional(),
  enabled: z.boolean().optional(),
})

export type PatchAccountInput = z.infer<typeof patchAccountSchema>
