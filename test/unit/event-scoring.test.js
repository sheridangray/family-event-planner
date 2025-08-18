const EventScorer = require('../../src/scoring');

describe('Event Scoring System', () => {
  let eventScorer;
  let mockLogger;
  let mockDatabase;

  beforeEach(() => {
    mockLogger = global.createMockLogger();
    mockDatabase = global.createMockDatabase();
    eventScorer = new EventScorer(mockLogger, mockDatabase);
  });

  describe('Basic Score Calculation', () => {
    test('should score free events higher than paid events', async () => {
      const freeEvent = {
        id: 1,
        title: 'Free Family Fun',
        description: 'A fun free family event for all ages',
        cost: 0,
        ageRange: { min: 2, max: 8 },
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        location: { address: 'San Francisco, CA' }
      };

      const paidEvent = {
        id: 2,
        title: 'Expensive Adventure',
        description: 'An expensive adventure for families',
        cost: 50,
        ageRange: { min: 2, max: 8 },
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: { address: 'San Francisco, CA' }
      };

      const freeScore = await eventScorer.scoreEvent(freeEvent);
      const paidScore = await eventScorer.scoreEvent(paidEvent);

      expect(freeScore.totalScore).toBeGreaterThan(paidScore.totalScore);
    });

    test('should prefer events with perfect age matches', async () => {
      const perfectAgeEvent = {
        id: 1,
        title: 'Perfect Age Event',
        description: 'Perfect age event for kids',
        cost: 0,
        ageRange: { min: 2, max: 5 }, // Perfect for both kids
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: { address: 'San Francisco, CA' }
      };

      const poorAgeEvent = {
        id: 2,
        title: 'Poor Age Event',
        description: 'An event for older kids',
        cost: 0,
        ageRange: { min: 10, max: 15 }, // Too old for both kids
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: { address: 'San Francisco, CA' }
      };

      const perfectScore = await eventScorer.scoreEvent(perfectAgeEvent);
      const poorScore = await eventScorer.scoreEvent(poorAgeEvent);

      expect(perfectScore.totalScore).toBeGreaterThan(poorScore.totalScore);
    });

    test('should prefer events happening soon (but not too soon)', async () => {
      const soonEvent = {
        id: 1,
        title: 'Soon Event',
        description: 'An event happening soon',
        cost: 0,
        ageRange: { min: 2, max: 8 },
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        location: { address: 'San Francisco, CA' }
      };

      const farEvent = {
        id: 2,
        title: 'Far Event',
        description: 'An event happening in the future',
        cost: 0,
        ageRange: { min: 2, max: 8 },
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        location: { address: 'San Francisco, CA' }
      };

      const soonScore = await eventScorer.scoreEvent(soonEvent);
      const farScore = await eventScorer.scoreEvent(farEvent);

      expect(soonScore.totalScore).toBeGreaterThan(farScore.totalScore);
    });
  });

  describe('Age Compatibility Scoring', () => {
    test('should calculate age match percentage correctly', () => {
      // Apollo: 4, Athena: 2
      const ageRange = { min: 2, max: 6 };
      const compatibility = eventScorer.calculateAgeCompatibility(ageRange);
      
      expect(compatibility.percentage).toBeGreaterThan(0.8); // Both kids fit well
      expect(compatibility.details.apollo.fits).toBe(true);
      expect(compatibility.details.athena.fits).toBe(true);
    });

    test('should handle partial age matches', () => {
      const ageRange = { min: 4, max: 8 }; // Only Apollo fits well
      const compatibility = eventScorer.calculateAgeCompatibility(ageRange);
      
      expect(compatibility.details.apollo.fits).toBe(true);
      expect(compatibility.details.athena.fits).toBe(false);
      expect(compatibility.percentage).toBeLessThan(1.0);
    });

    test('should handle no age matches gracefully', () => {
      const ageRange = { min: 15, max: 18 }; // Neither kid fits
      const compatibility = eventScorer.calculateAgeCompatibility(ageRange);
      
      expect(compatibility.details.apollo.fits).toBe(false);
      expect(compatibility.details.athena.fits).toBe(false);
      expect(compatibility.percentage).toBeLessThan(0.5);
    });
  });

  describe('Cost Scoring', () => {
    test('should give maximum points to free events', () => {
      const costScore = eventScorer.calculateCostScore(0);
      expect(costScore).toBe(1.0);
    });

    test('should penalize expensive events', () => {
      const cheapScore = eventScorer.calculateCostScore(10);
      const expensiveScore = eventScorer.calculateCostScore(100);
      
      expect(cheapScore).toBeGreaterThan(expensiveScore);
      expect(expensiveScore).toBeLessThan(0.5);
    });

    test('should have reasonable cost thresholds', () => {
      const moderateScore = eventScorer.calculateCostScore(25);
      expect(moderateScore).toBeGreaterThan(0.3);
      expect(moderateScore).toBeLessThan(0.8);
    });
  });

  describe('Timing Scoring', () => {
    test('should prefer optimal timing windows', () => {
      const now = Date.now();
      const optimal = new Date(now + 7 * 24 * 60 * 60 * 1000); // 1 week
      const tooSoon = new Date(now + 1 * 24 * 60 * 60 * 1000); // 1 day
      const tooFar = new Date(now + 60 * 24 * 60 * 60 * 1000); // 2 months

      const optimalScore = eventScorer.calculateTimingScore(optimal);
      const soonScore = eventScorer.calculateTimingScore(tooSoon);
      const farScore = eventScorer.calculateTimingScore(tooFar);

      expect(optimalScore).toBeGreaterThan(soonScore);
      expect(optimalScore).toBeGreaterThan(farScore);
    });

    test('should handle past events gracefully', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const score = eventScorer.calculateTimingScore(pastDate);
      expect(score).toBe(0);
    });
  });

  describe('Social Proof Scoring', () => {
    test('should boost events with high ratings', () => {
      const highRatedEvent = {
        socialProof: {
          yelpRating: 4.8,
          googleRating: 4.9,
          reviewCount: 100
        }
      };

      const lowRatedEvent = {
        socialProof: {
          yelpRating: 2.1,
          googleRating: 2.5,
          reviewCount: 10
        }
      };

      const highScore = eventScorer.calculateSocialProofScore(highRatedEvent);
      const lowScore = eventScorer.calculateSocialProofScore(lowRatedEvent);

      expect(highScore).toBeGreaterThan(lowScore);
    });

    test('should handle events without social proof', () => {
      const noProofEvent = { socialProof: null };
      const score = eventScorer.calculateSocialProofScore(noProofEvent);
      expect(score).toBe(0.5); // Neutral score
    });
  });

  describe('Batch Event Scoring', () => {
    test('should score multiple events and sort by score', async () => {
      const events = [
        {
          id: 1,
          title: 'Good Event',
          description: 'A good family event',
          cost: 0,
          ageRange: { min: 2, max: 6 },
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          location: { address: 'San Francisco, CA' }
        },
        {
          id: 2,
          title: 'Bad Event',
          description: 'An expensive event for teens',
          cost: 100,
          ageRange: { min: 15, max: 18 },
          date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          location: { address: 'San Francisco, CA' }
        }
      ];

      const scoredEvents = await eventScorer.scoreEvents(events);

      expect(scoredEvents).toHaveLength(2);
      expect(scoredEvents[0].totalScore).toBeGreaterThan(scoredEvents[1].totalScore);
      expect(scoredEvents[0].title).toBe('Good Event');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed events gracefully', async () => {
      const malformedEvent = {
        id: 1,
        title: 'Malformed Event'
        // Missing required fields
      };

      const score = await eventScorer.scoreEvent(malformedEvent);
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.error).toBeTruthy();
    });

    test('should handle invalid dates', async () => {
      const invalidDateEvent = {
        id: 1,
        title: 'Invalid Date Event',
        description: 'An event with invalid date',
        cost: 0,
        ageRange: { min: 2, max: 8 },
        date: 'invalid-date',
        location: { address: 'San Francisco, CA' }
      };

      const score = await eventScorer.scoreEvent(invalidDateEvent);
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
    });
  });
});