CREATE TABLE requests.request_admin_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES requests.help_requests(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities.communities(id) ON DELETE CASCADE,
    note TEXT NOT NULL DEFAULT '',
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_request_community_note UNIQUE (request_id, community_id)
);
CREATE INDEX idx_request_admin_notes_request ON requests.request_admin_notes(request_id);
CREATE INDEX idx_request_admin_notes_community ON requests.request_admin_notes(community_id);
