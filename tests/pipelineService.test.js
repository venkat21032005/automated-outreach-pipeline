const { mapSettledWithConcurrency } = require('../src/services/pipelineService');

test('collects partial failures without rejecting the batch', async () => {
  const results = await mapSettledWithConcurrency([1, 2, 3], 2, async (value) => {
    if (value === 2) throw new Error('failed item');
    return value * 2;
  });

  expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  expect(results[0].value).toBe(2);
  expect(results[2].value).toBe(6);
});
