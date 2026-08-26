import client from './client'

export interface InAppNotification {
  id: string
  type: 'in_app'
  payload: { event?: string; draft_id?: string; article_id?: string; action_url?: string; article_title?: string; request_text?: string }
  created_at: string
  read_at: string | null
}

export async function listNotifications(unreadOnly = false): Promise<InAppNotification[]> {
  const response = await client.get('/notifications', { params: { unread_only: unreadOnly } })
  return response.data
}

export async function markNotificationRead(notificationId: string): Promise<InAppNotification> {
  const response = await client.post(`/notifications/${notificationId}/read`)
  return response.data
}
