/**
 * Large-Scale Realistic Test Data Generator for Karmyq v8.0
 *
 * Generates production-scale test data matching actual database schema:
 * - 2000 users with realistic names
 * - 200 communities with varying sizes
 * - 6 months of help requests and offers
 * - Matches, conversations, messages
 * - Karma records and milestones
 * - Test personas for E2E testing
 */

import { faker } from '@faker-js/faker'
import * as fs from 'fs'
import * as path from 'path'

const CONFIG = {
  users: 2000,
  communities: 200,
  monthsOfHistory: 6,
  activityDistribution: {
    veryActive: 0.05,
    active: 0.20,
    moderate: 0.45,
    occasional: 0.30
  },
  communityDistribution: {
    large: { count: 20, minMembers: 50, maxMembers: 150 },
    medium: { count: 60, minMembers: 15, maxMembers: 50 },
    small: { count: 120, minMembers: 3, maxMembers: 15 }
  }
}

const TEST_PERSONAS = [
  { email: 'new.user@test.com', name: 'New User', type: 'new' },
  { email: 'power.helper@test.com', name: 'Power Helper', type: 'power_helper' },
  { email: 'frequent.requester@test.com', name: 'Frequent Requester', type: 'frequent_requester' },
  { email: 'community.moderator@test.com', name: 'Community Moderator', type: 'moderator' },
  { email: 'balanced.user@test.com', name: 'Balanced User', type: 'balanced' },
  { email: 'occasional.user@test.com', name: 'Occasional User', type: 'occasional' },
  { email: 'multi.community@test.com', name: 'Multi Community Member', type: 'multi_community' }
]

const HELP_CATEGORIES = [
  { category: 'tech', templates: [
    'Need help setting up {item}',
    'Looking for someone to help with {task}',
    'Can someone help me {action}?'
  ], items: ['laptop', 'WiFi router', 'smart home devices', 'printer'], tasks: ['computer issues', 'software installation', 'website building'], actions: ['fix my computer', 'install software', 'troubleshoot tech issues'] },

  { category: 'household', templates: [
    'Need help with {task}',
    'Looking for help {action}',
    'Can someone assist with {item}?'
  ], tasks: ['yard work', 'home repairs', 'painting', 'cleaning'], actions: ['moving furniture', 'fixing a leak', 'organizing garage'], items: ['garden maintenance', 'minor repairs', 'deep cleaning'] },

  { category: 'skills', templates: [
    'Want to learn {skill}',
    'Looking for {skill} lessons',
    'Can someone teach me {skill}?'
  ], skills: ['guitar', 'cooking', 'photography', 'language', 'woodworking', 'knitting', 'yoga'] },

  { category: 'transportation', templates: [
    'Need a ride to {destination}',
    'Looking for help getting to {destination}',
    'Can someone drive me to {destination}?'
  ], destinations: ['airport', 'doctor appointment', 'grocery store', 'work', 'school'] }
]

type ActivityLevel = 'very_active' | 'active' | 'moderate' | 'occasional'

function getActivityLevel(index: number, total: number): ActivityLevel {
  const percentile = index / total
  if (percentile < CONFIG.activityDistribution.veryActive) return 'very_active'
  if (percentile < CONFIG.activityDistribution.veryActive + CONFIG.activityDistribution.active) return 'active'
  if (percentile < 1 - CONFIG.activityDistribution.occasional) return 'moderate'
  return 'occasional'
}

function generateTimestamp(daysAgo: number): Date {
  const now = new Date()
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  const hour = faker.number.int({ min: 8, max: 22 })
  date.setHours(hour, faker.number.int({ min: 0, max: 59 }), 0, 0)
  return date
}

function generateHelpRequest() {
  const cat = faker.helpers.arrayElement(HELP_CATEGORIES)
  const template = faker.helpers.arrayElement(cat.templates)
  const key = Object.keys(cat).find(k => k !== 'category' && k !== 'templates')!
  const value = faker.helpers.arrayElement(cat[key as keyof typeof cat] as string[])

  return {
    title: template.replace(`{${key}}`, value),
    description: faker.lorem.sentence(),
    category: cat.category
  }
}

class LargeDatasetGenerator {
  private sql: string[] = []
  private users: any[] = []
  private communities: any[] = []
  private members: any[] = []
  private requests: any[] = []
  private requestCommunities: any[] = []
  private offers: any[] = []
  private matches: any[] = []
  private conversations: any[] = []
  private messages: any[] = []
  private karmaRecords: any[] = []

