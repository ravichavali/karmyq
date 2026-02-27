/**
 * TDD Tests: Provider Trust Score (ADR-042)
 *
 * Tests the trust score formula:
 *   60% avg_stars_normalized + 30% completion_rate + 10% response_rate
 */

describe('Provider Trust Score Formula (ADR-042)', () => {
  // Pure function extracted from recalculateProviderTrustScore logic
  function calcProviderTrustScore(
    avgStars: number,
    totalReviews: number,
    completionRate: number,
    responseRate: number
  ): number {
    const normalizedStars = totalReviews > 0 ? ((avgStars - 1) / 4) * 100 : 0;
    return Math.round(normalizedStars * 0.6 + completionRate * 0.3 + responseRate * 0.1);
  }

  it('returns 0 when provider has no reviews', () => {
    expect(calcProviderTrustScore(0, 0, 0, 0)).toBe(0);
  });

  it('returns 100 for perfect 5 stars, 100% completion, 100% response', () => {
    // normalized 5 stars = 100, score = 100*0.6 + 100*0.3 + 100*0.1 = 100
    expect(calcProviderTrustScore(5, 10, 100, 100)).toBe(100);
  });

  it('returns 60 for perfect stars only, no completion/response data', () => {
    expect(calcProviderTrustScore(5, 10, 0, 0)).toBe(60);
  });

  it('normalizes 1-star rating to 0 contribution', () => {
    // (1-1)/4 = 0
    expect(calcProviderTrustScore(1, 5, 0, 0)).toBe(0);
  });

  it('normalizes 3-star rating to 50 (midpoint)', () => {
    // (3-1)/4 = 0.5 → 50 normalized → 50 * 0.6 = 30
    expect(calcProviderTrustScore(3, 5, 0, 0)).toBe(30);
  });

  it('weights completion_rate at 30%', () => {
    // 0 stars (no reviews), 100% completion → 0 + 100*0.3 + 0 = 30
    expect(calcProviderTrustScore(0, 0, 100, 0)).toBe(30);
  });

  it('weights response_rate at 10%', () => {
    // 0 stars (no reviews), 0% completion, 100% response → 0 + 0 + 100*0.1 = 10
    expect(calcProviderTrustScore(0, 0, 0, 100)).toBe(10);
  });

  it('typical high-quality provider scenario', () => {
    // 4.5 stars, 90% completion, 80% response
    // normalized stars: (4.5-1)/4 = 0.875 → 87.5
    // score: 87.5*0.6 + 90*0.3 + 80*0.1 = 52.5 + 27 + 8 = 87.5 → 88
    expect(calcProviderTrustScore(4.5, 20, 90, 80)).toBe(88);
  });

  it('new provider with 2 reviews, 3 stars, no tracking data', () => {
    // normalized: (3-1)/4=0.5 → 50; score: 50*0.6 = 30
    expect(calcProviderTrustScore(3, 2, 0, 0)).toBe(30);
  });
});
