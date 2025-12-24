/**
 * Realistic Test Data Generator for Karmyq v8.0
 *
 * Generates:
 * - 2000 users with realistic names and profiles
 * - 200 communities with varying sizes
 * - 6 months of realistic transactions (requests, offers, matches)
 * - Karma and trust scores following power law distribution
 * - Messaging data between matched users
 * - Community milestones
 * - Test personas for E2E testing
 */

import { faker } from '@faker-js/faker'
import * as fs from 'fs'
import * as path from 'path'

// Configuration
const CONFIG = {
  users: 2000,
  communities: 200,
  monthsOfHistory: 6,
  // Power law distribution: few very active, most moderately active, some inactive
  activityDistribution: {
    veryActive: 0.05,    // 5% make 50% of requests
    active: 0.20,        // 20% make 30% of requests
    moderate: 0.45,      // 45% make 15% of requests
    occasional: 0.30     // 30% make 5% of requests
  },
  // Community size distribution
  communityDistribution: {
    large: { count: 20, minMembers: 50, maxMembers: 150 },   // Dunbar limit
    medium: { count: 60, minMembers: 15, maxMembers: 50 },
    small: { count: 120, minMembers: 3, maxMembers: 15 }
  }
}

// Test Personas for E2E testing
const TEST_PERSONAS = [
  {
    email: 'new.user@test.com',
    name: 'New User',
    password: 'password123',
    type: 'new',
    description: 'Brand new user with no karma, no requests yet'
  },
  {
    email: 'power.helper@test.com',
    name: 'Power Helper',
    password: 'password123',
    type: 'power_helper',
    description: 'Very active helper with high karma and trust score'
  },
  {
    email: 'frequent.requester@test.com',
    name: 'Frequent Requester',
    password: 'password123',
    type: 'frequent_requester',
    description: 'Often asks for help, moderate karma'
  },
  {
    email: 'community.moderator@test.com',
    name: 'Community Moderator',
    password: 'password123',
    type: 'moderator',
    description: 'Moderator role with multiple communities'
  },
  {
    email: 'balanced.user@test.com',
    name: 'Balanced User',
    password: 'password123',
    type: 'balanced',
    description: 'Equal giving and receiving, good trust score'
  },
  {
    email: 'occasional.user@test.com',
    name: 'Occasional User',
    password: 'password123',
    type: 'occasional',
    description: 'Logs in rarely, low activity'
  },
  {
    email: 'multi.community@test.com',
    name: 'Multi Community Member',
    password: 'password123',
    type: 'multi_community',
    description: 'Member of 10+ communities'
  }
]

// Realistic help request categories
const REQUEST_CATEGORIES = [
  // Skills & Learning
  { template: 'Need help learning {skill}', skills: ['JavaScript', 'Python', 'cooking', 'guitar', 'Spanish', 'gardening'] },
  { template: 'Can someone teach me {skill}?', skills: ['photography', 'woodworking', 'knitting', 'yoga', 'meditation'] },

  // Household & Moving
  { template: 'Need help moving {item}', items: ['furniture', 'boxes', 'appliances', 'a couch', 'heavy items'] },
  { template: 'Looking for help with {task}', tasks: ['yard work', 'home repairs', 'painting a room', 'assembling furniture'] },

  // Food & Cooking
  { template: 'Could use help with {food}', food: ['meal prep for the week', 'cooking dinner', 'baking bread', 'canning vegetables'] },
  { template: 'Anyone available to {food}?', food: ['share grocery shopping', 'teach me a recipe', 'preserve fruits'] },

  // Childcare & Pets
  { template: 'Need someone to {childcare}', childcare: ['watch my kids for 2 hours', 'pick up from school', 'babysit this weekend'] },
  { template: 'Looking for help {pet}', pet: ['walking my dog', 'feeding my cat', 'pet sitting'] },

  // Transportation
  { template: 'Need a ride to {destination}', destination: ['the airport', 'doctor appointment', 'grocery store', 'work'] },
  { template: 'Can someone help me {transport}?', transport: ['move a bed', 'pick up donations', 'get to the vet'] },

  // Technology
  { template: 'Need help with {tech}', tech: ['setting up WiFi', 'fixing my laptop', 'installing software', 'phone issues'] },
  { template: 'Can someone help me {tech}?', tech: ['troubleshoot tech', 'set up email', 'backup my files'] },

  // Social & Emotional
  { template: 'Looking for someone to {social}', social: ['chat over coffee', 'go for a walk', 'practice interview skills'] },
  { template: 'Need {support}', support: ['someone to talk to', 'advice on career change', 'help with resume'] }
]

