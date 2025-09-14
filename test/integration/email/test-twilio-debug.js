/**
 * Twilio Debug Test
 * 
 * Checks Twilio account status and phone number verification
 */

require('dotenv').config({ path: '../.env' });
const twilio = require('twilio');

async function debugTwilio() {
  try {
    console.log('🔍 Debugging Twilio configuration...\n');
    
    // Parse credentials
    const twilioConfig = JSON.parse(process.env.MCP_TWILIO_CREDENTIALS);
    console.log('✓ Credentials parsed successfully');
    console.log(`Account SID: ${twilioConfig.accountSid}`);
    console.log(`From Number: ${twilioConfig.phoneNumber}`);
    console.log(`To Number: ${process.env.TWILIO_PHONE_TO}\n`);
    
    // Initialize client
    const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    
    // Check account info
    console.log('📋 Checking account information...');
    const account = await client.accounts(twilioConfig.accountSid).fetch();
    console.log(`Account Status: ${account.status}`);
    console.log(`Account Type: ${account.type}`);
    console.log(`Account Friendly Name: ${account.friendlyName}\n`);
    
    // Check if destination number is verified (for trial accounts)
    console.log('📱 Checking verified phone numbers...');
    try {
      const verifiedNumbers = await client.validationRequests.list();
      console.log(`Verified numbers count: ${verifiedNumbers.length}`);
      
      const targetNumber = process.env.TWILIO_PHONE_TO;
      const isVerified = verifiedNumbers.some(num => num.phoneNumber === targetNumber);
      console.log(`Target number ${targetNumber} verified: ${isVerified}\n`);
      
      if (!isVerified && account.type === 'Trial') {
        console.log('⚠️  ISSUE FOUND: Target number is not verified and account is in trial mode');
        console.log('📋 To fix this:');
        console.log('1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
        console.log('2. Click "Add a new number"');
        console.log(`3. Add and verify ${targetNumber}`);
        console.log('4. Then try sending SMS again\n');
      }
    } catch (error) {
      console.log('Could not check verified numbers (this is normal for full accounts)\n');
    }
    
    // Check recent messages
    console.log('📨 Checking recent message attempts...');
    const messages = await client.messages.list({ limit: 5 });
    
    messages.forEach(message => {
      console.log(`SID: ${message.sid}`);
      console.log(`Status: ${message.status}`);
      console.log(`From: ${message.from} → To: ${message.to}`);
      console.log(`Error Code: ${message.errorCode || 'None'}`);
      console.log(`Error Message: ${message.errorMessage || 'None'}`);
      console.log(`Date: ${message.dateCreated}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugTwilio();