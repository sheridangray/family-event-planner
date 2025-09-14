const EventDeduplicator = require('./src/utils/event-deduplicator');
const { normalizeString, compositeSimilarity } = require('./src/utils/string-similarity');
const { normalizeAddress, compareLocations } = require('./src/utils/location-normalizer');

// Mock logger
const logger = {
  info: console.log,
  debug: console.log,
  warn: console.warn,
  error: console.error
};

async function testStringNormalization() {
  console.log('\n=== Testing String Normalization ===');
  
  const testCases = [
    ['Storytime Science for Kids', 'storytime science kids'],
    ['Children\'s Art Workshop!', 'childrens art workshop'],
    ['The Amazing Science Show', 'amazing science show'],
    ['Family Fun Day at the Park', 'family fun day park']
  ];
  
  for (const [input, expected] of testCases) {
    const result = normalizeString(input);
    console.log(`"${input}" -> "${result}" (expected: "${expected}")`);
    console.log(`✓ ${result === expected ? 'PASS' : 'FAIL'}`);
  }
}

async function testLocationNormalization() {
  console.log('\n=== Testing Location Normalization ===');
  
  const testCases = [
    ['Golden Gate Park, San Francisco, CA', 'golden gate park'],
    ['Pier 15, The Embarcadero, SF', 'pier 15 embarcadero'],
    ['123 Main Street, San Francisco', '123 main street'],
    ['Yerba Buena Gardens', 'yerba buena gardens']
  ];
  
  for (const [input, expected] of testCases) {
    const result = normalizeAddress(input);
    console.log(`"${input}" -> "${result}"`);
    const words = result.split(' ').filter(w => w.length > 0);
    const expectedWords = expected.split(' ');
    const hasExpectedWords = expectedWords.every(word => words.includes(word));
    console.log(`✓ ${hasExpectedWords ? 'PASS' : 'FAIL'}`);
  }
}

async function testLocationSimilarity() {
  console.log('\n=== Testing Location Similarity ===');
  
  const testCases = [
    [
      { address: 'Golden Gate Park, San Francisco' },
      { address: 'GG Park, SF' },
      0.8 // Should be high similarity
    ],
    [
      { address: 'Pier 15, The Embarcadero' },
      { address: 'Exploratorium, Pier 15' },
      0.8 // Should be high similarity
    ],
    [
      { address: 'Mission St between 3rd & 4th' },
      { address: 'Yerba Buena Gardens, Mission Street' },
      0.5 // Should be moderate similarity
    ]
  ];
  
  for (const [loc1, loc2, expectedMin] of testCases) {
    const similarity = compareLocations(loc1, loc2);
    console.log(`"${loc1.address}" vs "${loc2.address}": ${similarity.toFixed(3)}`);
    console.log(`✓ ${similarity >= expectedMin ? 'PASS' : 'FAIL'} (expected >= ${expectedMin})`);
  }
}

async function testEventDeduplication() {
  console.log('\n=== Testing Event Deduplication ===');
  
  const deduplicator = new EventDeduplicator(logger);
  
  // Test events that should be considered duplicates
  const testEvents = [
    {
      id: 'original',
      source: 'Exploratorium',
      title: 'Storytime Science for Kids: Movers and Shakers',
      date: new Date('2025-08-16T12:00:00'),
      location: { address: 'Pier 15, The Embarcadero, San Francisco, CA' },
      ageRange: { min: 3, max: 8 },
      cost: 0,
      description: 'Enjoy an engaging storybook read-aloud followed by a related activity.'
    },
    {
      id: 'duplicate1',
      source: 'YBG Festival',
      title: 'Storytime Science for Kids',
      date: new Date('2025-08-16T12:00:00'),
      location: { address: 'Exploratorium at Pier 15' },
      ageRange: { min: 2, max: 10 },
      cost: 0,
      description: 'Interactive storytime with science activities for children.'
    },
    {
      id: 'similar',
      source: 'SF Library',
      title: 'Science Story Time',
      date: new Date('2025-08-16T12:30:00'),
      location: { address: 'Pier 15, Embarcadero' },
      ageRange: { min: 4, max: 8 },
      cost: 0,
      description: 'Story time with science themes and hands-on activities.'
    },
    {
      id: 'different',
      source: 'Cal Academy',
      title: 'Planetarium Show',
      date: new Date('2025-08-16T14:00:00'),
      location: { address: 'California Academy of Sciences, Golden Gate Park' },
      ageRange: { min: 5, max: 12 },
      cost: 15,
      description: 'Educational planetarium presentation about space.'
    }
  ];
  
  console.log(`\nTesting with ${testEvents.length} events...`);
  
  const uniqueEvents = await deduplicator.deduplicateEvents(testEvents);
  
  console.log(`\nResults: ${testEvents.length} input -> ${uniqueEvents.length} unique`);
  
  uniqueEvents.forEach((event, index) => {
    console.log(`\n--- Unique Event ${index + 1} ---`);
    console.log(`Title: ${event.title}`);
    console.log(`Sources: ${event.sources ? event.sources.join(', ') : event.source}`);
    console.log(`Merge count: ${event.mergeCount || 1}`);
    if (event.alternateUrls) {
      console.log(`Alternate URLs: ${event.alternateUrls.length}`);
    }
  });
  
  const stats = deduplicator.getStats();
  console.log('\nDeduplication Stats:', stats);
  
  // Verify expected behavior
  console.log('\n--- Verification ---');
  console.log(`✓ Should have 2-3 unique events: ${uniqueEvents.length <= 3 ? 'PASS' : 'FAIL'}`);
  
  const hasMergedEvent = uniqueEvents.some(e => e.sources && e.sources.length > 1);
  console.log(`✓ Should have merged events: ${hasMergedEvent ? 'PASS' : 'FAIL'}`);
}

async function testEdgeCases() {
  console.log('\n=== Testing Edge Cases ===');
  
  const deduplicator = new EventDeduplicator(logger);
  
  // Test with empty/null data
  const edgeCaseEvents = [
    {
      id: 'empty-title',
      source: 'Test',
      title: '',
      date: new Date('2025-08-16T12:00:00'),
      location: { address: 'Test Location' },
      ageRange: { min: 0, max: 18 },
      cost: 0
    },
    {
      id: 'null-location',
      source: 'Test',
      title: 'Test Event',
      date: new Date('2025-08-16T12:00:00'),
      location: null,
      ageRange: { min: 0, max: 18 },
      cost: 0
    },
    {
      id: 'malformed-date',
      source: 'Test',
      title: 'Test Event 2',
      date: 'not-a-date',
      location: { address: 'Test Location' },
      ageRange: { min: 0, max: 18 },
      cost: 0
    }
  ];
  
  try {
    const uniqueEvents = await deduplicator.deduplicateEvents(edgeCaseEvents);
    console.log(`✓ Handled edge cases: ${uniqueEvents.length} events processed`);
  } catch (error) {
    console.log(`✗ Edge case handling failed: ${error.message}`);
  }
}

async function testPerformance() {
  console.log('\n=== Testing Performance ===');
  
  const deduplicator = new EventDeduplicator(logger);
  
  // Generate a large number of similar events
  const largeEventSet = [];
  const baseEvent = {
    source: 'Performance Test',
    title: 'Test Event',
    date: new Date('2025-08-16T12:00:00'),
    location: { address: 'Test Location, San Francisco, CA' },
    ageRange: { min: 3, max: 8 },
    cost: 0,
    description: 'Performance test event'
  };
  
  for (let i = 0; i < 100; i++) {
    largeEventSet.push({
      ...baseEvent,
      id: `perf-${i}`,
      title: `Test Event ${i % 10}`, // Create 10 groups of similar events
      date: new Date(baseEvent.date.getTime() + (i % 5) * 60000) // Vary by minutes
    });
  }
  
  const startTime = Date.now();
  const uniqueEvents = await deduplicator.deduplicateEvents(largeEventSet);
  const endTime = Date.now();
  
  console.log(`Performance test: ${largeEventSet.length} events -> ${uniqueEvents.length} unique in ${endTime - startTime}ms`);
  console.log(`✓ ${endTime - startTime < 5000 ? 'PASS' : 'FAIL'} (should complete in < 5 seconds)`);
}

async function runAllTests() {
  console.log('🧪 Starting Event Deduplication Tests\n');
  
  try {
    await testStringNormalization();
    await testLocationNormalization();
    await testLocationSimilarity();
    await testEventDeduplication();
    await testEdgeCases();
    await testPerformance();
    
    console.log('\n✅ All deduplication tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

runAllTests();