// Generate realistic request description
function generateRequest(): string {
  const category = faker.helpers.arrayElement(REQUEST_CATEGORIES)
  const template = category.template
  const key = Object.keys(category).find(k => k !== 'template')!
  const value = faker.helpers.arrayElement(category[key as keyof typeof category] as string[])
  return template.replace(`{${key}}`, value)
}

// Generate realistic offer description (matching request types)
function generateOffer(): string {
  const offers = [
    'Happy to help with this!',
    'I can help you out. Available this weekend.',
    'I have experience with this. Let me know when works.',
    'Would love to help! I\'m free Tuesday evening.',
    'I can definitely help. Message me to coordinate.',
    'This is my specialty! I\'d be glad to assist.',
    'I\'m available and happy to help out.',
    'Count me in! I have some free time this week.'
  ]
  return faker.helpers.arrayElement(offers)
}

// Generate community names
function generateCommunityName(): string {
  const types = [
    // Geographic
    () => `${faker.location.city()} Neighbors`,
    () => `${faker.location.county()} Mutual Aid`,
    () => `${faker.location.street()} Community`,

    // Interest-based
    () => `${faker.helpers.arrayElement(['Tech', 'Art', 'Music', 'Book', 'Garden', 'Food'])} Lovers`,
    () => `${faker.helpers.arrayElement(['Yoga', 'Running', 'Cycling', 'Hiking'])} Group`,

    // Demographics
    () => `${faker.helpers.arrayElement(['Parents', 'Students', 'Professionals', 'Seniors'])} Network`,

    // Purpose
    () => `${faker.helpers.arrayElement(['Skill', 'Tool', 'Time', 'Resource'])} Share`,
    () => `${faker.helpers.arrayElement(['Care', 'Help', 'Support', 'Connection'])} Circle`
  ]

  return faker.helpers.arrayElement(types)()
}

// User activity level
type ActivityLevel = 'very_active' | 'active' | 'moderate' | 'occasional'

function getActivityLevel(index: number, total: number): ActivityLevel {
  const percentile = index / total
  if (percentile < CONFIG.activityDistribution.veryActive) return 'very_active'
  if (percentile < CONFIG.activityDistribution.veryActive + CONFIG.activityDistribution.active) return 'active'
  if (percentile < 1 - CONFIG.activityDistribution.occasional) return 'moderate'
  return 'occasional'
}

// Generate timestamps over 6 months with realistic patterns
function generateTimestamp(daysAgo: number, hourPreference: 'peak' | 'normal' | 'any'): Date {
  const now = new Date()
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)

  let hour: number
  if (hourPreference === 'peak') {
    // Peak hours: 6-9am, 12-1pm, 6-9pm
    hour = faker.helpers.arrayElement([7, 8, 12, 18, 19, 20])
  } else if (hourPreference === 'normal') {
    // Normal waking hours: 8am - 10pm
    hour = faker.number.int({ min: 8, max: 22 })
  } else {
    hour = faker.number.int({ min: 0, max: 23 })
  }

  date.setHours(hour, faker.number.int({ min: 0, max: 59 }), faker.number.int({ min: 0, max: 59 }))
  return date
}

