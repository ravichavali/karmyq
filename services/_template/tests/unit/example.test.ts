/**
 * Example unit test
 *
 * Unit tests should test individual functions/methods in isolation
 * Mock external dependencies (database, APIs, etc.)
 */

describe('Example Unit Tests', () => {
  describe('calculateSum', () => {
    it('should add two numbers correctly', () => {
      const result = 2 + 2;
      expect(result).toBe(4);
    });

    it('should handle negative numbers', () => {
      const result = -5 + 3;
      expect(result).toBe(-2);
    });
  });

  describe('validateInput', () => {
    it('should return true for valid input', () => {
      const input = 'valid-string';
      expect(input.length).toBeGreaterThan(0);
    });

    it('should return false for empty input', () => {
      const input = '';
      expect(input.length).toBe(0);
    });
  });
});

// Example of mocking a database function
describe('Database Operations', () => {
  it('should mock database query', async () => {
    // Mock the database query
    const mockQuery = jest.fn().mockResolvedValue({
      rows: [{ id: 1, name: 'Test' }],
      rowCount: 1
    });

    const result = await mockQuery('SELECT * FROM users WHERE id = $1', [1]);

    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Test');
  });
});
