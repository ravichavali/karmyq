import { classifyTables } from '../../src/fixtures/curatedDemo/tablePolicy';

it('preserves the global skill vocabulary while resetting member skill tags', () => {
  expect(classifyTables([
    { schema: 'auth', table: 'skill_vocabulary', tableType: 'BASE TABLE' },
    { schema: 'auth', table: 'user_tags', tableType: 'BASE TABLE' },
  ])).toEqual({
    preserve: ['auth.skill_vocabulary'],
    reset: ['auth.user_tags'],
    reseed: [],
  });
});
