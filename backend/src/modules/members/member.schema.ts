import { z } from 'zod'

export const updateRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
})

export const bulkRoleSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  role: z.enum(['admin', 'member']),
})

export const bulkDisableSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
})

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
export type BulkRoleInput = z.infer<typeof bulkRoleSchema>
export type BulkDisableInput = z.infer<typeof bulkDisableSchema>
