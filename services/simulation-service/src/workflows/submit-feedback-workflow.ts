import { SimulatedUser } from '../types';
import { ApiClient } from '../api-client';
import { randomInt } from '../utils';
import { FEEDBACK_COMMENTS } from '../data/realistic-data';

export async function submitFeedbackWorkflow(user: SimulatedUser, client: ApiClient): Promise<void> {
  const matches = await client.getMatches({ status: 'completed' });
  if (!matches.length) return;

  const match = matches[Math.floor(Math.random() * Math.min(matches.length, 5))];

  const isRequester = match.requester_id === user.id;
  const isResponder = match.responder_id === user.id;
  if (!isRequester && !isResponder) return;

  await client.submitMatchFeedback(match.id, {
    from_user_id: user.id,
    helpfulness: randomInt(3, 5),
    responsiveness: randomInt(3, 5),
    clarity: randomInt(3, 5),
    comment: FEEDBACK_COMMENTS[Math.floor(Math.random() * FEEDBACK_COMMENTS.length)],
    allow_featuring: Math.random() > 0.5,
  });
}
