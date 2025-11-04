// Test utilities and mocks for community service tests

export const mockCommunity = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Community',
  description: 'A test community for mutual aid',
  max_members: 150,
  current_members: 1,
  creator_id: '123e4567-e89b-12d3-a456-426614174001',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockMember = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  community_id: '123e4567-e89b-12d3-a456-426614174000',
  user_id: '123e4567-e89b-12d3-a456-426614174001',
  role: 'admin',
  status: 'active',
  joined_at: new Date().toISOString(),
};

export const mockNorm = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  community_id: '123e4567-e89b-12d3-a456-426614174000',
  description: 'Always be respectful to other members',
  rationale: 'Respect is fundamental to mutual aid',
  created_by: '123e4567-e89b-12d3-a456-426614174001',
  status: 'proposed',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock database query results
export const mockQueryResult = (rows: any[]) => ({
  rows,
  rowCount: rows.length,
  command: '',
  oid: 0,
  fields: [],
});
