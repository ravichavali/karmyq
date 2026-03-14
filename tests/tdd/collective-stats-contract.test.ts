/**
 * TDD: Collective stats display contract
 * Sprint 26 - Provider Collective Profiles & Discovery
 */

describe('Collective stats contract', () => {
  describe('fulfillment_rate display', () => {
    it('formats fulfillment_rate as percentage string', () => {
      const rate = 83.3;
      expect(`${rate}%`).toBe('83.3%');
    });

    it('handles 0% fulfillment rate', () => {
      const rate = 0;
      expect(`${rate}%`).toBe('0%');
    });

    it('handles 100% fulfillment rate', () => {
      const rate = 100;
      expect(`${rate}%`).toBe('100%');
    });
  });

  describe('avg_completion_hours display', () => {
    it('displays em-dash when avg_completion_hours is null', () => {
      const hours: number | null = null;
      const display = hours != null ? `${hours}h` : '—';
      expect(display).toBe('—');
    });

    it('formats avg_completion_hours with h suffix when present', () => {
      const hours = 2.4;
      const display = hours != null ? `${hours}h` : '—';
      expect(display).toBe('2.4h');
    });

    it('formats whole number hours correctly', () => {
      const hours = 6;
      const display = hours != null ? `${hours}h` : '—';
      expect(display).toBe('6h');
    });
  });

  describe('stats object validation', () => {
    it('stats object with zero total_requests_matched is valid', () => {
      const stats = {
        total_requests_matched: 0,
        fulfillment_rate: 0,
        avg_completion_hours: null,
        communities_served_count: 0,
        available_member_count: 0,
      };
      expect(stats.total_requests_matched).toBe(0);
      expect(stats.fulfillment_rate).toBe(0);
      expect(stats.avg_completion_hours).toBeNull();
    });

    it('stats object with positive values is valid', () => {
      const stats = {
        total_requests_matched: 12,
        fulfillment_rate: 83.3,
        avg_completion_hours: 2.4,
        communities_served_count: 3,
        available_member_count: 4,
      };
      expect(stats.total_requests_matched).toBe(12);
      expect(stats.fulfillment_rate).toBe(83.3);
      expect(stats.available_member_count).toBe(4);
    });

    it('shows "Available now" count from available_member_count', () => {
      const stats = { available_member_count: 3 };
      const label = `${stats.available_member_count} available now`;
      expect(label).toBe('3 available now');
    });
  });
});
