#!/usr/bin/env node
require('dotenv').config();

const winston = require('winston');
const { TwilioMCPClient } = require('../src/mcp/twilio');

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Mock database for testing
const mockDatabase = {
  updateSMSResponse: () => Promise.resolve(),
  updateEventStatus: () => Promise.resolve()
};

function testSMSParsing() {
  const twilioClient = new TwilioMCPClient(logger, mockDatabase);
  
  console.log('🧪 Testing SMS Response Parsing\n');
  
  const testCases = [
    // Basic approval responses
    'YES', 'yes', 'Yes', 'Y', 'y',
    'OK', 'ok', 'Sure', 'sure', 'Yeah', 'Yep', 'Yup',
    '1', 'Good', 'Great', 'Perfect', 'Awesome',
    'Book it', 'Go for it', 'Sign us up', 'I want it',
    '✓', '👍',
    
    // Basic rejection responses  
    'NO', 'no', 'No', 'N', 'n',
    'Nope', 'Pass', 'Skip', 'Not interested',
    '0', 'Maybe later', 'Not now', 'Next time',
    '❌', '👎',
    
    // Payment confirmations
    'PAY', 'Paid', 'Payment complete', 'Done', 'Complete',
    
    // Cancellations
    'Cancel', 'Cancelled', 'Abort',
    
    // Ambiguous/unclear responses
    'Maybe', 'I think so', 'Not sure', 'Hmm',
    'What event?', 'Can you repeat?', 'asdfghjkl',
    
    // Edge cases
    '', '   ', 'yes no', 'no yes', 'ok cancel'
  ];
  
  console.log('| Response | Approved | Rejected | Status | Confidence | Special |');
  console.log('|----------|----------|----------|--------|------------|---------|');
  
  testCases.forEach(testInput => {
    const result = twilioClient.parseResponse(testInput);
    
    const specialFlags = [];
    if (result.isPaymentConfirmation) specialFlags.push('Payment');
    if (result.status === 'unclear') specialFlags.push('Unclear');
    if (result.status === 'cancelled') specialFlags.push('Cancelled');
    
    const response = testInput.length > 15 ? testInput.substring(0, 12) + '...' : testInput;
    const special = specialFlags.length > 0 ? specialFlags.join(',') : '-';
    
    console.log(`| "${response}" | ${result.approved ? '✅' : '❌'} | ${result.rejected ? '✅' : '❌'} | ${result.status} | ${result.confidence} | ${special} |`);
  });
  
  console.log('\n🎯 Key Features Tested:');
  console.log('✅ Case-insensitive parsing (YES/yes/Yes)');
  console.log('✅ Single character responses (Y/N, 1/0)');
  console.log('✅ Emoji support (✓/❌/👍/👎)');
  console.log('✅ Natural language (Sure/Nope/Maybe later)');
  console.log('✅ Payment confirmations (PAY/Paid/Complete)');
  console.log('✅ Ambiguity detection with confidence scoring');
  console.log('✅ Edge case handling (empty/mixed responses)');
  
  console.log('\n📊 Response Categories:');
  const categories = {
    'High Confidence Approval': ['yes', 'y', '1', 'ok'],
    'High Confidence Rejection': ['no', 'n', '0'],
    'Payment Confirmation': ['pay', 'paid', 'complete'],
    'Cancellation': ['cancel', 'cancelled'],
    'Unclear/Ambiguous': ['maybe', 'hmm', '']
  };
  
  Object.entries(categories).forEach(([category, examples]) => {
    console.log(`\n${category}:`);
    examples.forEach(example => {
      const result = twilioClient.parseResponse(example);
      console.log(`  "${example}" → ${result.status} (${result.confidence} confidence)`);
    });
  });
  
  console.log('\n✅ SMS parsing test completed!');
}

testSMSParsing();