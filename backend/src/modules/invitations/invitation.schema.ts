import { z } from 'zod'

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['admin', 'member']),
})

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>
