BEGIN;

-- 1. Create trust_questions table
CREATE TABLE IF NOT EXISTS communities.trust_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(60) NOT NULL UNIQUE,
  question_text TEXT NOT NULL,
  subtext       TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create trust_question_choices table
CREATE TABLE IF NOT EXISTS communities.trust_question_choices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES communities.trust_questions(id) ON DELETE CASCADE,
  value         VARCHAR(60) NOT NULL,
  label         TEXT NOT NULL,
  description   TEXT,
  config_delta  JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(question_id, value)
);

-- 3. Seed questions (preserve existing order; request_curation last for Q6 override)
INSERT INTO communities.trust_questions (slug, question_text, subtext, display_order) VALUES
  ('who_is_this_for',    'Who is this community for?',                    'This shapes who can find you, join, and participate.',                                             10),
  ('new_member_warmth',  'How do you feel about new members?',            'This controls how quickly newcomers can earn karma and post requests.',                            20),
  ('relationship_style', 'What kind of relationships do you want to build?', 'This shapes how the trust system weights repeated partners vs. new connections.',              30),
  ('asking_for_help',    'How do you feel about asking for help?',        'This sets how karma is split between helpers and those who ask.',                                  40),
  ('generosity_memory',  'How long should acts of generosity be remembered?', 'This controls how quickly karma and trust scores fade without activity.',                     45),
  ('request_curation',   'How do you want to curate what gets asked for?', 'This controls whether requests are visible immediately or reviewed first.',                      50)
ON CONFLICT (slug) DO NOTHING;

-- 4. Seed choices
WITH q AS (SELECT id, slug FROM communities.trust_questions)
INSERT INTO communities.trust_question_choices (question_id, value, label, description, config_delta, display_order)
SELECT
  q.id,
  c.value,
  c.label,
  c.description,
  c.config_delta::jsonb,
  c.display_order
FROM q
JOIN (VALUES
  -- who_is_this_for
  ('who_is_this_for',    'just_us',       'Just us — a curated circle',             'Private, invite-only. Small and intentional. Members are hand-picked.',                      '{"visibility_mode":"members_only","join_approval_required":true,"member_cap":50,"outsider_response_allowed":false}',      10),
  ('who_is_this_for',    'neighborhood',  'Our neighborhood or local group',         'Semi-open. Anyone nearby can find us, but joining needs approval.',                           '{"visibility_mode":"hybrid","join_approval_required":true,"member_cap":100,"outsider_response_allowed":false}',           20),
  ('who_is_this_for',    'anyone',        'Anyone who finds us',                     'Open doors. Public, welcoming, and easy to join.',                                            '{"visibility_mode":"public","join_approval_required":false,"member_cap":150,"outsider_response_allowed":true}',           30),
  -- new_member_warmth
  ('new_member_warmth',  'trust_takes_time', 'Trust takes time — go slow',          'New members observe before participating. Karma and requests are gated for two weeks.',       '{"new_member_karma_lockout_days":14,"request_approval_required":true,"min_interactions_for_trust":3,"joining_counts_as_interaction":false}', 10),
  ('new_member_warmth',  'cautious',      'Cautious but welcoming',                  'A short waiting period, then full access. Requests are open, karma comes after a week.',      '{"new_member_karma_lockout_days":7,"request_approval_required":false,"min_interactions_for_trust":2,"joining_counts_as_interaction":false}',  20),
  ('new_member_warmth',  'open_arms',     'Open arms — jump right in',               'New members can post and earn immediately. Joining itself counts as your first act.',          '{"new_member_karma_lockout_days":0,"request_approval_required":false,"min_interactions_for_trust":1,"joining_counts_as_interaction":true}',   30),
  -- relationship_style
  ('relationship_style', 'deep_bonds',    'Deep bonds with the same people',         'Trust grows through repeated exchanges. The system favors familiar partners.',                 '{"trust_depth_weight":0.8,"trust_breadth_weight":0.2}',  10),
  ('relationship_style', 'mix',           'A mix of close and new',                  'Balance between depth and breadth. Relationships deepen, but new connections are valued too.', '{"trust_depth_weight":0.6,"trust_breadth_weight":0.4}',  20),
  ('relationship_style', 'wide_web',      'A wide web of connections',               'Trust spreads broadly. The system values meeting new people across the network.',              '{"trust_depth_weight":0.3,"trust_breadth_weight":0.7}',  30),
  -- asking_for_help
  ('asking_for_help',    'givers_matter', 'Givers matter more — asking has a cost',  'Helpers earn most of the karma. Asking is meaningful but carries weight.',                    '{"karma_split_helper":80,"karma_split_requestor":20}',   10),
  ('asking_for_help',    'balanced',      'Giving and asking are equally valued',     'Karma is shared fairly. Both roles are honored in the community.',                            '{"karma_split_helper":60,"karma_split_requestor":40}',   20),
  ('asking_for_help',    'asking_is_brave', 'Asking is brave — we celebrate vulnerability', 'Both helpers and requestors earn generously. Reaching out is an act of trust.',       '{"karma_split_helper":60,"karma_split_requestor":60}',   30),
  -- generosity_memory
  ('generosity_memory',  'forever',       'They echo forever — contributions compound', 'Karma and trust decay very slowly. Long-term members benefit from their history.',         '{"karma_decay_half_life_days":365,"trust_decay_half_life_days":365}', 10),
  ('generosity_memory',  'seasonal',      'For a season — recent months matter most', 'Contributions fade over a few months. Staying active keeps your standing.',                  '{"karma_decay_half_life_days":90,"trust_decay_half_life_days":180}',  20),
  ('generosity_memory',  'present',       'We live in the present — freshness wins',  'Karma and trust refresh quickly. What you did last month matters more than last year.',       '{"karma_decay_half_life_days":30,"trust_decay_half_life_days":60}',   30),
  -- request_curation (display_order 50 — merges last, overrides request_approval_required from new_member_warmth)
  ('request_curation',   'admin_review',  'Admins review every request before it''s visible', 'Higher curation. Nothing appears until a moderator approves it.',               '{"request_approval_required":true}',  10),
  ('request_curation',   'trust_freely',  'Members post freely — we trust them',     'Requests are visible immediately. The community self-moderates.',                            '{"request_approval_required":false}', 20)
) AS c(slug, value, label, description, config_delta, display_order)
  ON q.slug = c.slug
ON CONFLICT (question_id, value) DO NOTHING;

COMMIT;
