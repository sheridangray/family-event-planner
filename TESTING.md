# Testing Framework Documentation

## Overview

This project uses a comprehensive testing framework designed to ensure reliability and prevent regressions during "vibe coding" development. The testing strategy covers unit tests, integration tests, error scenarios, and manual testing workflows.

## Test Structure

```
test/
├── setup.js              # Jest configuration and global mocks
├── unit/                  # Unit tests for individual components
│   ├── sms-parsing.test.js
│   └── event-scoring.test.js
├── integration/           # Integration tests for complete workflows
│   ├── sms-workflow.test.js
│   └── calendar-conflicts.test.js
├── error-scenarios/       # Error handling and edge case tests
│   └── system-failures.test.js
└── mocks/                 # Mock implementations for external services
    ├── database.js
    └── external-services.js
```

## Running Tests

### Quick Commands
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:errors        # Error scenario tests only

# Development workflows
npm run test:watch         # Watch mode for development
npm run test:coverage      # Generate coverage report
npm run test:ci           # CI/CD optimized run

# Manual testing
npm run test:manual       # Run manual test scripts
npm run test:sms         # Test SMS parsing manually
npm run test:calendar    # Test calendar integration manually
```

## Test Categories

### 1. Unit Tests
Test individual components in isolation with mocked dependencies.

**SMS Parsing (`test/unit/sms-parsing.test.js`)**
- Tests all SMS response patterns (YES/NO/MAYBE/emojis)
- Validates confidence scoring and ambiguity detection
- Covers edge cases like whitespace and malformed input

**Event Scoring (`test/unit/event-scoring.test.js`)**
- Tests scoring algorithm components
- Validates age compatibility calculations
- Tests cost, timing, and social proof scoring

### 2. Integration Tests
Test complete workflows with realistic data flows.

**SMS Workflow (`test/integration/sms-workflow.test.js`)**
- End-to-end SMS approval process
- Real-time vs scheduled processing
- Timeout and reminder functionality
- Registration automation triggers

**Calendar Conflicts (`test/integration/calendar-conflicts.test.js`)**
- Joyce vs Sheridan conflict priorities
- Error handling with individual calendar failures
- Time buffer and overlap detection
- All-day event handling

### 3. Error Scenarios
Test system resilience and graceful degradation.

**System Failures (`test/error-scenarios/system-failures.test.js`)**
- Database connection failures
- External service outages (Gmail, Twilio, etc.)
- Network timeouts and intermittent failures
- Resource exhaustion scenarios
- Data corruption and invalid states
- Race conditions and concurrency issues

## Mocking Strategy

### External Services
All external services are mocked by default to ensure:
- Fast, reliable test execution
- No external dependencies during testing
- Controlled error scenarios
- Consistent test results

**Mocked Services:**
- Twilio SMS API
- Google Calendar API
- Gmail API
- Puppeteer browser automation
- Database connections

### Mock Configurations
```javascript
// In test files, configure mocks as needed:
const mockServices = createMockGoogleServices();
mockServices._mockCalendar.setFailureMode('auth');
mockServices._mockGmail.setCalendarEvents('joyce@example.com', [conflictEvent]);
```

## Coverage Requirements

The project maintains minimum coverage thresholds:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

Critical business logic should aim for 90%+ coverage.

## Best Practices

### Writing Tests
1. **Use descriptive test names** that explain the scenario
2. **Test both happy path and error conditions**
3. **Mock external dependencies** appropriately
4. **Use beforeEach/afterEach** for proper test isolation
5. **Test edge cases** and boundary conditions

### Debugging Tests
```bash
# Run with debugging enabled
DEBUG=* npm test

# Run specific test file
npm test -- sms-parsing.test.js

# Run with increased timeout for debugging
npm test -- --testTimeout=60000
```

### CI/CD Integration
```bash
# Optimized for CI environments
npm run test:ci
```
This command:
- Runs all tests once (no watch mode)
- Generates coverage reports
- Uses appropriate timeouts for CI

## Manual Testing Scripts

For scenarios requiring real external service testing:

### SMS Testing
```bash
npm run test:sms
```
- Tests actual SMS parsing logic
- Displays comprehensive parsing results
- Useful for validating new response patterns

### Calendar Integration Testing  
```bash
npm run test:calendar
```
- Tests real Google Calendar API integration
- Validates authentication and permissions
- Helps debug calendar access issues

## Common Testing Scenarios

### Testing New SMS Response Patterns
1. Add test cases to `test/unit/sms-parsing.test.js`
2. Run `npm run test:sms` to validate manually
3. Ensure coverage includes both unit and integration tests

### Testing Error Handling
1. Use `FailingMockDatabase` for database error simulation
2. Configure service mocks with appropriate failure modes
3. Verify graceful degradation and proper logging

### Testing Real External Services
1. Use manual test scripts for initial validation
2. Create integration tests with controlled mock data
3. Document any external service requirements in test comments

## Continuous Improvement

### Adding New Tests
When adding new features:
1. **Start with unit tests** for core logic
2. **Add integration tests** for workflows
3. **Include error scenarios** for resilience
4. **Update manual tests** if external services are involved

### Monitoring Test Health
- Review coverage reports regularly
- Investigate flaky tests immediately
- Update mocks when external APIs change
- Maintain test performance (target < 30s for full suite)

## Troubleshooting

### Common Issues
1. **Test timeouts**: Increase timeout or check for infinite loops
2. **Mock not working**: Verify mock setup in `test/setup.js`
3. **Coverage too low**: Add tests for untested code paths
4. **Flaky tests**: Check for race conditions or external dependencies

### Getting Help
- Check existing test files for patterns
- Review mock implementations in `test/mocks/`
- Use `DEBUG=*` for verbose logging during tests
- Run manual test scripts to isolate issues

This testing framework ensures that the Family Event Planner remains reliable and maintainable during rapid development cycles.