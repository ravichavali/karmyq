import Queue from 'bull';
import { createNotification } from '../services/notificationService';
import { query } from '../database/db';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Event queue - must match the queue name used by publishers
const eventQueue = new Queue('karmyq-events', REDIS_URL);

export async function initEventSubscriber() {
  try {
    // Process match_created events
    eventQueue.process('match_created', async (job) => {
      console.log('Processing match_created event:', job.data);

      const { payload } = job.data;
      const { match_id, request_id, requester_id, responder_id } = payload;

      try {
        // Get request details
        const requestResult = await query(
          `SELECT r.title, u.name as requester_name
           FROM requests.help_requests r
           JOIN auth.users u ON r.requester_id = u.id
           WHERE r.id = $1`,
          [request_id]
        );

        const responderResult = await query(
          `SELECT name FROM auth.users WHERE id = $1`,
          [responder_id]
        );

        if (requestResult.rows.length > 0 && responderResult.rows.length > 0) {
          const request = requestResult.rows[0];
          const responder = responderResult.rows[0];

          // Notify requester about new match
          await createNotification({
            user_id: requester_id,
            type: 'match_created',
            data: {
              match_id,
              request_id,
              request_title: request.title,
              responder_name: responder.name,
            },
          });

          console.log('✅ match_created notification sent');
        }
      } catch (error) {
        console.error('❌ Failed to process match_created event:', error);
        throw error;
      }
    });

    // Process match_completed events
    eventQueue.process('match_completed', async (job) => {
      console.log('Processing match_completed event:', job.data);

      const { payload } = job.data;
      const { match_id, request_id, requester_id, responder_id } = payload;

      try {
        // Get request details
        const requestResult = await query(
          `SELECT title FROM requests.help_requests WHERE id = $1`,
          [request_id]
        );

        if (requestResult.rows.length > 0) {
          const request = requestResult.rows[0];

          // Notify both requester and responder
          await createNotification({
            user_id: requester_id,
            type: 'match_completed',
            data: {
              match_id,
              request_id,
              request_title: request.title,
            },
          });

          await createNotification({
            user_id: responder_id,
            type: 'match_completed',
            data: {
              match_id,
              request_id,
              request_title: request.title,
            },
          });

          console.log('✅ match_completed notifications sent');
        }
      } catch (error) {
        console.error('❌ Failed to process match_completed event:', error);
        throw error;
      }
    });

    // Process karma_awarded events
    eventQueue.process('karma_awarded', async (job) => {
      console.log('Processing karma_awarded event:', job.data);

      const { payload } = job.data;
      const { user_id, points, reason, total_karma } = payload;

      try {
        // Notify user about karma
        await createNotification({
          user_id,
          type: 'karma_awarded',
          data: {
            points,
            reason,
          },
        });

        // Check for milestones (10, 50, 100, 250, 500, 1000)
        const milestones = [10, 50, 100, 250, 500, 1000];
        const previousKarma = total_karma - points;

        for (const milestone of milestones) {
          if (previousKarma < milestone && total_karma >= milestone) {
            await createNotification({
              user_id,
              type: 'karma_milestone',
              data: {
                total_karma: milestone,
              },
            });
            console.log(`✅ Milestone notification sent for ${milestone} karma`);
          }
        }

        console.log('✅ karma_awarded notification sent');
      } catch (error) {
        console.error('❌ Failed to process karma_awarded event:', error);
        throw error;
      }
    });

    // Process request_created events
    eventQueue.process('request_created', async (job) => {
      console.log('Processing request_created event:', job.data);

      const { payload } = job.data;
      const { request_id, community_id, requester_id, title } = payload;

      try {
        // Get requester name
        const requesterResult = await query(
          `SELECT name FROM auth.users WHERE id = $1`,
          [requester_id]
        );

        if (requesterResult.rows.length > 0) {
          const requester = requesterResult.rows[0];

          // Notify all community members except requester
          const membersResult = await query(
            `SELECT user_id FROM communities.members
             WHERE community_id = $1 AND user_id != $2 AND status = 'active'`,
            [community_id, requester_id]
          );

          for (const member of membersResult.rows) {
            await createNotification({
              user_id: member.user_id,
              type: 'new_request',
              data: {
                request_id,
                request_title: title,
                requester_name: requester.name,
              },
            });
          }

          console.log(`✅ request_created notifications sent to ${membersResult.rows.length} members`);
        }
      } catch (error) {
        console.error('❌ Failed to process request_created event:', error);
        throw error;
      }
    });

    // Process join_request_created events
    eventQueue.process('join_request_created', async (job) => {
      console.log('Processing join_request_created event:', job.data);

      const { payload } = job.data;
      const { community_id, user_id, message } = payload;

      try {
        // Get community and user details
        const communityResult = await query(
          `SELECT name FROM communities.communities WHERE id = $1`,
          [community_id]
        );

        const userResult = await query(
          `SELECT name, email FROM auth.users WHERE id = $1`,
          [user_id]
        );

        if (communityResult.rows.length > 0 && userResult.rows.length > 0) {
          const community = communityResult.rows[0];
          const user = userResult.rows[0];

          // Notify all community admins
          const adminsResult = await query(
            `SELECT user_id FROM communities.members
             WHERE community_id = $1 AND role = 'admin' AND status = 'active'`,
            [community_id]
          );

          for (const admin of adminsResult.rows) {
            await createNotification({
              user_id: admin.user_id,
              type: 'join_request',
              data: {
                community_id,
                community_name: community.name,
                user_id,
                user_name: user.name,
                user_email: user.email,
                message: message || null,
              },
            });
          }

          console.log(`✅ join_request_created notifications sent to ${adminsResult.rows.length} admins`);
        }
      } catch (error) {
        console.error('❌ Failed to process join_request_created event:', error);
        throw error;
      }
    });

    console.log('✅ Event subscriber initialized');
  } catch (error) {
    console.error('❌ Event subscriber initialization failed:', error);
    throw error;
  }
}

export default eventQueue;
