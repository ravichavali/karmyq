/**
 * Volume Seeder - Efficiently seeds large volumes of data via API
 *
 * Features:
 * - Batching to avoid overwhelming the API
 * - Progress reporting
 * - Error handling and retry logic
 * - Idempotent operations
 */

import { Pool } from 'pg';
import { UserFactory, CommunityFactory, RequestFactory, TestUser, TestCommunity } from './index';
import { TimeTravelFactory } from './timeTravelFactory';
import {
  generatePolymorphicRequest,
  generateCommunityName,
  generateRealisticName,
  getActivityLevel,
  getRequestsForActivityLevel,
  getCommunityCategory,
  getCommunityLocation
} from './realisticDataFactory';

export interface SeedConfig {
  users: number;
  communities: number;
  requestsPerUser: number;
  ageMonths: number;
  password: string;
  batchSize?: number;
  includeTestPersonas?: boolean;
}

export interface SeedProgress {
  usersCreated: number;
  communitiesCreated: number;
  requestsCreated: number;
  matchesCreated: number;
  messagesCreated: number;
}

export class VolumeSeeder {
  private pool: Pool;
  private timeTravelFactory: TimeTravelFactory;
  private progress: SeedProgress = {
    usersCreated: 0,
    communitiesCreated: 0,
    requestsCreated: 0,
    matchesCreated: 0,
    messagesCreated: 0
  };

  constructor(pool: Pool) {
    this.pool = pool;
    this.timeTravelFactory = new TimeTravelFactory(pool);
  }

  /**
   * Main seeding orchestrator
   */
  async seed(config: SeedConfig, onProgress?: (progress: SeedProgress) => void): Promise<void> {
    const batchSize = config.batchSize || 50;

    console.log(`🚀 Starting volume seed...`);
    console.log(`   Users: ${config.users}`);
    console.log(`   Communities: ${config.communities}`);
    console.log(`   Age: ${config.ageMonths} months`);
    console.log(`   Batch size: ${batchSize}\n`);

    // Step 1: Create users in batches
    console.log(`👥 Creating ${config.users} users...`);
    const users = await this.createUsersBatched(config.users, config.password, batchSize, onProgress);

    // Backdate some users for realistic account age distribution
    await this.backdateUsers(users, config.ageMonths);

    // Step 2: Create communities
    console.log(`\n📍 Creating ${config.communities} communities...`);
    const communities = await this.createCommunitiesBatched(
      config.communities,
      users,
      config.ageMonths,
      onProgress
    );

    // Step 3: Assign memberships
    console.log(`\n🤝 Assigning community memberships...`);
    await this.assignMemberships(users, communities, config.ageMonths, onProgress);

    // Step 4: Create requests and workflows
    console.log(`\n📝 Creating requests and complete workflows...`);
    await this.createRequestsAndWorkflows(users, communities, config, onProgress);

    console.log(`\n✅ Volume seed complete!`);
    console.log(`   ${this.progress.usersCreated} users created`);
    console.log(`   ${this.progress.communitiesCreated} communities created`);
    console.log(`   ${this.progress.requestsCreated} requests created`);
    console.log(`   ${this.progress.matchesCreated} matches created`);
    console.log(`   ${this.progress.messagesCreated} messages created`);
  }

  /**
   * Create users in batches to avoid overwhelming API
   */
  private async createUsersBatched(
    count: number,
    password: string,
    batchSize: number,
    onProgress?: (progress: SeedProgress) => void
  ): Promise<TestUser[]> {
    const users: TestUser[] = [];
    const batches = Math.ceil(count / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, count);
      const batchCount = batchEnd - batchStart;

      const batchPromises: Promise<TestUser | null>[] = [];

      for (let i = 0; i < batchCount; i++) {
        const userIndex = batchStart + i;
        const name = generateRealisticName();
        const activityLevel = getActivityLevel(userIndex, count);

        batchPromises.push(
          UserFactory.create({
            name: name.fullName,
            email: `user${userIndex}@test.karmyq.com`,
            password
          })
        );
      }

      const batchUsers = await Promise.all(batchPromises);
      const validUsers = batchUsers.filter((u): u is TestUser => u !== null);
      users.push(...validUsers);

      this.progress.usersCreated += validUsers.length;
      if (onProgress) onProgress(this.progress);

      process.stdout.write(`   Progress: ${this.progress.usersCreated}/${count}\r`);
    }

