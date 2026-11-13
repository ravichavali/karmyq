import { classifyTables } from '../../src/fixtures/curatedDemo/tablePolicy';

it('resets frozen nomination electorates along with nominations and ballots', () => {
  expect(classifyTables([{ schema: 'communities', table: 'governance_nomination_voters', tableType: 'BASE TABLE' }]))
    .toEqual({ reset: ['communities.governance_nomination_voters'], reseed: [], preserve: [] });
});

it('still refuses a new unclassified table', () => {
  expect(() => classifyTables([{ schema: 'communities', table: 'unclassified_s142', tableType: 'BASE TABLE' }]))
    .toThrow('unclassified table communities.unclassified_s142');
});
