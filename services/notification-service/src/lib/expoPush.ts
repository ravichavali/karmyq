import pool from '../database/db';

// expo-server-sdk is pure ESM. This service compiles with "module": "commonjs", so tsc emits the
// import() below as require('expo-server-sdk'): it loads only because Node can require() an ES module
// (v7's engines floor is Node 22.12; we run 24), and `.default` is the Expo class because Node marks
// the result __esModule. tests/regression/sprint-131-expo-push-real-sdk.test.ts runs this exact path.
let _ExpoClass: any = null;
let _expoInstance: any = null;

async function getExpoModule(): Promise<{ Expo: any; expo: any }> {
  if (!_ExpoClass) {
    const mod = await import('expo-server-sdk');
    _ExpoClass = mod.default;
    _expoInstance = new _ExpoClass();
  }
  return { Expo: _ExpoClass, expo: _expoInstance };
}

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

  const { Expo, expo } = await getExpoModule();

  const messages = tokens
    .filter((token: string) => Expo.isExpoPushToken(token))
    .map((to: string) => ({ to, title, body, data: data ?? {} }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        console.error('[expoPush] Push ticket error:', ticket.message, ticket.details);
      }
    }
  }
}
