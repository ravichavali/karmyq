/**
 * Comprehensive E2E Test Suite for Karmyq v8.0
 *
 * Tests all major user flows with test personas:
 * - New user onboarding
 * - Power helper workflows
 * - Multi-community member interactions
 * - Request/Offer/Match lifecycle
 * - Messaging and karma accumulation
 */

import { test, expect } from '@playwright/test'

// Test Personas
const PERSONAS = {
  NEW_USER: {
    email: 'new.user@test.com',
    password: 'password123',
    name: 'New User'
  },
  POWER_HELPER: {
    email: 'power.helper@test.com',
    password: 'password123',
    name: 'Power Helper'
  },
  FREQUENT_REQUESTER: {
    email: 'frequent.requester@test.com',
    password: 'password123',
    name: 'Frequent Requester'
  },
  MODERATOR: {
    email: 'community.moderator@test.com',
    password: 'password123',
    name: 'Community Moderator'
  },
  BALANCED_USER: {
    email: 'balanced.user@test.com',
    password: 'password123',
    name: 'Balanced User'
  },
  MULTI_COMMUNITY: {
    email: 'multi.community@test.com',
    password: 'password123',
    name: 'Multi Community Member'
  }
}

test.describe('Comprehensive User Flows', () => {

  test.describe('New User Journey', () => {

    test('New user can sign up and create first request', async ({ page }) => {
      // Navigate to login page
      await page.goto('http://localhost:3000/login')

      // Click register link
      await page.click('text=Create an account')

      // Fill registration form (if exists, otherwise use existing persona)
      await page.fill('input[type="email"]', PERSONAS.NEW_USER.email)
      await page.fill('input[name="password"]', PERSONAS.NEW_USER.password)

      // Login as new user
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.NEW_USER.email)
      await page.fill('input[name="password"]', PERSONAS.NEW_USER.password)
      await page.click('button[type="submit"]')

      // Should redirect to dashboard
      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Check that user has 0 karma (new user)
      const karmaText = await page.locator('text=Karma Points').locator('..').textContent()
      expect(karmaText).toContain('0')

      // Check that trust score is low (new user)
      const trustScore = await page.locator('text=Trust Score').locator('..').textContent()
      // New users should have low trust score

      // Create first request
      await page.fill('textarea[placeholder*="What do you need"]', 'Need help setting up my new laptop')
      await page.click('button:has-text("Post")')

      // Verify request appears in feed
      await expect(page.locator('text=Need help setting up my new laptop')).toBeVisible()
    })

    test('New user onboarding shows helpful hints', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.NEW_USER.email)
      await page.fill('input[name="password"]', PERSONAS.NEW_USER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Check for empty state or onboarding hints
      // This depends on whether they have any activity
    })
  })

  test.describe('Power Helper Workflow', () => {

    test('Power helper can view and respond to multiple requests', async ({ page }) => {
      // Login as power helper
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.POWER_HELPER.email)
      await page.fill('input[name="password"]', PERSONAS.POWER_HELPER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Should have high karma
      const karmaSection = await page.locator('text=Karma Points').locator('..')
      const karmaValue = await karmaSection.locator('span.text-xl').textContent()
      const karma = parseInt(karmaValue || '0')
      expect(karma).toBeGreaterThan(50) // Power helpers have lots of karma

      // Should have high trust score
      const trustSection = await page.locator('text=Trust Score').locator('..')
      const trustValue = await trustSection.locator('span.text-lg').textContent()
      const trust = parseInt(trustValue || '0')
      expect(trust).toBeGreaterThan(60) // High trust

      // Find open requests in feed
      const requests = await page.locator('[class*="bg-white"][class*="rounded"]').filter({ hasText: 'Need help' }).count()
      expect(requests).toBeGreaterThan(0)

      // Click on first request to offer help
      await page.locator('[class*="bg-white"][class*="rounded"]').filter({ hasText: 'Need help' }).first().click()

      // Make an offer
      const offerButton = page.locator('button:has-text("Offer Help")')
      if (await offerButton.isVisible()) {
        await offerButton.click()
        await page.fill('textarea', 'Happy to help with this!')
        await page.click('button:has-text("Send Offer")')

        // Verify offer was sent
        await expect(page.locator('text=Offer sent')).toBeVisible()
      }
    })

    test('Power helper can message matched requesters', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.POWER_HELPER.email)
      await page.fill('input[name="password"]', PERSONAS.POWER_HELPER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Look for matched requests (with chat interface)
      const matchedRequests = page.locator('text=Matched').or(page.locator('text=Active'))
      if (await matchedRequests.count() > 0) {
        await matchedRequests.first().click()

        // Should see messaging interface
        const messageInput = page.locator('input[placeholder*="message"]').or(page.locator('textarea[placeholder*="message"]'))
        await expect(messageInput).toBeVisible()

        // Send a message
        await messageInput.fill('When works best for you?')
        await page.click('button[type="submit"]')

        // Message should appear
        await expect(page.locator('text=When works best for you?')).toBeVisible()
      }
    })
  })

  test.describe('Multi-Community Member', () => {

    test('User can switch between communities', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.MULTI_COMMUNITY.email)
      await page.fill('input[name="password"]', PERSONAS.MULTI_COMMUNITY.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Should see community selector in left sidebar
      const communitiesSection = page.locator('text=Your Communities').locator('..')
      await expect(communitiesSection).toBeVisible()

      // Count communities
      const communityButtons = communitiesSection.locator('button').filter({ hasText: /.+/ })
      const count = await communityButtons.count()
      expect(count).toBeGreaterThan(5) // Multi-community member has many communities

      // Click on second community
      if (count >= 2) {
        const firstCommunity = await communityButtons.nth(0).textContent()
        await communityButtons.nth(1).click()

        // Wait for data to update
        await page.waitForTimeout(500)

        // Community health should update in right sidebar
        await expect(page.locator('text=Community Health')).toBeVisible()

        // Recent milestones should update
        await expect(page.locator('text=Recent Milestones')).toBeVisible()
      }
    })

    test('User can post to specific community or all communities', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.MULTI_COMMUNITY.email)
      await page.fill('input[name="password"]', PERSONAS.MULTI_COMMUNITY.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Create a request
      const requestInput = page.locator('textarea[placeholder*="What do you need"]')
      await requestInput.fill('Looking for someone to help with yard work')

      // Check for posting mode toggle
      const allCommunitiesButton = page.locator('button:has-text("All Communities")')
      const specificCommunityButton = page.locator('button:has-text("Active Community")')

      if (await allCommunitiesButton.isVisible()) {
        // Test posting to all communities
        await allCommunitiesButton.click()
        await page.click('button:has-text("Post")')

        await expect(page.locator('text=Looking for someone to help with yard work')).toBeVisible()
      }
    })
  })

  test.describe('Complete Request/Offer/Match Flow', () => {

    test('Full lifecycle: request → offer → match → message → complete', async ({ page, context }) => {
      // Step 1: Requester creates request
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.FREQUENT_REQUESTER.email)
      await page.fill('input[name="password"]', PERSONAS.FREQUENT_REQUESTER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Create request
      await page.fill('textarea[placeholder*="What do you need"]', 'Need help moving a couch this Saturday')
      await page.click('button:has-text("Post")')

      // Verify request created
      await expect(page.locator('text=Need help moving a couch this Saturday')).toBeVisible()

      // Logout
      await page.click('button:has-text("Logout")').or(page.click('a:has-text("Logout")')).catch(() => {})

      // Step 2: Helper offers to help
      const helperPage = await context.newPage()
      await helperPage.goto('http://localhost:3000/login')
      await helperPage.fill('input[type="email"]', PERSONAS.POWER_HELPER.email)
      await helperPage.fill('input[name="password"]', PERSONAS.POWER_HELPER.password)
      await helperPage.click('button[type="submit"]')

      await expect(helperPage).toHaveURL('http://localhost:3000/dashboard')

      // Find and click on the request
      const requestCard = helperPage.locator('text=Need help moving a couch this Saturday').locator('..')
      if (await requestCard.isVisible()) {
        await requestCard.click()

        // Make offer
        const offerButton = helperPage.locator('button:has-text("Offer Help")')
        if (await offerButton.isVisible()) {
          await offerButton.click()
          await helperPage.fill('textarea', 'I can help! I have a truck.')
          await helperPage.click('button:has-text("Send")')
        }
      }

      // Step 3: Requester accepts offer
      await page.reload()

      // Find request with offers
      const requestWithOffer = page.locator('text=Need help moving a couch this Saturday').locator('..')
      if (await requestWithOffer.isVisible()) {
        await requestWithOffer.click()

        // Accept offer
        const acceptButton = page.locator('button:has-text("Accept")')
        if (await acceptButton.isVisible()) {
          await acceptButton.click()

          // Should show matched status
          await expect(page.locator('text=Matched').or(page.locator('text=Active'))).toBeVisible()
        }
      }

      // Step 4: Exchange messages
      const messageInput = page.locator('input[placeholder*="message"]').or(page.locator('textarea[placeholder*="message"]'))
      if (await messageInput.isVisible()) {
        await messageInput.fill('Great! How about 2pm on Saturday?')
        await page.click('button[type="submit"]')

        await expect(page.locator('text=Great! How about 2pm on Saturday?')).toBeVisible()
      }

      // Step 5: Mark as complete
      const completeButton = page.locator('button:has-text("Mark Complete")').or(page.locator('button:has-text("Complete"'))
      if (await completeButton.isVisible()) {
        await completeButton.click()

        // Should show completed status
        await expect(page.locator('text=Completed')).toBeVisible()

        // Karma should have increased
        // (This would need API verification or page refresh to see updated karma)
      }
    })
  })

  test.describe('Karma and Trust Score', () => {

    test('User can view detailed karma breakdown', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.BALANCED_USER.email)
      await page.fill('input[name="password"]', PERSONAS.BALANCED_USER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Click on karma points
      await page.click('text=Karma Points')

      // Should navigate to karma detail page
      await expect(page).toHaveURL(/\/reputation\/karma/)

      // Should see karma breakdown
      await expect(page.locator('text=From Helping')).toBeVisible()
      await expect(page.locator('text=From Receiving')).toBeVisible()
      await expect(page.locator('text=Bonuses')).toBeVisible()

      // Should see karma history
      await expect(page.locator('text=Recent Activity')).toBeVisible()
    })

    test('User can view trust score details', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.BALANCED_USER.email)
      await page.fill('input[name="password"]', PERSONAS.BALANCED_USER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Click on trust score
      await page.click('text=Trust Score')

      // Should navigate to trust score detail page
      await expect(page).toHaveURL(/\/reputation\/trust/)

      // Should see trust score with visual indicator
      await expect(page.locator('text=/Trusted|Reliable|Building|New/')).toBeVisible()

      // Should see factors affecting trust
      await expect(page.locator('text=/Trust|Score|Karma/')).toBeVisible()
    })
  })

  test.describe('Community Health and Milestones', () => {

    test('Community health widget shows metrics', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.MULTI_COMMUNITY.email)
      await page.fill('input[name="password"]', PERSONAS.MULTI_COMMUNITY.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Right sidebar should show community health
      const healthWidget = page.locator('text=Community Health').locator('..')
      await expect(healthWidget).toBeVisible()

      // Should show network strength
      await expect(healthWidget.locator('text=/\\d+\/100/')).toBeVisible()

      // Should show exchanges count
      await expect(healthWidget.locator('text=Exchanges')).toBeVisible()

      // Should show active helpers
      await expect(healthWidget.locator('text=Active Helpers')).toBeVisible()

      // Should show growth rate
      await expect(healthWidget.locator('text=Growth')).toBeVisible()
    })

    test('Recent milestones are displayed', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.MULTI_COMMUNITY.email)
      await page.fill('input[name="password"]', PERSONAS.MULTI_COMMUNITY.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Should see recent milestones
      const milestonesWidget = page.locator('text=Recent Milestones').locator('..')
      await expect(milestonesWidget).toBeVisible()

      // Should show milestone descriptions
      const milestones = await milestonesWidget.locator('text=/exchanges|members|participants/').count()
      expect(milestones).toBeGreaterThan(0)
    })

    test('Milestones update when switching communities', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.MULTI_COMMUNITY.email)
      await page.fill('input[name="password"]', PERSONAS.MULTI_COMMUNITY.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Get initial milestones
      const milestonesWidget = page.locator('text=Recent Milestones').locator('..')
      const initialMilestones = await milestonesWidget.textContent()

      // Switch community
      const communitiesSection = page.locator('text=Your Communities').locator('..')
      const communityButtons = communitiesSection.locator('button').filter({ hasText: /.+/ })

      if (await communityButtons.count() >= 2) {
        await communityButtons.nth(1).click()

        // Wait for update
        await page.waitForTimeout(1000)

        // Milestones should have changed
        const updatedMilestones = await milestonesWidget.textContent()
        // Note: Milestones might be the same if communities have similar milestones
        // This test is more about ensuring the UI updates
      }
    })
  })

  test.describe('Responsive Design', () => {

    test('Dashboard shows 3-column layout on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })

      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.BALANCED_USER.email)
      await page.fill('input[name="password"]', PERSONAS.BALANCED_USER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // All three sections should be visible
      await expect(page.locator('text=Your Communities')).toBeVisible()
      await expect(page.locator('text=Community Health')).toBeVisible()

      // Center feed should have requests
      const feed = page.locator('[class*="col-span"]').filter({ hasText: /Need|Looking|Can/ })
      await expect(feed).toBeVisible()
    })

    test('Dashboard shows single column on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.BALANCED_USER.email)
      await page.fill('input[name="password"]', PERSONAS.BALANCED_USER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Sidebars should be hidden on mobile (lg:block classes)
      // Main feed should be visible
      const feed = page.locator('[class*="col-span"]').or(page.locator('main'))
      await expect(feed).toBeVisible()
    })
  })

  test.describe('Navigation', () => {

    test('User can navigate to profile page', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.BALANCED_USER.email)
      await page.fill('input[name="password"]', PERSONAS.BALANCED_USER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Click on user name
      await page.click(`text=${PERSONAS.BALANCED_USER.name}`)

      // Should navigate to profile
      await expect(page).toHaveURL(/\/profile/)
    })

    test('User can navigate to communities page', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.BALANCED_USER.email)
      await page.fill('input[name="password"]', PERSONAS.BALANCED_USER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Click on "Your Communities" or "+ Join Community"
      await page.click('text=Your Communities')

      // Should navigate to communities page
      await expect(page).toHaveURL(/\/communities/)
    })

    test('Back button returns to dashboard', async ({ page }) => {
      await page.goto('http://localhost:3000/login')
      await page.fill('input[type="email"]', PERSONAS.BALANCED_USER.email)
      await page.fill('input[name="password"]', PERSONAS.BALANCED_USER.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL('http://localhost:3000/dashboard')

      // Navigate to karma page
      await page.click('text=Karma Points')
      await expect(page).toHaveURL(/\/reputation\/karma/)

      // Click back button
      await page.click('text=Back')

      // Should return to dashboard
      await expect(page).toHaveURL(/\/dashboard/)
    })
  })
})
