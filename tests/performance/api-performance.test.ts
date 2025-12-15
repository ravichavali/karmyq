/**
 * Performance Test Suite for Karmyq v8.0 APIs
 *
 * Tests response times and throughput for critical endpoints:
 * - Authentication
 * - Feed loading
 * - Karma/Trust score calculation
 * - Community switching
 * - Request creation
 */

import axios from 'axios'

interface PerformanceResult {
  endpoint: string
  method: string
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  successRate: number
  totalRequests: number
  failedRequests: number
}

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  auth: {
    login: 500,
    refresh: 300
  },
  feed: {
    getFeed: 1000,
    getMilestones: 500,
    getCommunityHealth: 500
  },
  reputation: {
    getKarma: 300,
    getTrustScore: 300,
    getHistory: 500
  },
  requests: {
    create: 400,
    list: 800,
    createOffer: 300
  }
}

class PerformanceTest {
  private baseURL = 'http://localhost:3001'
  private token: string = ''
  private userId: string = ''
  private communityId: string = ''

  // Test runner
  async run() {
    console.log('🚀 Starting Performance Test Suite for Karmyq v8.0\n')

    try {
      // Setup
      await this.setup()

      // Run tests
      const results: PerformanceResult[] = []

      results.push(await this.testAuthLogin())
      results.push(await this.testAuthRefresh())
      results.push(await this.testGetFeed())
      results.push(await this.testGetMilestones())
      results.push(await this.testGetCommunityHealth())
      results.push(await this.testGetKarma())
      results.push(await this.testGetTrustScore())
      results.push(await this.testGetKarmaHistory())
      results.push(await this.testCreateRequest())
      results.push(await this.testListRequests())
      results.push(await this.testCreateOffer())

      // Report results
      this.report(results)

    } catch (error) {
      console.error('❌ Performance test failed:', error)
      process.exit(1)
    }
  }

  private async setup() {
    console.log('⚙️  Setting up test environment...\n')

    // Login to get token
    const loginRes = await axios.post(`${this.baseURL}/auth/login`, {
      email: 'power.helper@test.com',
      password: 'password123'
    })

    this.token = loginRes.data.data.token
    this.userId = loginRes.data.data.user.id

    // Get user's first community
    const communitiesRes = await axios.get(`http://localhost:3002/communities/user/${this.userId}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    })

    this.communityId = communitiesRes.data.data.communities[0]?.id || ''

    console.log(`✓ Logged in as: ${loginRes.data.data.user.email}`)
    console.log(`✓ Using community: ${this.communityId}\n`)
  }

  // Helper: Measure endpoint performance
  private async measureEndpoint(
    name: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any,
    iterations: number = 100
  ): Promise<PerformanceResult> {
    console.log(`📊 Testing ${name} (${iterations} requests)...`)

    const responseTimes: number[] = []
    let failedRequests = 0

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now()

      try {
        if (method === 'GET') {
          await axios.get(url, {
            headers: { Authorization: `Bearer ${this.token}` }
          })
        } else if (method === 'POST') {
          await axios.post(url, data, {
            headers: { Authorization: `Bearer ${this.token}` }
          })
        }

        const endTime = Date.now()
        responseTimes.push(endTime - startTime)
      } catch (error) {
        failedRequests++
      }
    }

    // Calculate statistics
    responseTimes.sort((a, b) => a - b)
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    const minResponseTime = responseTimes[0] || 0
    const maxResponseTime = responseTimes[responseTimes.length - 1] || 0
    const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0
    const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0
    const successRate = ((iterations - failedRequests) / iterations) * 100

    console.log(`  ✓ Avg: ${avgResponseTime.toFixed(0)}ms | P95: ${p95ResponseTime}ms | P99: ${p99ResponseTime}ms | Success: ${successRate.toFixed(1)}%\n`)

    return {
      endpoint: name,
      method,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      successRate,
      totalRequests: iterations,
      failedRequests
    }
  }

  // Auth tests
  private async testAuthLogin(): Promise<PerformanceResult> {
    return this.measureEndpoint(
      'POST /auth/login',
      'POST',
      `${this.baseURL}/auth/login`,
      {
        email: 'power.helper@test.com',
        password: 'password123'
      },
      50 // Fewer iterations for expensive operations
    )
  }

  private async testAuthRefresh(): Promise<PerformanceResult> {
    return this.measureEndpoint(
      'POST /auth/refresh',
      'POST',
      `${this.baseURL}/auth/refresh`,
      {},
      100
    )
  }

  // Feed tests
  private async testGetFeed(): Promise<PerformanceResult> {
    return this.measureEndpoint(
      'GET /feed',
      'GET',
      `http://localhost:3007/feed?user_id=${this.userId}&community_id=${this.communityId}&limit=20`,
      undefined,
      100
    )
  }

  private async testGetMilestones(): Promise<PerformanceResult> {
    return this.measureEndpoint(
      'GET /feed/milestones',
      'GET',
      `http://localhost:3007/feed/milestones?community_id=${this.communityId}&limit=5`,
      undefined,
      100
    )
  }

  private async testGetCommunityHealth(): Promise<PerformanceResult> {
    return this.measureEndpoint(
      'GET /feed/community-health',
      'GET',
      `http://localhost:3007/feed/community-health?community_id=${this.communityId}`,
      undefined,
      100
    )
  }

  // Reputation tests
  private async testGetKarma(): Promise<PerformanceResult> {
    return this.measureEndpoint(
      'GET /reputation/karma',
      'GET',
      `http://localhost:3004/reputation/karma/${this.userId}`,
      undefined,
      100
    )
  }

