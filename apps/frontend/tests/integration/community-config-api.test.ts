/**
 * Integration Tests: Community Configuration API Workflows
 *
 * Tests full API workflows for community configuration management.
 * Requires backend services to be running.
 */

import axios from 'axios'

// Use real API URL or mock depending on environment
const API_BASE_URL = process.env.NEXT_PUBLIC_COMMUNITY_API_URL || 'http://localhost:3002'

// Test configuration data
const mockConfig = {
  member_cap: 100,
  visibility_mode: 'public',
  outsider_response_allowed: false,
  enabled_request_types: [
    { name: 'meal_share', description: 'Share meals', karma_multiplier: 1.0 },
    { name: 'tool_borrow', description: 'Borrow tools', karma_multiplier: 0.8 }
  ],
  karma_split_helper: 60,
  karma_split_requestor: 40,
  base_karma_pool_per_request: 100,
  karma_decay_half_life_days: 0,
  trust_depth_weight: 0.6,
  trust_breadth_weight: 0.4,
  trust_decay_half_life_days: 90,
  trust_path_max_hops: 3,
  min_interactions_for_trust: 1,
  request_approval_required: false,
  new_member_karma_lockout_days: 0,
  join_approval_required: true,
  joining_counts_as_interaction: true
}

describe.skip('Community Configuration API Integration', () => {
  let communityId: string
  let founderId: string
  let authToken: string

  beforeAll(async () => {
    // Setup: Create test user and community
    // This would need to be implemented based on your auth setup
    // For now, skip these tests until backend is ready
  })

  afterAll(async () => {
    // Cleanup: Delete test community
  })

  describe('Template Endpoints', () => {
    it('should fetch available configuration templates', async () => {
      const response = await axios.get(`${API_BASE_URL}/communities/config-templates`, {
        params: { sort_by: 'usage', public_only: true }
      })

      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)
      expect(response.data.data.templates).toBeInstanceOf(Array)
      expect(response.data.data.templates.length).toBeGreaterThan(0)

      // Verify template structure
      const template = response.data.data.templates[0]
      expect(template).toHaveProperty('id')
      expect(template).toHaveProperty('name')
      expect(template).toHaveProperty('description')
      expect(template).toHaveProperty('config_preview')
      expect(template).toHaveProperty('full_config')
    })

    it('should sort templates by usage count', async () => {
      const response = await axios.get(`${API_BASE_URL}/communities/config-templates`, {
        params: { sort_by: 'usage' }
      })

      const templates = response.data.data.templates
      expect(templates.length).toBeGreaterThan(1)

      // Verify templates are sorted by usage_count descending
      for (let i = 0; i < templates.length - 1; i++) {
        expect(templates[i].usage_count).toBeGreaterThanOrEqual(templates[i + 1].usage_count)
      }
    })

    it('should sort templates by name alphabetically', async () => {
      const response = await axios.get(`${API_BASE_URL}/communities/config-templates`, {
        params: { sort_by: 'name' }
      })

      const templates = response.data.data.templates
      const names = templates.map((t: any) => t.name)
      const sortedNames = [...names].sort()

      expect(names).toEqual(sortedNames)
    })
  })

  describe('Configuration CRUD', () => {
    it('should create community with default configuration', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/communities`,
        {
          name: 'Test Community',
          description: 'Integration test community',
          creator_id: founderId
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      )

      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)

      communityId = response.data.data.id

      // Verify default config was created
      const configResponse = await axios.get(`${API_BASE_URL}/communities/${communityId}/config`)

      expect(configResponse.data.success).toBe(true)
      expect(configResponse.data.data.config).toBeDefined()
      expect(configResponse.data.data.template_source).toBe('Cohousing Default')
    })

    it('should fetch community configuration', async () => {
      const response = await axios.get(`${API_BASE_URL}/communities/${communityId}/config`)

      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)
      expect(response.data.data.community_id).toBe(communityId)
      expect(response.data.data.config).toHaveProperty('member_cap')
      expect(response.data.data.config).toHaveProperty('visibility_mode')
      expect(response.data.data.config).toHaveProperty('enabled_request_types')
    })

    it('should update community configuration (founder only)', async () => {
      const updates = {
        karma_split_helper: 70,
        karma_split_requestor: 30,
        visibility_mode: 'hybrid'
      }

      const response = await axios.put(
        `${API_BASE_URL}/communities/${communityId}/config`,
        { config_updates: updates },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      )

      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)
      expect(response.data.data.config.karma_split_helper).toBe(70)
      expect(response.data.data.config.karma_split_requestor).toBe(30)
      expect(response.data.data.config.visibility_mode).toBe('hybrid')
    })

    it('should reject invalid configuration updates', async () => {
      const invalidUpdates = {
        member_cap: 200, // Exceeds Dunbar's number
        trust_depth_weight: 0.7,
        trust_breadth_weight: 0.5 // Sum > 1.0
      }

      try {
        await axios.put(
          `${API_BASE_URL}/communities/${communityId}/config`,
          { config_updates: invalidUpdates },
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        )
        fail('Should have rejected invalid config')
      } catch (error: any) {
        expect(error.response.status).toBe(400)
        expect(error.response.data.success).toBe(false)
      }
    })
  })

  describe('Configuration Copy Workflow', () => {
    let sourceCommunityId: string
    let targetCommunityId: string

    beforeAll(async () => {
      // Create source community with custom config
      const sourceResponse = await axios.post(
        `${API_BASE_URL}/communities`,
        {
          name: 'Source Community',
          description: 'Source for copying',
          creator_id: founderId,
          config: {
            custom_config: mockConfig
          }
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      )
      sourceCommunityId = sourceResponse.data.data.id

      // Create target community
      const targetResponse = await axios.post(
        `${API_BASE_URL}/communities`,
        {
          name: 'Target Community',
          description: 'Target for copying',
          creator_id: founderId
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      )
      targetCommunityId = targetResponse.data.data.id
    })

    it('should copy configuration from another community', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/communities/${targetCommunityId}/config/copy-from/${sourceCommunityId}`,
        { include_request_types: true },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      )

      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)
      expect(response.data.data.copied_from).toBe(sourceCommunityId)

      // Verify config was actually copied
      const configResponse = await axios.get(
        `${API_BASE_URL}/communities/${targetCommunityId}/config`
      )

      expect(configResponse.data.data.config.karma_split_helper).toBe(mockConfig.karma_split_helper)
      expect(configResponse.data.data.config.enabled_request_types).toHaveLength(
        mockConfig.enabled_request_types.length
      )
    })

    it('should copy configuration without request types when requested', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/communities/${targetCommunityId}/config/copy-from/${sourceCommunityId}`,
        { include_request_types: false },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      )

      expect(response.status).toBe(200)

      // Verify request types were not copied (should keep target's original types)
      const configResponse = await axios.get(
        `${API_BASE_URL}/communities/${targetCommunityId}/config`
      )

      const requestTypes = configResponse.data.data.config.enabled_request_types
      expect(requestTypes).not.toEqual(mockConfig.enabled_request_types)
    })
  })

  describe('Thriving Communities', () => {
    it('should fetch public configurations from thriving communities', async () => {
      const response = await axios.get(`${API_BASE_URL}/communities/configs/public`, {
        params: { min_members: 5 }
      })

      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)
      expect(response.data.data.communities).toBeInstanceOf(Array)

      // Verify each community meets minimum member requirement
      response.data.data.communities.forEach((community: any) => {
        expect(community.member_count).toBeGreaterThanOrEqual(5)
        expect(community).toHaveProperty('community_id')
        expect(community).toHaveProperty('name')
        expect(community).toHaveProperty('config')
      })
    })

    it('should filter by minimum members correctly', async () => {
      const response10 = await axios.get(`${API_BASE_URL}/communities/configs/public`, {
        params: { min_members: 10 }
      })

      const response50 = await axios.get(`${API_BASE_URL}/communities/configs/public`, {
        params: { min_members: 50 }
      })

      expect(response10.data.data.communities.length).toBeGreaterThanOrEqual(
        response50.data.data.communities.length
      )

      // Verify all communities in response50 have >= 50 members
      response50.data.data.communities.forEach((community: any) => {
        expect(community.member_count).toBeGreaterThanOrEqual(50)
      })
    })

    it('should only return public or hybrid visibility communities', async () => {
      const response = await axios.get(`${API_BASE_URL}/communities/configs/public`)

      expect(response.data.success).toBe(true)

      response.data.data.communities.forEach((community: any) => {
        expect(['public', 'hybrid']).toContain(community.config.visibility_mode)
      })
    })
  })

  describe('Validation Edge Cases', () => {
    it('should enforce trust weights sum to 1.0', async () => {
      const invalidConfig = {
        trust_depth_weight: 0.7,
        trust_breadth_weight: 0.5
      }

      try {
        await axios.put(
          `${API_BASE_URL}/communities/${communityId}/config`,
          { config_updates: invalidConfig },
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        )
        fail('Should have rejected invalid trust weights')
      } catch (error: any) {
        expect(error.response.status).toBe(400)
        expect(error.response.data.message).toContain('trust')
      }
    })

    it('should enforce request type name uniqueness', async () => {
      const invalidConfig = {
        enabled_request_types: [
          { name: 'meal_share', description: 'First', karma_multiplier: 1.0 },
          { name: 'meal_share', description: 'Duplicate', karma_multiplier: 0.9 }
        ]
      }

      try {
        await axios.put(
          `${API_BASE_URL}/communities/${communityId}/config`,
          { config_updates: invalidConfig },
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        )
        fail('Should have rejected duplicate request type names')
      } catch (error: any) {
        expect(error.response.status).toBe(400)
        expect(error.response.data.message).toContain('unique')
      }
    })

    it('should enforce request type name format (lowercase_underscore)', async () => {
      const invalidConfig = {
        enabled_request_types: [
          { name: 'Meal Share', description: 'Invalid format', karma_multiplier: 1.0 }
        ]
      }

      try {
        await axios.put(
          `${API_BASE_URL}/communities/${communityId}/config`,
          { config_updates: invalidConfig },
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        )
        fail('Should have rejected invalid request type name format')
      } catch (error: any) {
        expect(error.response.status).toBe(400)
      }
    })
  })
})
