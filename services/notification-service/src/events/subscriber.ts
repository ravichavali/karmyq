import Queue from 'bull';
import { createNotification } from '../services/notificationService';
import { query } from '../database/db';
import { sendPushToUsers } from '../lib/expoPush';

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
      const { request_id, community_id, requester_id, title, service_type } = payload;

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

          // Route to matching providers via direct DB query (preferred over internal HTTP call:
          // avoids network latency and the existing GET /requests/providers endpoint lacks community_id filtering)
          // member notifications sent first, provider routing is additive
          if (service_type) {
            // Filter by is_active only (not is_available): is_available defaults FALSE for new providers
            // and controls browse visibility, not notification routing. Providers should be notified
            // regardless of temporary availability status.
            const providersResult = await query(
              `SELECT DISTINCT pp.user_id
               FROM requests.provider_profiles pp
               JOIN communities.members cm ON cm.user_id = pp.user_id
               WHERE pp.service_type = $1
                 AND pp.is_active = TRUE
                 AND cm.community_id = $2
                 AND cm.status = 'active'
                 AND pp.user_id != $3`,
              [service_type, community_id, requester_id]
            );

            for (const provider of providersResult.rows) {
              await createNotification({
                user_id: provider.user_id,
                type: 'provider_request_matched',
                data: {
                  request_id,
                  service_type,
                  request_title: title,
                  requester_name: requester.name,
                },
              });
            }

            console.log(`✅ provider_request_matched notifications sent to ${providersResult.rows.length} providers`);
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

    // Process match_reminder events (published by cleanup-service cron job)
    eventQueue.process('match_reminder', async (job) => {
      console.log('Processing match_reminder event:', job.data);

      const { payload } = job.data;
      const { match_id, responder_id, request_title, request_type, scheduled_at, travel_time_minutes } = payload;

      try {
        await createNotification({
          user_id: responder_id,
          type: 'match_reminder',
          data: { match_id, scheduled_at, request_type, request_title, travel_time_minutes },
        });

        console.log(`✅ match_reminder notification sent to ${responder_id} for match ${match_id}`);
      } catch (error) {
        console.error('❌ Failed to process match_reminder event:', error);
        throw error;
      }
    });

    // Handle preferred_provider_selected event
    eventQueue.process('preferred_provider_selected', async (job) => {
      console.log('Processing preferred_provider_selected event:', job.data);
      const { payload } = job.data;
      const { provider_user_id, request_id, requester_name, request_type, request_title } = payload;

      if (!provider_user_id) {
        console.warn('⚠️  preferred_provider_selected: missing provider_user_id, skipping notification');
        return;
      }

      try {
        await createNotification({
          user_id: provider_user_id,
          type: 'preferred_provider_selected',
          data: { request_id, requester_name, request_type, request_title },
        });
        console.log('✅ preferred_provider_selected notification sent');
      } catch (error) {
        console.error('❌ Failed to process preferred_provider_selected event:', error);
        throw error;
      }
    });

    // Handle provider_review_received event
    eventQueue.process('provider_review_received', async (job) => {
      console.log('Processing provider_review_received event:', job.data);
      const { payload } = job.data;
      const { provider_user_id } = payload;

      if (!provider_user_id) {
        console.warn('⚠️  provider_review_received: missing provider_user_id, skipping notification');
        return;
      }

      try {
        const { provider_id, reviewer_name, rating, review_excerpt } = payload;
        await createNotification({
          user_id: provider_user_id,
          type: 'provider_review_received',
          data: { provider_id, reviewer_name, rating, review_excerpt },
        });
        console.log('✅ provider_review_received notification sent');
      } catch (error) {
        console.error('❌ Failed to process provider_review_received event:', error);
        throw error;
      }
    });

    // Handle provider_went_on_duty event — push open requests in provider's communities
    eventQueue.process('provider_went_on_duty', async (job) => {
      console.log('Processing provider_went_on_duty event:', job.data);
      const { providerUserId, communityIds } = job.data;

      if (!communityIds?.length) return;

      try {
        const result = await query(
          `SELECT DISTINCT hr.id, hr.title
           FROM requests.help_requests hr
           JOIN requests.request_communities rc ON rc.request_id = hr.id
           WHERE rc.community_id = ANY($1) AND hr.status = 'open'
           LIMIT 10`,
          [communityIds]
        );

        const count = result.rows.length;
        if (count === 0) return;

        await sendPushToUsers(
          [providerUserId],
          'Requests waiting in your community',
          `${count} open request${count > 1 ? 's' : ''} match your services. Tap to view.`,
          { type: 'provider_on_duty', count }
        );

        console.log(`✅ provider_went_on_duty push sent to ${providerUserId} (${count} open requests)`);
      } catch (error) {
        console.error('❌ Failed to process provider_went_on_duty event:', error);
      }
    });

    // Handle offer_submitted event — notify requester that an offer arrived
    eventQueue.process('offer_submitted', async (job) => {
      console.log('Processing offer_submitted event:', job.data);
      const { requesterUserId, price } = job.data;

      try {
        const priceText = price ? ` for $${price}` : '';
        await sendPushToUsers(
          [requesterUserId],
          'Someone offered to help',
          `You received an offer${priceText}. Tap to review.`,
          { type: 'offer_received' }
        );

        console.log(`✅ offer_submitted push sent to ${requesterUserId}`);
      } catch (error) {
        console.error('❌ Failed to process offer_submitted event:', error);
      }
    });

    // Handle offer_accepted event — notify provider their offer was accepted
    eventQueue.process('offer_accepted', async (job) => {
      console.log('Processing offer_accepted event:', job.data);
      const { providerUserId } = job.data;

      try {
        await sendPushToUsers(
          [providerUserId],
          'Offer accepted!',
          'Your offer was accepted. Check your commitments.',
          { type: 'offer_accepted' }
        );

        console.log(`✅ offer_accepted push sent to ${providerUserId}`);
      } catch (error) {
        console.error('❌ Failed to process offer_accepted event:', error);
      }
    });

    // Handle offer_declined event — notify provider their offer was not accepted
    eventQueue.process('offer_declined', async (job) => {
      console.log('Processing offer_declined event:', job.data);
      const { providerUserId } = job.data;

      try {
        await sendPushToUsers(
          [providerUserId],
          'Offer declined',
          'Your offer was not accepted this time.',
          { type: 'offer_declined' }
        );

        console.log(`✅ offer_declined push sent to ${providerUserId}`);
      } catch (error) {
        console.error('❌ Failed to process offer_declined event:', error);
      }
    });

    // Handle dibs_submitted event — notify provider that a requester wants their help first
    eventQueue.process('dibs_submitted', async (job) => {
      console.log('Processing dibs_submitted event:', job.data);
      const { payload } = job.data;
      const { dibsId, requestId, providerUserId, expiresAt } = payload;

      if (!providerUserId || !requestId) {
        console.warn('⚠️  dibs_submitted: missing providerUserId or requestId, skipping');
        return;
      }

      try {
        // Fetch requester name and expires_at from the dibs record
        const dibsResult = await query(
          `SELECT u.name AS requester_name, d.expires_at
           FROM requests.dibs d
           JOIN auth.users u ON u.id = d.requester_id
           WHERE d.id = $1`,
          [dibsId]
        );

        if (dibsResult.rows.length === 0) {
          console.warn(`⚠️  dibs_submitted: dibs record ${dibsId} not found, skipping`);
          return;
        }

        const { requester_name, expires_at } = dibsResult.rows[0];
        const expiryTime = new Date(expiresAt ?? expires_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        await createNotification({
          user_id: providerUserId,
          type: 'dibs_submitted',
          data: {
            dibs_id: dibsId,
            request_id: requestId,
            requester_name,
            expires_at: expiresAt ?? expires_at,
            message: `${requester_name} wants your help first — respond by ${expiryTime}`,
          },
        });

        console.log(`✅ dibs_submitted notification sent to provider ${providerUserId}`);
      } catch (error) {
        console.error('❌ Failed to process dibs_submitted event:', error);
        throw error;
      }
    });

    // Handle dibs_accepted event — notify requester that the provider accepted
    eventQueue.process('dibs_accepted', async (job) => {
      console.log('Processing dibs_accepted event:', job.data);
      const { payload } = job.data;
      const { dibsId, requestId } = payload;

      if (!dibsId || !requestId) {
        console.warn('⚠️  dibs_accepted: missing dibsId or requestId, skipping');
        return;
      }

      try {
        // Fetch requester_id and provider name from dibs + users
        const result = await query(
          `SELECT d.requester_id, u.name AS provider_name
           FROM requests.dibs d
           JOIN auth.users u ON u.id = d.provider_user_id
           WHERE d.id = $1`,
          [dibsId]
        );

        if (result.rows.length === 0) {
          console.warn(`⚠️  dibs_accepted: dibs record ${dibsId} not found, skipping`);
          return;
        }

        const { requester_id, provider_name } = result.rows[0];

        await createNotification({
          user_id: requester_id,
          type: 'dibs_accepted',
          data: {
            dibs_id: dibsId,
            request_id: requestId,
            provider_name,
            message: `${provider_name} accepted your dibs request`,
          },
        });

        console.log(`✅ dibs_accepted notification sent to requester ${requester_id}`);
      } catch (error) {
        console.error('❌ Failed to process dibs_accepted event:', error);
        throw error;
      }
    });

    // Handle dibs_declined event — notify requester that provider passed, request is now public
    eventQueue.process('dibs_declined', async (job) => {
      console.log('Processing dibs_declined event:', job.data);
      const { payload } = job.data;
      const { dibsId, requestId } = payload;

      if (!dibsId || !requestId) {
        console.warn('⚠️  dibs_declined: missing dibsId or requestId, skipping');
        return;
      }

      try {
        // Fetch requester_id and provider name from dibs + users
        const result = await query(
          `SELECT d.requester_id, u.name AS provider_name
           FROM requests.dibs d
           JOIN auth.users u ON u.id = d.provider_user_id
           WHERE d.id = $1`,
          [dibsId]
        );

        if (result.rows.length === 0) {
          console.warn(`⚠️  dibs_declined: dibs record ${dibsId} not found, skipping`);
          return;
        }

        const { requester_id, provider_name } = result.rows[0];

        await createNotification({
          user_id: requester_id,
          type: 'dibs_declined',
          data: {
            dibs_id: dibsId,
            request_id: requestId,
            provider_name,
            message: `${provider_name} passed — your request is now public`,
          },
        });

        console.log(`✅ dibs_declined notification sent to requester ${requester_id}`);
      } catch (error) {
        console.error('❌ Failed to process dibs_declined event:', error);
        throw error;
      }
    });

    // Handle dibs_expired event — notify requester that the dibs window closed, request is now public
    // Handles both camelCase (request-service test route) and snake_case (cleanup-service cron job) payloads
    eventQueue.process('dibs_expired', async (job) => {
      console.log('Processing dibs_expired event:', job.data);
      const { payload } = job.data;

      // Normalize camelCase vs snake_case keys from different publishers
      const dibsId = payload.dibsId ?? payload.dibs_id;
      const requestId = payload.requestId ?? payload.request_id;

      if (!dibsId) {
        console.warn('⚠️  dibs_expired: missing dibs id, skipping');
        return;
      }

      try {
        // Fetch requester_id from the dibs record
        const result = await query(
          `SELECT requester_id FROM requests.dibs WHERE id = $1`,
          [dibsId]
        );

        if (result.rows.length === 0) {
          console.warn(`⚠️  dibs_expired: dibs record ${dibsId} not found, skipping`);
          return;
        }

        const { requester_id } = result.rows[0];

        await createNotification({
          user_id: requester_id,
          type: 'dibs_expired',
          data: {
            dibs_id: dibsId,
            request_id: requestId,
            message: 'Your dibs window closed — your request is now public',
          },
        });

        console.log(`✅ dibs_expired notification sent to requester ${requester_id}`);
      } catch (error) {
        console.error('❌ Failed to process dibs_expired event:', error);
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