  private async testGetTrustScore(): Promise<PerformanceResult> {
    return this.measureEndpoint(
      'GET /reputation/trust-score',
      'GET',
      `http://localhost:3004/reputation/trust-score/${this.userId}`,
      undefined,
      100
    )
  }

  private async testGetKarmaHistory(): Promise<PerformanceResult> {
    return this.measureEndpoint(
      'GET /reputation/karma-history',
      'GET',
      `http://localhost:3004/reputation/karma-history/${this.userId}?limit=20`,
      undefined,
      100
    )
  }

  // Request tests
  private async testCreateRequest(): Promise<PerformanceResult> {
    return this.measureEndpoint(
      'POST /requests',
      'POST',
      `http://localhost:3003/requests`,
      {
        community_id: this.communityId,
        description: 'Performance test request - please ignore'
      },
      50 // Create operations are more expensive
    )
  }

  private async testListRequests(): Promise<PerformanceResult> {
    return this.measureEndpoint(
      'GET /requests',
      'GET',
      `http://localhost:3003/requests?community_id=${this.communityId}&limit=20`,
      undefined,
      100
    )
  }

  private async testCreateOffer(): Promise<PerformanceResult> {
    // First, get a request ID
    const requestsRes = await axios.get(
      `http://localhost:3003/requests?community_id=${this.communityId}&limit=1&status=open`,
      { headers: { Authorization: `Bearer ${this.token}` } }
    )

    const requestId = requestsRes.data.data?.requests?.[0]?.id

    if (!requestId) {
      console.log('  ⚠️  No open requests found, skipping offer test\n')
      return {
        endpoint: 'POST /requests/:id/offers',
        method: 'POST',
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        successRate: 0,
        totalRequests: 0,
        failedRequests: 0
      }
    }

    return this.measureEndpoint(
      'POST /requests/:id/offers',
      'POST',
      `http://localhost:3003/requests/${requestId}/offers`,
      {
        message: 'Performance test offer - please ignore'
      },
      50
    )
  }

  // Report results
  private report(results: PerformanceResult[]) {
    console.log('\n' + '='.repeat(100))
    console.log('📈 PERFORMANCE TEST RESULTS')
    console.log('='.repeat(100) + '\n')

    console.log('┌─────────────────────────────────────┬───────────┬───────────┬───────────┬───────────┬─────────────┐')
    console.log('│ Endpoint                            │    Avg    │    P95    │    P99    │    Max    │  Success %  │')
    console.log('├─────────────────────────────────────┼───────────┼───────────┼───────────┼───────────┼─────────────┤')

    let hasFailures = false

    for (const result of results) {
      if (result.totalRequests === 0) continue

      const endpoint = result.endpoint.padEnd(35)
      const avg = `${result.avgResponseTime.toFixed(0)}ms`.padStart(9)
      const p95 = `${result.p95ResponseTime}ms`.padStart(9)
      const p99 = `${result.p99ResponseTime}ms`.padStart(9)
      const max = `${result.maxResponseTime}ms`.padStart(9)
      const success = `${result.successRate.toFixed(1)}%`.padStart(11)

      console.log(`│ ${endpoint} │ ${avg} │ ${p95} │ ${p99} │ ${max} │ ${success} │`)

      // Check against thresholds
      const threshold = this.getThreshold(result.endpoint)
      if (threshold && result.p95ResponseTime > threshold) {
        console.log(`│ ${'⚠️  WARNING: Exceeds threshold'.padEnd(35)} │ ${`${threshold}ms`.padStart(9)} │           │           │           │             │`)
        hasFailures = true
      }
    }

    console.log('└─────────────────────────────────────┴───────────┴───────────┴───────────┴───────────┴─────────────┘\n')

    // Summary
    const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0)
    const totalFailed = results.reduce((sum, r) => sum + r.failedRequests, 0)
    const avgP95 = results.reduce((sum, r) => sum + r.p95ResponseTime, 0) / results.filter(r => r.totalRequests > 0).length

    console.log('📊 Summary:')
    console.log(`  Total Requests: ${totalRequests}`)
    console.log(`  Failed Requests: ${totalFailed}`)
    console.log(`  Average P95: ${avgP95.toFixed(0)}ms`)

    if (hasFailures) {
      console.log('\n⚠️  Some endpoints exceeded performance thresholds!')
      process.exit(1)
    } else {
      console.log('\n✅ All endpoints meet performance thresholds!')
      process.exit(0)
    }
  }

  private getThreshold(endpoint: string): number | null {
    if (endpoint.includes('login')) return THRESHOLDS.auth.login
    if (endpoint.includes('refresh')) return THRESHOLDS.auth.refresh
    if (endpoint.includes('/feed') && !endpoint.includes('milestones') && !endpoint.includes('health')) return THRESHOLDS.feed.getFeed
    if (endpoint.includes('milestones')) return THRESHOLDS.feed.getMilestones
    if (endpoint.includes('community-health')) return THRESHOLDS.feed.getCommunityHealth
    if (endpoint.includes('karma-history')) return THRESHOLDS.reputation.getHistory
    if (endpoint.includes('karma')) return THRESHOLDS.reputation.getKarma
    if (endpoint.includes('trust-score')) return THRESHOLDS.reputation.getTrustScore
    if (endpoint.includes('POST /requests') && !endpoint.includes('offers')) return THRESHOLDS.requests.create
    if (endpoint.includes('GET /requests')) return THRESHOLDS.requests.list
    if (endpoint.includes('offers')) return THRESHOLDS.requests.createOffer

    return null
  }
}

// Run tests
const test = new PerformanceTest()
test.run().catch(console.error)