  private escapeSql(str: string): string {
    return str.replace(/'/g, "''")
  }

  async generate() {
    console.log('🚀 Generating large-scale test data...\n')

    this.generateUsers()
    this.generateCommunities()
    this.generateMembers()
    this.generateHelpRequests()
    this.generateHelpOffers()
    this.generateMatches()
    this.generateConversationsAndMessages()
    this.generateKarma()
    this.generateMilestones()

    this.writeSQL()

    console.log('\n✅ Generation complete!')
  }

  private generateUsers() {
    console.log('👥 Generating 2000 users...')

    // Test personas first (password: password123)
    const testPasswordHash = '$2b$10$heb9jSoho/kIsVT.iBFTsOgAwi/.tueVN3j7ywXs0Z6CJ1p9XULSS'
    for (const persona of TEST_PERSONAS) {
      this.users.push({
        id: faker.string.uuid(),
        email: persona.email,
        name: persona.name,
        password_hash: testPasswordHash,
        created_at: persona.type === 'new' ? new Date() : generateTimestamp(faker.number.int({ min: 30, max: 180 })),
        activity_level: persona.type === 'power_helper' ? 'very_active' :
                       persona.type === 'occasional' ? 'occasional' : 'active'
      })
    }

    // Regular users
    for (let i = TEST_PERSONAS.length; i < CONFIG.users; i++) {
      const firstName = faker.person.firstName()
      const lastName = faker.person.lastName()

      this.users.push({
        id: faker.string.uuid(),
        email: faker.internet.email({ firstName, lastName }),
        name: `${firstName} ${lastName}`,
        password_hash: '$2b$10$examplehash',
        created_at: generateTimestamp(faker.number.int({ min: 1, max: 180 })),
        activity_level: getActivityLevel(i, CONFIG.users)
      })
    }

    console.log(`  ✓ Created ${this.users.length} users`)
  }

  private generateCommunities() {
    console.log('📍 Generating 200 communities...')

    const { large, medium, small } = CONFIG.communityDistribution

    for (let i = 0; i < large.count; i++) {
      const creator = faker.helpers.arrayElement(this.users)
      this.communities.push({
        id: faker.string.uuid(),
        name: `${faker.location.city()} Mutual Aid`,
        description: faker.lorem.sentence(),
        creator_id: creator.id,
        targetMembers: faker.number.int({ min: large.minMembers, max: large.maxMembers }),
        size: 'large'
      })
    }

    for (let i = 0; i < medium.count; i++) {
      const creator = faker.helpers.arrayElement(this.users)
      this.communities.push({
        id: faker.string.uuid(),
        name: `${faker.helpers.arrayElement(['Tech', 'Art', 'Book', 'Garden'])} ${faker.helpers.arrayElement(['Circle', 'Network', 'Group'])}`,
        description: faker.lorem.sentence(),
        creator_id: creator.id,
        targetMembers: faker.number.int({ min: medium.minMembers, max: medium.maxMembers }),
        size: 'medium'
      })
    }

    for (let i = 0; i < small.count; i++) {
      const creator = faker.helpers.arrayElement(this.users)
      this.communities.push({
        id: faker.string.uuid(),
        name: `${faker.location.street()} Neighbors`,
        description: faker.lorem.sentence(),
        creator_id: creator.id,
        targetMembers: faker.number.int({ min: small.minMembers, max: small.maxMembers }),
        size: 'small'
      })
    }

    console.log(`  ✓ Created ${this.communities.length} communities`)
  }

  private generateMembers() {
    console.log('🤝 Generating memberships...')

    let memberCount = 0

    for (const community of this.communities) {
      const targetMembers = community.targetMembers
      const memberPool = faker.helpers.arrayElements(this.users, Math.min(targetMembers, this.users.length))

      for (let i = 0; i < memberPool.length; i++) {
        const user = memberPool[i]
        const role = user.id === community.creator_id ? 'moderator' :
                    (i < 2 ? 'helper' : 'member')

        this.members.push({
          id: faker.string.uuid(),
          community_id: community.id,
          user_id: user.id,
          role,
          joined_at: generateTimestamp(faker.number.int({ min: 1, max: 150 }))
        })
        memberCount++
      }
    }

    console.log(`  ✓ Created ${memberCount} memberships`)
  }

  private generateHelpRequests() {
    console.log('📝 Generating help requests...')

    let requestCount = 0

    for (const user of this.users) {
      // Get user's communities
      const userMemberships = this.members.filter(m => m.user_id === user.id)
      if (userMemberships.length === 0) continue

      const numRequests = user.activity_level === 'very_active' ? faker.number.int({ min: 5, max: 15 }) :
                         user.activity_level === 'active' ? faker.number.int({ min: 2, max: 8 }) :
                         user.activity_level === 'moderate' ? faker.number.int({ min: 1, max: 4 }) :
                         faker.number.int({ min: 0, max: 2 })

      for (let i = 0; i < numRequests; i++) {
        const daysAgo = faker.number.int({ min: 0, max: 180 })
        const request = generateHelpRequest()
        const requestId = faker.string.uuid()

        this.requests.push({
          id: requestId,
          requester_id: user.id,
          title: request.title,
          description: request.description,
          category: request.category,
          status: daysAgo > 60 ? 'expired' : (daysAgo > 30 && Math.random() < 0.3 ? 'matched' : 'open'),
          created_at: generateTimestamp(daysAgo)
        })

        // Link to one of user's communities
        const userMembership = faker.helpers.arrayElement(userMemberships)
        this.requestCommunities.push({
          id: faker.string.uuid(),
          request_id: requestId,
          community_id: userMembership.community_id
        })

        requestCount++
      }
    }

    console.log(`  ✓ Created ${requestCount} help requests`)
  }

  private generateHelpOffers() {
    console.log('🙋 Generating help offers...')

    let offerCount = 0

    // Generate offers for open requests
    const openRequests = this.requests.filter(r => r.status === 'open' || r.status === 'matched')

    for (const request of openRequests) {
      // Get potential helpers from same community
      const requestCommunity = this.requestCommunities.find(rc => rc.request_id === request.id)
      if (!requestCommunity) continue

      const potentialHelpers = this.members
        .filter(m => m.community_id === requestCommunity.community_id && m.user_id !== request.requester_id)
        .map(m => m.user_id)

      if (potentialHelpers.length === 0) continue

      // Create 1-3 offers per request
      const numOffers = faker.number.int({ min: 1, max: 3 })
      const helpers = faker.helpers.arrayElements(potentialHelpers, Math.min(numOffers, potentialHelpers.length))

      for (const helperId of helpers) {
        const offerRequest = generateHelpRequest()
        this.offers.push({
          id: faker.string.uuid(),
          community_id: requestCommunity.community_id,
          offerer_id: helperId,
          title: `Can help with: ${offerRequest.title}`,
          description: 'Happy to help! I have experience with this.',
          category: request.category,
          status: 'active',
          created_at: new Date(request.created_at.getTime() + faker.number.int({ min: 1, max: 48 }) * 60 * 60 * 1000)
        })
        offerCount++
      }
    }

    console.log(`  ✓ Created ${offerCount} help offers`)
  }

  private generateMatches() {
    console.log('🤝 Generating matches...')

    let matchCount = 0

    // Create matches for some requests
    const matchableRequests = this.requests.filter(r => r.status === 'matched')

    for (const request of matchableRequests) {
      // Find a responder from the same community
      const requestCommunity = this.requestCommunities.find(rc => rc.request_id === request.id)
      if (!requestCommunity) continue

      const potentialResponders = this.members
        .filter(m => m.community_id === requestCommunity.community_id && m.user_id !== request.requester_id)

      if (potentialResponders.length === 0) continue

      const responder = faker.helpers.arrayElement(potentialResponders)
      const isCompleted = Math.random() < 0.7

      this.matches.push({
        id: faker.string.uuid(),
        request_id: request.id,
        offer_id: null,
        responder_id: responder.user_id,
        status: isCompleted ? 'completed' : 'active',
        completed_at: isCompleted ? new Date(request.created_at.getTime() + faker.number.int({ min: 2, max: 14 }) * 24 * 60 * 60 * 1000) : null,
        created_at: new Date(request.created_at.getTime() + faker.number.int({ min: 1, max: 3 }) * 24 * 60 * 60 * 1000)
      })
      matchCount++
    }

    console.log(`  ✓ Created ${matchCount} matches`)
  }

  private generateConversationsAndMessages() {
    console.log('💬 Generating conversations and messages...')

    let conversationCount = 0
    let messageCount = 0

    for (const match of this.matches) {
      // Create conversation
      const conversationId = faker.string.uuid()
      this.conversations.push({
        id: conversationId,
        request_match_id: match.id,
        created_at: match.created_at
      })
      conversationCount++

      // Get requester
      const request = this.requests.find(r => r.id === match.request_id)
      if (!request) continue

      // Generate 3-10 messages
      const numMessages = faker.number.int({ min: 3, max: 10 })
      for (let i = 0; i < numMessages; i++) {
        const isRequester = i % 2 === 0
        const messages = [
          'Thanks for offering to help!',
          'Happy to help! When works for you?',
          'How about this Saturday?',
          'That works for me!',
          'Great, see you then!',
          'Thanks again!',
          'No problem!'
        ]

        this.messages.push({
          id: faker.string.uuid(),
          sender_id: isRequester ? request.requester_id : match.responder_id,
          conversation_id: conversationId,
          content: faker.helpers.arrayElement(messages),
          created_at: new Date(match.created_at.getTime() + i * faker.number.int({ min: 1, max: 24 }) * 60 * 60 * 1000)
        })
        messageCount++
      }
    }

    console.log(`  ✓ Created ${conversationCount} conversations and ${messageCount} messages`)
  }

  private generateKarma() {
    console.log('⭐ Generating karma records...')

    let karmaCount = 0

    // Award karma for completed matches
    for (const match of this.matches.filter(m => m.status === 'completed')) {
      const request = this.requests.find(r => r.id === match.request_id)
      const requestCommunity = this.requestCommunities.find(rc => rc.request_id === match.request_id)
      if (!request || !requestCommunity) continue

      // Helper gets karma
      this.karmaRecords.push({
        id: faker.string.uuid(),
        user_id: match.responder_id,
        community_id: requestCommunity.community_id,
        points: 10,
        reason: 'Completed help request',
        related_entity_id: match.id,
        created_at: match.completed_at
      })
      karmaCount++

      // Requester gets karma
      this.karmaRecords.push({
        id: faker.string.uuid(),
        user_id: request.requester_id,
        community_id: requestCommunity.community_id,
        points: 5,
        reason: 'Received help',
        related_entity_id: match.id,
        created_at: match.completed_at
      })
      karmaCount++
    }

    // Add bonus karma to very active users
    for (const user of this.users.filter(u => u.activity_level === 'very_active')) {
      const userMemberships = this.members.filter(m => m.user_id === user.id)
      if (userMemberships.length > 0) {
        const membership = faker.helpers.arrayElement(userMemberships)
        this.karmaRecords.push({
          id: faker.string.uuid(),
          user_id: user.id,
          community_id: membership.community_id,
          points: 50,
          reason: 'Consistent community participation',
          related_entity_id: null,
          created_at: generateTimestamp(45)
        })
        karmaCount++
      }
    }

    console.log(`  ✓ Created ${karmaCount} karma records`)
  }

  private generateMilestones() {
    console.log('🏆 Generating milestones...')

    const milestones: any[] = []

    for (const community of this.communities) {
      // Count matches in this community
      const communityRequests = this.requestCommunities.filter(rc => rc.community_id === community.id).map(rc => rc.request_id)
      const communityMatches = this.matches.filter(m => communityRequests.includes(m.request_id) && m.status === 'completed')
      const matchCount = communityMatches.length

      // Generate milestone based on size
      if (matchCount >= 50 && community.size === 'large') {
        milestones.push({
          id: faker.string.uuid(),
          community_id: community.id,
          milestone_type: 'matches_50',
          milestone_value: 50,
          description: '50 successful exchanges completed!',
          achieved_at: generateTimestamp(faker.number.int({ min: 20, max: 60 })),
          is_featured: true
        })
      } else if (matchCount >= 25 && (community.size === 'medium' || community.size === 'large')) {
        milestones.push({
          id: faker.string.uuid(),
          community_id: community.id,
          milestone_type: 'matches_25',
          milestone_value: 25,
          description: '25 successful exchanges completed!',
          achieved_at: generateTimestamp(faker.number.int({ min: 30, max: 90 })),
          is_featured: true
        })
      } else if (matchCount >= 10) {
        milestones.push({
          id: faker.string.uuid(),
          community_id: community.id,
          milestone_type: 'matches_10',
          milestone_value: 10,
          description: '10 successful exchanges completed!',
          achieved_at: generateTimestamp(faker.number.int({ min: 40, max: 120 })),
          is_featured: false
        })
      }

      // Member milestones
      const memberCount = this.members.filter(m => m.community_id === community.id).length
      if (memberCount >= 100) {
        milestones.push({
          id: faker.string.uuid(),
          community_id: community.id,
          milestone_type: 'participants_100',
          milestone_value: 100,
          description: '100 members joined!',
          achieved_at: generateTimestamp(faker.number.int({ min: 50, max: 100 })),
          is_featured: true
        })
      } else if (memberCount >= 50) {
        milestones.push({
          id: faker.string.uuid(),
          community_id: community.id,
          milestone_type: 'participants_50',
          milestone_value: 50,
          description: '50 members joined!',
          achieved_at: generateTimestamp(faker.number.int({ min: 60, max: 120 })),
          is_featured: false
        })
      }
    }

    console.log(`  ✓ Created ${milestones.length} milestones`)

    // Store for SQL generation
    this.sql.push('-- Insert milestones')
    for (const milestone of milestones) {
      this.sql.push(
        `INSERT INTO reputation.milestone_events (id, community_id, milestone_type, milestone_value, description, achieved_at, is_featured) VALUES ` +
        `('${milestone.id}', '${milestone.community_id}', '${milestone.milestone_type}', ${milestone.milestone_value}, '${this.escapeSql(milestone.description)}', '${milestone.achieved_at.toISOString()}', ${milestone.is_featured});`
      )
    }
    this.sql.push('')
  }

  private writeSQL() {
    console.log('\n📄 Writing SQL file...')

    const header = [
      '-- Karmyq v8.0 Large-Scale Test Data',
      `-- Generated: ${new Date().toISOString()}`,
      `-- ${this.users.length} users, ${this.communities.length} communities`,
      '',
      '-- Clean existing data',
      'TRUNCATE TABLE messaging.messages CASCADE;',
      'TRUNCATE TABLE messaging.conversations CASCADE;',
      'TRUNCATE TABLE requests.matches CASCADE;',
      'TRUNCATE TABLE requests.help_offers CASCADE;',
      'TRUNCATE TABLE requests.request_communities CASCADE;',
      'TRUNCATE TABLE requests.help_requests CASCADE;',
      'TRUNCATE TABLE reputation.karma_records CASCADE;',
      'TRUNCATE TABLE reputation.milestone_events CASCADE;',
      'TRUNCATE TABLE communities.members CASCADE;',
      'TRUNCATE TABLE communities.communities CASCADE;',
      'TRUNCATE TABLE auth.users CASCADE;',
      ''
    ]

    const allSQL: string[] = [...header]

    // Users
    allSQL.push('-- Insert users')
    for (const user of this.users) {
      allSQL.push(
        `INSERT INTO auth.users (id, email, name, password_hash, created_at) VALUES ` +
        `('${user.id}', '${this.escapeSql(user.email)}', '${this.escapeSql(user.name)}', '${user.password_hash}', '${user.created_at.toISOString()}');`
      )
    }
    allSQL.push('')

    // Communities
    allSQL.push('-- Insert communities')
    for (const community of this.communities) {
      allSQL.push(
        `INSERT INTO communities.communities (id, name, description, creator_id, created_at) VALUES ` +
        `('${community.id}', '${this.escapeSql(community.name)}', '${this.escapeSql(community.description)}', '${community.creator_id}', NOW());`
      )
    }
    allSQL.push('')

    // Members
    allSQL.push('-- Insert members')
    for (const member of this.members) {
      allSQL.push(
        `INSERT INTO communities.members (id, community_id, user_id, role, joined_at) VALUES ` +
        `('${member.id}', '${member.community_id}', '${member.user_id}', '${member.role}', '${member.joined_at.toISOString()}');`
      )
    }
    allSQL.push('')

    // Requests
    allSQL.push('-- Insert help requests')
    for (const request of this.requests) {
      allSQL.push(
        `INSERT INTO requests.help_requests (id, requester_id, title, description, category, status, created_at) VALUES ` +
        `('${request.id}', '${request.requester_id}', '${this.escapeSql(request.title)}', '${this.escapeSql(request.description)}', '${request.category}', '${request.status}', '${request.created_at.toISOString()}');`
      )
    }
    allSQL.push('')

    // Request Communities
    allSQL.push('-- Link requests to communities')
    for (const rc of this.requestCommunities) {
      allSQL.push(
        `INSERT INTO requests.request_communities (id, request_id, community_id) VALUES ` +
        `('${rc.id}', '${rc.request_id}', '${rc.community_id}');`
      )
    }
    allSQL.push('')

    // Offers
    allSQL.push('-- Insert help offers')
    for (const offer of this.offers) {
      allSQL.push(
        `INSERT INTO requests.help_offers (id, community_id, offerer_id, title, description, category, status, created_at) VALUES ` +
        `('${offer.id}', '${offer.community_id}', '${offer.offerer_id}', '${this.escapeSql(offer.title)}', '${this.escapeSql(offer.description)}', '${offer.category}', '${offer.status}', '${offer.created_at.toISOString()}');`
      )
    }
    allSQL.push('')

    // Matches
    allSQL.push('-- Insert matches')
    for (const match of this.matches) {
      const completedAt = match.completed_at ? `'${match.completed_at.toISOString()}'` : 'NULL'
      allSQL.push(
        `INSERT INTO requests.matches (id, request_id, offer_id, responder_id, status, completed_at, created_at) VALUES ` +
        `('${match.id}', '${match.request_id}', ${match.offer_id ? `'${match.offer_id}'` : 'NULL'}, '${match.responder_id}', '${match.status}', ${completedAt}, '${match.created_at.toISOString()}');`
      )
    }
    allSQL.push('')

    // Conversations
    allSQL.push('-- Insert conversations')
    for (const conv of this.conversations) {
      allSQL.push(
        `INSERT INTO messaging.conversations (id, request_match_id, created_at) VALUES ` +
        `('${conv.id}', '${conv.request_match_id}', '${conv.created_at.toISOString()}');`
      )
    }
    allSQL.push('')

    // Messages
    allSQL.push('-- Insert messages')
    for (const message of this.messages) {
      allSQL.push(
        `INSERT INTO messaging.messages (id, sender_id, conversation_id, content, created_at) VALUES ` +
        `('${message.id}', '${message.sender_id}', '${message.conversation_id}', '${this.escapeSql(message.content)}', '${message.created_at.toISOString()}');`
      )
    }
    allSQL.push('')

    // Karma
    allSQL.push('-- Insert karma records')
    for (const karma of this.karmaRecords) {
      allSQL.push(
        `INSERT INTO reputation.karma_records (id, user_id, community_id, points, reason, related_entity_id, created_at) VALUES ` +
        `('${karma.id}', '${karma.user_id}', '${karma.community_id}', ${karma.points}, '${this.escapeSql(karma.reason)}', ${karma.related_entity_id ? `'${karma.related_entity_id}'` : 'NULL'}, '${karma.created_at.toISOString()}');`
      )
    }
    allSQL.push('')

    // Add milestone SQL (already generated in generateMilestones)
    allSQL.push(...this.sql)

    // Write to file
    const sqlPath = path.join(__dirname, 'large-dataset.sql')
    fs.writeFileSync(sqlPath, allSQL.join('\n'))

    // Write metadata
    const metadata = {
      generated_at: new Date().toISOString(),
      statistics: {
        users: this.users.length,
        communities: this.communities.length,
        members: this.members.length,
        requests: this.requests.length,
        request_communities: this.requestCommunities.length,
        offers: this.offers.length,
        matches: this.matches.length,
        conversations: this.conversations.length,
        messages: this.messages.length,
        karma_records: this.karmaRecords.length
      }
    }

    const metadataPath = path.join(__dirname, 'large-dataset.json')
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

    console.log(`  ✓ SQL written to: ${sqlPath}`)
    console.log(`  ✓ Metadata written to: ${metadataPath}`)
    console.log(`\n📊 Statistics:`)
    console.log(`  Users: ${metadata.statistics.users}`)
    console.log(`  Communities: ${metadata.statistics.communities}`)
    console.log(`  Members: ${metadata.statistics.members}`)
    console.log(`  Requests: ${metadata.statistics.requests}`)
    console.log(`  Offers: ${metadata.statistics.offers}`)
    console.log(`  Matches: ${metadata.statistics.matches}`)
    console.log(`  Messages: ${metadata.statistics.messages}`)
    console.log(`  Karma Records: ${metadata.statistics.karma_records}`)
  }
}

// Run
const generator = new LargeDatasetGenerator()
generator.generate().catch(console.error)
