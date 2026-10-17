import { z } from 'zod'

export const createApiKeySchema = z.object({
  label: z.string().trim().min(1).max(191),
})

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>
