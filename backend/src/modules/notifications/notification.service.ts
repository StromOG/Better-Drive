import { prisma } from '../../config/prisma.js'

export const NOTIFICATION_EVENT_TYPES = [
  'upload.complete',
  'upload.failed',
  'storage.warning',
  'member.invited',
  'share.accessed',
] as const

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number]

export async function getNotificationPreferences(userId: string) {
  const records = await prisma.notificationPreference.findMany({
    where: { userId, channel: 'in_app' },
  })

  const map = new Map<string, boolean>()
  for (const r of records) {
    map.set(r.eventType, r.enabled)
  }

  // Ensure all known events have a preference, defaulting to enabled: true
  return NOTIFICATION_EVENT_TYPES.map((eventType) => ({
    eventType,
    channel: 'in_app' as const,
    enabled: map.has(eventType) ? map.get(eventType)! : true,
  }))
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Array<{ eventType: string; enabled: boolean }>,
) {
  await prisma.$transaction(
    preferences.map((pref) =>
      prisma.notificationPreference.upsert({
        where: {
          userId_eventType_channel: {
            userId,
            eventType: pref.eventType,
            channel: 'in_app',
          },
        },
        create: {
          userId,
          eventType: pref.eventType,
          channel: 'in_app',
          enabled: pref.enabled,
        },
        update: {
          enabled: pref.enabled,
        },
      }),
    ),
  )

  return getNotificationPreferences(userId)
}
