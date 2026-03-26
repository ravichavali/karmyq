import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import pool from '../database/db';

const expo = new Expo();

export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (userIds.length === 0) return;

  const result = await pool.query(
    `SELECT expo_push_token FROM auth.device_push_tokens
     WHERE user_id = ANY($1)`,
    [userIds]
  );

  const tokens: string[] = result.rows.map((r: { expo_push_token: string }) => r.expo_push_token);
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens
    .filter(token => Expo.isExpoPushToken(token))
    .map(to => ({ to, title, body, data: data ?? {} }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
}
