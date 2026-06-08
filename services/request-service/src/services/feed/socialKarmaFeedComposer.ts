import { query } from '../../database/db';

export interface CommunityHealthSummary {
  communityId: string;
  communityName: string;
  networkStrength: number;
  networkStrengthLabel: string;
  totalMatches: number;
  activeHelpers: number;
  growthRate: number;
  trendDirection: 'growing' | 'stable' | 'declining';
}

export class SocialKarmaFeedComposer {
  async getCommunityHealthSummary(communityId: string): Promise<CommunityHealthSummary | null> {
    const communityResult = await query(
      `SELECT id, name FROM communities.communities WHERE id = $1`,
      [communityId]
    );

    if (communityResult.rowCount === 0) {
      return null;
    }

    const community = communityResult.rows[0];
    const metricsResult = await query(
      `SELECT
        total_matches_completed,
        total_active_helpers,
        network_density,
        avg_helpfulness,
        avg_responsiveness,
        avg_clarity,
        growth_rate_matches
      FROM reputation.community_health_metrics
      WHERE community_id = $1
      ORDER BY snapshot_date DESC
      LIMIT 1`,
      [communityId]
    );

    if (metricsResult.rowCount === 0) {
      return {
        communityId: community.id,
        communityName: community.name,
        networkStrength: 0,
        networkStrengthLabel: this.getNetworkStrengthLabel(0),
        totalMatches: 0,
        activeHelpers: 0,
        growthRate: 0,
        trendDirection: 'stable',
      };
    }

    const metrics = metricsResult.rows[0];
    const totalMatches = Number(metrics.total_matches_completed) || 0;
    const avgHelpfulness = Number(metrics.avg_helpfulness) || 0;
    const avgResponsiveness = Number(metrics.avg_responsiveness) || 0;
    const avgClarity = Number(metrics.avg_clarity) || 0;
    const networkDensity = Number(metrics.network_density) || 0;

    const activityScore = Math.min(100, totalMatches * 2);
    const qualityScore = ((avgHelpfulness + avgResponsiveness + avgClarity) / 3) * 20;
    const densityScore = networkDensity * 100;
    const networkStrength = activityScore * 0.4 + qualityScore * 0.4 + densityScore * 0.2;
    const growthRate = Number(metrics.growth_rate_matches) || 0;

    return {
      communityId: community.id,
      communityName: community.name,
      networkStrength: Math.round(networkStrength * 10) / 10,
      networkStrengthLabel: this.getNetworkStrengthLabel(networkStrength),
      totalMatches,
      activeHelpers: Number(metrics.total_active_helpers) || 0,
      growthRate: Math.round(growthRate * 10) / 10,
      trendDirection: this.getTrendDirection(growthRate),
    };
  }

  private getNetworkStrengthLabel(score: number): string {
    if (score >= 80) return 'Thriving';
    if (score >= 60) return 'Strong';
    if (score >= 40) return 'Growing';
    if (score >= 20) return 'Developing';
    return 'Building';
  }

  private getTrendDirection(growthRate: number): 'growing' | 'stable' | 'declining' {
    if (growthRate > 5) return 'growing';
    if (growthRate < -5) return 'declining';
    return 'stable';
  }
}
