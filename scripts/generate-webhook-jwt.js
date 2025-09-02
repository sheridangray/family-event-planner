#!/usr/bin/env node
/**
 * Generate JWT tokens for Gmail webhook authentication
 * Usage: node scripts/generate-webhook-jwt.js [expiration]
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');

function generateWebhookJWT(expiresIn = '30d') {
  const secret = process.env.GMAIL_WEBHOOK_JWT_SECRET;
  
  if (!secret) {
    console.error('❌ GMAIL_WEBHOOK_JWT_SECRET environment variable not set');
    console.log('Generate a secure secret with: openssl rand -base64 32');
    process.exit(1);
  }

  const payload = {
    iss: 'family-event-planner',        // Issuer
    aud: 'gmail-webhooks',              // Audience
    sub: 'gmail-pubsub-client',         // Subject (the client using this token)
    scope: 'gmail:notifications',       // Scope
    iat: Math.floor(Date.now() / 1000), // Issued at
  };

  try {
    const token = jwt.sign(payload, secret, {
      algorithm: 'HS256',
      expiresIn: expiresIn
    });

    console.log('✅ JWT Token Generated Successfully');
    console.log('🔐 Token (use as Bearer token in Authorization header):');
    console.log(token);
    console.log('');
    console.log('📋 Usage:');
    console.log(`Authorization: Bearer ${token}`);
    console.log('');
    console.log('⏰ Expires in:', expiresIn);
    
    // Verify the token works
    const decoded = jwt.verify(token, secret);
    console.log('✅ Token verification successful');
    console.log('📄 Claims:', JSON.stringify(decoded, null, 2));
    
  } catch (error) {
    console.error('❌ Error generating JWT:', error.message);
    process.exit(1);
  }
}

// Allow custom expiration from command line
const expiration = process.argv[2] || '30d';
generateWebhookJWT(expiration);