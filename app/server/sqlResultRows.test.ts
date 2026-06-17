import { describe, expect, test } from 'vitest';
import { sqlResultRows } from './sqlResultRows';

describe('sqlResultRows', () => {
  test('reads AppKit analytics rows from nested result.data', () => {
    const rows = sqlResultRows({
      result: {
        data: [
          { total: '9989', avg_score: '69' },
        ],
      },
    });

    expect(rows).toEqual([{ total: '9989', avg_score: '69' }]);
  });
});