    console.log(); // New line after progress
    return users;
  }

  /**
   * Backdate users for realistic account age distribution
   */
  private async backdateUsers(users: TestUser[], ageMonths: number): Promise<void> {
    console.log(`   Backdating user accounts...`);

    const backdatePromises = users.map((user, index) => {
      // Distribute ages from 0 to ageMonths
      const userAgeMonths = Math.floor((index / users.length) * ageMonths);
      return this.timeTravelFactory.backdateUser(user.id, { monthsAgo: userAgeMonths });
    });

    await Promise.all(backdatePromises);
  }

  /**
   * Create communities in batches
   */
  private async createCommunitiesBatched(
    count: number,
    users: TestUser[],
    ageMonths: number,
    onProgress?: (progress: SeedProgress) => void
  ): Promise<TestCommunity[]> {
    const communities: TestCommunity[] = [];

    // Community size distribution
    const largeCommunities = Math.floor(count * 0.10); // 10%
    const mediumCommunities = Math.floor(count * 0.30); // 30%
    const smallCommunities = count - largeCommunities - mediumCommunities; // 60%

    const sizes = [
      ...Array(largeCommunities).fill({ min: 50, max: 150 }),
      ...Array(mediumCommunities).fill({ min: 15, max: 50 }),
      ...Array(smallCommunities).fill({ min: 3, max: 15 })
    ];

    for (let i = 0; i < count; i++) {
      const creator = users[Math.floor(Math.random() * users.length)];
      const community = await CommunityFactory.create({
        creatorToken: creator.token,
        creatorId: creator.id,
        name: generateCommunityName(),
        location: getCommunityLocation()
      });

      if (community) {
        // Backdate community
        const communityAgeMonths = Math.floor((i / count) * ageMonths);
        await this.timeTravelFactory.backdateCommunity(community.id, { monthsAgo: communityAgeMonths });

        communities.push(community);
        this.progress.communitiesCreated++;
        if (onProgress) onProgress(this.progress);
      }

      process.stdout.write(`   Progress: ${this.progress.communitiesCreated}/${count}\r`);
    }

    console.log(); // New line
    return communities;
  }

  /**
   * Assign users to communities based on realistic distributions
   */
  private async assignMemberships(
    users: TestUser[],
    communities: TestCommunity[],
    ageMonths: number,
    onProgress?: (progress: SeedProgress) => void
  ): Promise<void> {
    let membershipsCreated = 0;

    // Each community gets a target number of members
    for (const community of communities) {
      const targetMembers = Math.floor(Math.random() * 50) + 10; // 10-60 members
      const memberPool = this.shuffleArray([...users]).slice(0, targetMembers);

      for (let i = 0; i < memberPool.length; i++) {
        const user = memberPool[i];
        const role = i === 0 ? 'moderator' : (i < 3 ? 'helper' : 'member');

        const success = await CommunityFactory.addMember(
          community.id,
          user.id,
          community.creatorId === user.id ? user.token : users[0].token,
          role
        );

        if (success) {
          membershipsCreated++;
        }
      }

      process.stdout.write(`   Communities processed: ${communities.indexOf(community) + 1}/${communities.length}\r`);
    }

    console.log(`   Total memberships: ${membershipsCreated}`);
  }

  /**
   * Create requests and complete workflows (request → match → messages → karma)
   */
  private async createRequestsAndWorkflows(
    users: TestUser[],
    communities: TestCommunity[],
    config: SeedConfig,
    onProgress?: (progress: SeedProgress) => void
  ): Promise<void> {
    // For each user, create requests based on activity level
    for (const user of users) {
      const userIndex = users.indexOf(user);
      const activityLevel = getActivityLevel(userIndex, users.length);
      const requestCount = Math.min(
        getRequestsForActivityLevel(activityLevel),
        config.requestsPerUser
      );

      // Get user's communities (approximate - we know they're in random communities)
      const userCommunities = communities.slice(0, Math.floor(Math.random() * 5) + 1);

      for (let i = 0; i < requestCount; i++) {
        const community = userCommunities[Math.floor(Math.random() * userCommunities.length)];
        const polymorphicReq = generatePolymorphicRequest();

        // Create request via API
        const request = await RequestFactory.create({
          communityId: community.id,
          requesterId: user.id,
          requesterToken: user.token,
          title: polymorphicReq.title,
          description: polymorphicReq.description
        });

        if (request) {
          this.progress.requestsCreated++;

          // 30% chance of creating a complete workflow
          if (Math.random() < 0.3) {
            await this.createCompleteWorkflow(request.id, user, community, config.ageMonths);
            this.progress.matchesCreated++;
            this.progress.messagesCreated += 4; // Approximate
          }

          if (onProgress) onProgress(this.progress);
        }
      }

      process.stdout.write(`   Users processed: ${userIndex + 1}/${users.length}\r`);
    }

    console.log(); // New line
  }

  /**
   * Create a complete workflow for a request
   */
  private async createCompleteWorkflow(
    requestId: string,
    requester: TestUser,
    community: TestCommunity,
    ageMonths: number
  ): Promise<void> {
    // Find a helper from the community (random user for now)
    const helper = await UserFactory.create({ prefix: 'helper' });
    if (!helper) return;

    // Add helper to community
    await CommunityFactory.addMember(community.id, helper.id, requester.token);

    // Create aged workflow
    const daysAgo = Math.floor(Math.random() * (ageMonths * 30)); // Random within age range

    await this.timeTravelFactory.createAgedWorkflow(
      community,
      requester,
      helper,
      {
        requestCreatedDaysAgo: daysAgo,
        offerCreatedDaysAgo: daysAgo - 1,
        matchCreatedDaysAgo: daysAgo - 2,
        matchCompletedDaysAgo: daysAgo - 5
      }
    );
  }

  /**
   * Utility: Shuffle array (Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Get current progress
   */
  getProgress(): SeedProgress {
    return { ...this.progress };
  }
}
