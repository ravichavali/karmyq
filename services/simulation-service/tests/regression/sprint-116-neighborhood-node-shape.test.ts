import { overlapFromNeighborhoods } from '../../src/scenarios/mariaRelationshipStory';

describe('Sprint 116 rehearsal — privacy-safe neighborhood node shape', () => {
  it('measures projected API nodes that identify people with user_id', () => {
    const maria = '11111111-1111-1111-1111-111111111111';
    const helper = '22222222-2222-2222-2222-222222222222';
    const node = (user_id: string, degrees_of_separation: number) => ({
      user_id,
      degrees_of_separation,
    });

    const mariaNodes = [
      node(maria, 0),
      node(helper, 1),
      node('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1),
      node('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1),
      node('cccccccc-cccc-cccc-cccc-cccccccccccc', 1),
      node('dddddddd-dddd-dddd-dddd-dddddddddddd', 1),
    ];
    const helperNodes = [
      node(helper, 0),
      node(maria, 1),
      node('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1),
      node('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1),
      node('cccccccc-cccc-cccc-cccc-cccccccccccc', 1),
      node('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1),
    ];

    const overlap = overlapFromNeighborhoods(
      mariaNodes,
      helperNodes,
      maria,
      helper,
      2,
    );

    expect(overlap).toEqual({
      pathDegree: 2,
      sharedConnections: 3,
      mariaOneHop: 4,
      helperOneHop: 4,
    });
  });
});