// Main generator class
class RealisticDataGenerator {
  private users: any[] = []
  private communities: any[] = []
  private memberships: any[] = []
  private requests: any[] = []
  private offers: any[] = []
  private matches: any[] = []
  private messages: any[] = []
  private karmaRecords: any[] = []
  private milestones: any[] = []

  private sql: string[] = []

  // Helper to escape SQL strings (handle apostrophes)
  private escapeSql(str: string): string {
    return str.replace(/'/g, "''")
  }

  generate() {
    console.log('🚀 Generating realistic test data for Karmyq v8.0...\n')

    this.generateUsers()         // Generate users first
    this.generateCommunities()   // Then communities (need users for creator_id)
    this.generateMemberships()
    this.generateTestPersonas()
    this.generateRequestsAndOffers()
    this.generateMatches()
    this.generateMessages()
    this.generateKarmaRecords()
    this.generateMilestones()

    this.writeSQL()
    this.writeMetadata()

    console.log('\n✅ Data generation complete!')
  }

  private generateCommunities() {
    console.log('📍 Generating 200 communities...')

    const { large, medium, small } = CONFIG.communityDistribution
    let communityCount = 0

    // Large communities
    for (let i = 0; i < large.count; i++) {
      const creator = faker.helpers.arrayElement(this.users)
      this.communities.push({
        id: faker.string.uuid(),
        name: generateCommunityName(),
        description: faker.lorem.sentence(),
        creator_id: creator.id,
        targetMembers: faker.number.int({ min: large.minMembers, max: large.maxMembers }),
        size: 'large'
      })
      communityCount++
    }

    // Medium communities
    for (let i = 0; i < medium.count; i++) {
      const creator = faker.helpers.arrayElement(this.users)
      this.communities.push({
        id: faker.string.uuid(),
        name: generateCommunityName(),
        description: faker.lorem.sentence(),
        creator_id: creator.id,
        targetMembers: faker.number.int({ min: medium.minMembers, max: medium.maxMembers }),
        size: 'medium'
      })
      communityCount++
    }

    // Small communities
    for (let i = 0; i < small.count; i++) {
      const creator = faker.helpers.arrayElement(this.users)
      this.communities.push({
        id: faker.string.uuid(),
        name: generateCommunityName(),
        description: faker.lorem.sentence(),
        creator_id: creator.id,
        targetMembers: faker.number.int({ min: small.minMembers, max: small.maxMembers }),
        size: 'small'
      })
      communityCount++
    }

    console.log(`  ✓ Created ${communityCount} communities (${large.count} large, ${medium.count} medium, ${small.count} small)`)
  }

  private generateUsers() {
    console.log('👥 Generating 2000 users...')

    for (let i = 0; i < CONFIG.users; i++) {
      const firstName = faker.person.firstName()
      const lastName = faker.person.lastName()

      this.users.push({
        id: faker.string.uuid(),
        email: faker.internet.email({ firstName, lastName }),
        name: `${firstName} ${lastName}`,
        password_hash: '$2b$10$examplehash', // bcrypt hash of 'password123'
        activity_level: getActivityLevel(i, CONFIG.users),
        created_at: generateTimestamp(faker.number.int({ min: 180, max: 360 }), 'any')
      })
    }

    console.log(`  ✓ Created ${CONFIG.users} users with realistic activity distribution`)
  }

  private generateMemberships() {
    console.log('🤝 Generating community memberships...')

    let membershipCount = 0

    // Assign users to communities based on community target size
    for (const community of this.communities) {
      const targetMembers = community.targetMembers
      const memberPool = [...this.users]
      faker.helpers.shuffle(memberPool)

      const membersToAdd = Math.min(targetMembers, memberPool.length)

      for (let i = 0; i < membersToAdd; i++) {
        const user = memberPool[i]
        const role = i === 0 ? 'moderator' : (i < 3 ? 'helper' : 'member')

        this.memberships.push({
          id: faker.string.uuid(),
          community_id: community.id,
          user_id: user.id,
          role,
          joined_at: generateTimestamp(faker.number.int({ min: 1, max: 180 }), 'any')
        })
        membershipCount++
      }
    }

    // Some power users join multiple communities
    const powerUsers = this.users.filter(u => u.activity_level === 'very_active')
    for (const user of powerUsers) {
      const extraCommunities = faker.number.int({ min: 2, max: 8 })
      const communitiesToJoin = faker.helpers.arrayElements(this.communities, extraCommunities)

      for (const community of communitiesToJoin) {
        // Check if already a member
        const alreadyMember = this.memberships.some(
          m => m.user_id === user.id && m.community_id === community.id
        )

        if (!alreadyMember) {
          this.memberships.push({
            id: faker.string.uuid(),
            community_id: community.id,
            user_id: user.id,
            role: 'member',
            joined_at: generateTimestamp(faker.number.int({ min: 1, max: 150 }), 'any')
          })
          membershipCount++
        }
      }
    }

    console.log(`  ✓ Created ${membershipCount} memberships`)
  }

  private generateTestPersonas() {
    console.log('🎭 Creating test personas...')

    // These will be inserted with known credentials for E2E testing
    for (const persona of TEST_PERSONAS) {
      const userId = faker.string.uuid()

      this.users.push({
        id: userId,
        email: persona.email,
        name: persona.name,
        password_hash: '$2b$10$examplehash', // 'password123'
        activity_level: persona.type === 'power_helper' ? 'very_active' :
                       persona.type === 'occasional' ? 'occasional' : 'moderate',
        created_at: persona.type === 'new' ? new Date() : generateTimestamp(90, 'any'),
        persona_type: persona.type
      })

      // Add to communities based on persona type
      const communityCount = persona.type === 'multi_community' ? 12 :
                            persona.type === 'new' ? 1 :
                            faker.number.int({ min: 1, max: 4 })

      const communities = faker.helpers.arrayElements(this.communities, communityCount)

      for (const community of communities) {
        this.memberships.push({
          id: faker.string.uuid(),
          community_id: community.id,
          user_id: userId,
          role: persona.type === 'moderator' ? 'moderator' : 'member',
          joined_at: generateTimestamp(faker.number.int({ min: 1, max: 90 }), 'any')
        })
      }
    }

    console.log(`  ✓ Created ${TEST_PERSONAS.length} test personas`)
  }

  private generateRequestsAndOffers() {
    console.log('📝 Generating 6 months of requests and offers...')

    let requestCount = 0
    let offerCount = 0

    // Generate requests based on user activity levels
    for (const user of this.users) {
      const userMemberships = this.memberships.filter(m => m.user_id === user.id)
      if (userMemberships.length === 0) continue

      // Number of requests based on activity level
      let requestsToCreate: number
      switch (user.activity_level) {
        case 'very_active': requestsToCreate = faker.number.int({ min: 15, max: 30 }); break
        case 'active': requestsToCreate = faker.number.int({ min: 8, max: 15 }); break
        case 'moderate': requestsToCreate = faker.number.int({ min: 3, max: 8 }); break
        case 'occasional': requestsToCreate = faker.number.int({ min: 0, max: 3 }); break
        default: requestsToCreate = 0
      }

      for (let i = 0; i < requestsToCreate; i++) {
        const membership = faker.helpers.arrayElement(userMemberships)
        const daysAgo = faker.number.int({ min: 0, max: 180 })
        const createdAt = generateTimestamp(daysAgo, 'peak')

        // Some requests are expired (older than 60 days)
        const isExpired = daysAgo > 60
        const expiresAt = new Date(createdAt.getTime() + 60 * 24 * 60 * 60 * 1000)

        // Status based on age and activity
        let status: string
        if (isExpired) {
          status = 'expired'
        } else if (daysAgo > 30 && Math.random() < 0.3) {
          status = 'matched'
        } else if (daysAgo < 7 && Math.random() < 0.5) {
          status = 'open'
        } else {
          status = faker.helpers.arrayElement(['open', 'matched', 'cancelled'])
        }

        const requestId = faker.string.uuid()

        this.requests.push({
          id: requestId,
          community_id: membership.community_id,
          requester_id: user.id,
          description: generateRequest(),
          status,
          created_at: createdAt,
          expires_at: expiresAt,
          updated_at: createdAt
        })
        requestCount++

        // Generate offers for this request (if not new and not cancelled)
        if (status !== 'cancelled' && daysAgo > 1) {
          const offerChance = status === 'matched' ? 0.8 : (status === 'open' ? 0.4 : 0.6)

          if (Math.random() < offerChance) {
            const offersToCreate = faker.number.int({ min: 1, max: 5 })

            // Get potential helpers from the same community
            const potentialHelpers = this.memberships
              .filter(m => m.community_id === membership.community_id && m.user_id !== user.id)
              .map(m => m.user_id)

            const helpers = faker.helpers.arrayElements(
              potentialHelpers,
              Math.min(offersToCreate, potentialHelpers.length)
            )

            for (const helperId of helpers) {
              const offerCreatedAt = new Date(
                createdAt.getTime() + faker.number.int({ min: 1, max: 48 }) * 60 * 60 * 1000
              )

              const offerStatus = status === 'matched' && Math.random() < 0.3 ? 'accepted' : 'pending'

              this.offers.push({
                id: faker.string.uuid(),
                request_id: requestId,
                helper_id: helperId,
                message: generateOffer(),
                status: offerStatus,
                created_at: offerCreatedAt
              })
              offerCount++
            }
          }
        }
      }
    }

    console.log(`  ✓ Created ${requestCount} requests and ${offerCount} offers`)
  }

  private generateMatches() {
    console.log('🤝 Generating matches...')

    let matchCount = 0

    // Find accepted offers and create matches
    const acceptedOffers = this.offers.filter(o => o.status === 'accepted')

    for (const offer of acceptedOffers) {
      const request = this.requests.find(r => r.id === offer.request_id)
      if (!request) continue

      const matchedAt = new Date(offer.created_at.getTime() + faker.number.int({ min: 1, max: 24 }) * 60 * 60 * 1000)
      const isCompleted = Math.random() < 0.7 // 70% completion rate

      const matchId = faker.string.uuid()

      this.matches.push({
        id: matchId,
        request_id: request.id,
        requester_id: request.requester_id,
        responder_id: offer.helper_id,
        community_id: request.community_id,
        status: isCompleted ? 'completed' : 'active',
        matched_at: matchedAt,
        completed_at: isCompleted ?
          new Date(matchedAt.getTime() + faker.number.int({ min: 1, max: 7 }) * 24 * 60 * 60 * 1000) :
          null
      })
      matchCount++
    }

    console.log(`  ✓ Created ${matchCount} matches`)
  }

  private generateMessages() {
    console.log('💬 Generating messages...')

    let totalMessageCount = 0

    for (const match of this.matches) {
      // Number of messages based on match status
      const messagesForMatch = match.status === 'completed' ?
        faker.number.int({ min: 3, max: 15 }) :
        faker.number.int({ min: 1, max: 5 })

      for (let i = 0; i < messagesForMatch; i++) {
        const sender = i % 2 === 0 ? match.requester_id : match.responder_id
        const messageTime = new Date(
          match.matched_at.getTime() + i * faker.number.int({ min: 1, max: 48 }) * 60 * 60 * 1000
        )

        const messages = [
          'Thanks for offering to help!',
          'Happy to help out. When works for you?',
          'How about this Saturday at 2pm?',
          'That works for me!',
          'Great, see you then.',
          'Thanks again for your help!',
          'No problem, glad I could help.',
          'Is tomorrow afternoon good?',
          'Let me know what you need.',
          'I appreciate this so much!'
        ]

        this.messages.push({
          id: faker.string.uuid(),
          match_id: match.id,
          sender_id: sender,
          content: faker.helpers.arrayElement(messages),
          created_at: messageTime
        })
        totalMessageCount++
      }
    }

    console.log(`  ✓ Created ${totalMessageCount} messages`)
  }

  private generateKarmaRecords() {
    console.log('⭐ Generating karma records...')

    let karmaCount = 0

    for (const match of this.matches) {
      if (match.status === 'completed') {
        // Award karma to both parties
        // Helper gets more karma
        this.karmaRecords.push({
          id: faker.string.uuid(),
          user_id: match.responder_id,
          community_id: match.community_id,
          event_type: 'help_given',
          points_awarded: 10,
          match_id: match.id,
          created_at: match.completed_at
        })
        karmaCount++

        // Requester gets karma for receiving
        this.karmaRecords.push({
          id: faker.string.uuid(),
          user_id: match.requester_id,
          community_id: match.community_id,
          event_type: 'help_received',
          points_awarded: 5,
          match_id: match.id,
          created_at: match.completed_at
        })
        karmaCount++

        // First-time bonus
        const requesterPreviousHelps = this.karmaRecords.filter(
          k => k.user_id === match.requester_id && k.event_type === 'help_received'
        ).length

        if (requesterPreviousHelps === 0) {
          this.karmaRecords.push({
            id: faker.string.uuid(),
            user_id: match.requester_id,
            community_id: match.community_id,
            event_type: 'bonus',
            points_awarded: 15,
            match_id: match.id,
            created_at: match.completed_at,
            description: 'First help bonus'
          })
          karmaCount++
        }
      }
    }

    console.log(`  ✓ Created ${karmaCount} karma records`)
  }

  private generateMilestones() {
    console.log('🏆 Generating community milestones...')

    let milestoneCount = 0

    for (const community of this.communities) {
      const communityMatches = this.matches.filter(m => m.community_id === community.id)
      const completedMatches = communityMatches.filter(m => m.status === 'completed').length
      const communityMembers = this.memberships.filter(m => m.community_id === community.id).length

      // Milestone thresholds
      const matchMilestones = [10, 25, 50, 100, 250, 500]
      const memberMilestones = [10, 25, 50, 100]

      // Match milestones
      for (const threshold of matchMilestones) {
        if (completedMatches >= threshold) {
          const milestoneMatch = communityMatches[threshold - 1]
          if (milestoneMatch) {
            this.milestones.push({
              id: faker.string.uuid(),
              community_id: community.id,
              milestone_type: `matches_${threshold}`,
              milestone_value: threshold,
              description: `${threshold} successful exchanges completed!`,
              achieved_at: milestoneMatch.completed_at || milestoneMatch.matched_at,
              is_featured: threshold >= 50 // Pin major milestones
            })
            milestoneCount++
          }
        }
      }

      // Member milestones
      for (const threshold of memberMilestones) {
        if (communityMembers >= threshold) {
          const milestoneDate = generateTimestamp(faker.number.int({ min: 30, max: 150 }), 'any')
          this.milestones.push({
            id: faker.string.uuid(),
            community_id: community.id,
            milestone_type: `participants_${threshold}`,
            milestone_value: threshold,
            description: `${threshold} unique members have participated!`,
            achieved_at: milestoneDate,
            is_featured: threshold >= 50
          })
          milestoneCount++
        }
      }
    }

    console.log(`  ✓ Created ${milestoneCount} milestones`)
  }

  private writeSQL() {
    console.log('\n📄 Writing SQL file...')

    this.sql.push('-- Karmyq v8.0 Realistic Test Data')
    this.sql.push('-- Generated: ' + new Date().toISOString())
    this.sql.push('-- 2000 users, 200 communities, 6 months of transactions\n')

    this.sql.push('-- Clean existing data')
    this.sql.push('TRUNCATE TABLE messaging.messages CASCADE;')
    this.sql.push('TRUNCATE TABLE requests.matches CASCADE;')
    this.sql.push('TRUNCATE TABLE requests.help_offers CASCADE;')
    this.sql.push('TRUNCATE TABLE requests.help_requests CASCADE;')
    this.sql.push('TRUNCATE TABLE reputation.karma_records CASCADE;')
    this.sql.push('TRUNCATE TABLE reputation.milestone_events CASCADE;')
    this.sql.push('TRUNCATE TABLE communities.members CASCADE;')
    this.sql.push('TRUNCATE TABLE communities.communities CASCADE;')
    this.sql.push('TRUNCATE TABLE auth.users CASCADE;\n')

    // Users
    this.sql.push('-- Insert users')
    for (const user of this.users) {
      this.sql.push(
        `INSERT INTO auth.users (id, email, name, password_hash, created_at) VALUES ` +
        `('${user.id}', '${this.escapeSql(user.email)}', '${this.escapeSql(user.name)}', '${user.password_hash}', '${user.created_at.toISOString()}');`
      )
    }
    this.sql.push('')

    // Communities
    this.sql.push('-- Insert communities')
    for (const community of this.communities) {
      this.sql.push(
        `INSERT INTO communities.communities (id, name, description, creator_id, created_at) VALUES ` +
        `('${community.id}', '${this.escapeSql(community.name)}', '${this.escapeSql(community.description)}', '${community.creator_id}', NOW());`
      )
    }
    this.sql.push('')

    // Memberships
    this.sql.push('-- Insert memberships')
    for (const membership of this.memberships) {
      this.sql.push(
        `INSERT INTO communities.members (id, community_id, user_id, role, joined_at) VALUES ` +
        `('${membership.id}', '${membership.community_id}', '${membership.user_id}', '${membership.role}', '${membership.joined_at.toISOString()}');`
      )
    }
    this.sql.push('')

    // Requests
    this.sql.push('-- Insert help requests')
    for (const request of this.requests) {
      this.sql.push(
        `INSERT INTO requests.help_requests (id, community_id, requester_id, description, status, created_at, expires_at, updated_at) VALUES ` +
        `('${request.id}', '${request.community_id}', '${request.requester_id}', '${this.escapeSql(request.description)}', '${request.status}', '${request.created_at.toISOString()}', '${request.expires_at.toISOString()}', '${request.updated_at.toISOString()}');`
      )
    }
    this.sql.push('')

    // Offers
    this.sql.push('-- Insert help offers')
    for (const offer of this.offers) {
      this.sql.push(
        `INSERT INTO requests.help_offers (id, request_id, helper_id, message, status, created_at) VALUES ` +
        `('${offer.id}', '${offer.request_id}', '${offer.helper_id}', '${this.escapeSql(offer.message)}', '${offer.status}', '${offer.created_at.toISOString()}');`
      )
    }
    this.sql.push('')

    // Matches
    this.sql.push('-- Insert matches')
    for (const match of this.matches) {
      const completedAt = match.completed_at ? `'${match.completed_at.toISOString()}'` : 'NULL'
      this.sql.push(
        `INSERT INTO requests.matches (id, request_id, requester_id, responder_id, community_id, status, matched_at, completed_at) VALUES ` +
        `('${match.id}', '${match.request_id}', '${match.requester_id}', '${match.responder_id}', '${match.community_id}', '${match.status}', '${match.matched_at.toISOString()}', ${completedAt});`
      )
    }
    this.sql.push('')

    // Messages
    this.sql.push('-- Insert messages')
    for (const message of this.messages) {
      this.sql.push(
        `INSERT INTO messaging.messages (id, match_id, sender_id, content, created_at) VALUES ` +
        `('${message.id}', '${message.match_id}', '${message.sender_id}', '${this.escapeSql(message.content)}', '${message.created_at.toISOString()}');`
      )
    }
    this.sql.push('')

    // Karma
    this.sql.push('-- Insert karma records')
    for (const karma of this.karmaRecords) {
      const description = karma.description ? `'${this.escapeSql(karma.description)}'` : 'NULL'
      this.sql.push(
        `INSERT INTO reputation.karma_records (id, user_id, community_id, event_type, points_awarded, match_id, description, created_at) VALUES ` +
        `('${karma.id}', '${karma.user_id}', '${karma.community_id}', '${karma.event_type}', ${karma.points_awarded}, '${karma.match_id}', ${description}, '${karma.created_at.toISOString()}');`
      )
    }
    this.sql.push('')

    // Milestones
    this.sql.push('-- Insert milestones')
    for (const milestone of this.milestones) {
      this.sql.push(
        `INSERT INTO reputation.milestone_events (id, community_id, milestone_type, milestone_value, description, achieved_at, is_featured) VALUES ` +
        `('${milestone.id}', '${milestone.community_id}', '${milestone.milestone_type}', ${milestone.milestone_value}, '${this.escapeSql(milestone.description)}', '${milestone.achieved_at.toISOString()}', ${milestone.is_featured});`
      )
    }

    const sqlPath = path.join(__dirname, 'realistic-test-data.sql')
    fs.writeFileSync(sqlPath, this.sql.join('\n'))
    console.log(`  ✓ SQL written to: ${sqlPath}`)
  }

  private writeMetadata() {
    const metadata = {
      generated_at: new Date().toISOString(),
      version: '8.0.0',
      statistics: {
        users: this.users.length,
        communities: this.communities.length,
        memberships: this.memberships.length,
        requests: this.requests.length,
        offers: this.offers.length,
        matches: this.matches.length,
        messages: this.messages.length,
        karma_records: this.karmaRecords.length,
        milestones: this.milestones.length
      },
      test_personas: TEST_PERSONAS,
      distribution: {
        community_sizes: {
          large: this.communities.filter(c => c.size === 'large').length,
          medium: this.communities.filter(c => c.size === 'medium').length,
          small: this.communities.filter(c => c.size === 'small').length
        },
        user_activity: {
          very_active: this.users.filter(u => u.activity_level === 'very_active').length,
          active: this.users.filter(u => u.activity_level === 'active').length,
          moderate: this.users.filter(u => u.activity_level === 'moderate').length,
          occasional: this.users.filter(u => u.activity_level === 'occasional').length
        },
        request_status: {
          open: this.requests.filter(r => r.status === 'open').length,
          matched: this.requests.filter(r => r.status === 'matched').length,
          expired: this.requests.filter(r => r.status === 'expired').length,
          cancelled: this.requests.filter(r => r.status === 'cancelled').length
        }
      }
    }

    const metadataPath = path.join(__dirname, 'realistic-test-data.json')
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
    console.log(`  ✓ Metadata written to: ${metadataPath}`)

    console.log('\n📊 Generation Statistics:')
    console.log(`  Users: ${metadata.statistics.users}`)
    console.log(`  Communities: ${metadata.statistics.communities}`)
    console.log(`  Memberships: ${metadata.statistics.memberships}`)
    console.log(`  Requests: ${metadata.statistics.requests}`)
    console.log(`  Offers: ${metadata.statistics.offers}`)
    console.log(`  Matches: ${metadata.statistics.matches}`)
    console.log(`  Messages: ${metadata.statistics.messages}`)
    console.log(`  Karma Records: ${metadata.statistics.karma_records}`)
    console.log(`  Milestones: ${metadata.statistics.milestones}`)
  }
}

// Run generator
const generator = new RealisticDataGenerator()
generator.generate()
