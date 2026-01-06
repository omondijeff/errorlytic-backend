#!/usr/bin/env node

/**
 * Script to check OpenRouter/Claude API usage
 * This script queries the OpenRouter API to get usage statistics
 */

const https = require('https');

// Get API key from environment or docker-compose
const API_KEY = process.env.OPENAI_API_KEY || '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';

if (!API_KEY || !API_KEY.startsWith('sk-or-v1')) {
  console.error('❌ Error: OpenRouter API key not found or invalid');
  console.log('Make sure OPENAI_API_KEY is set in your environment');
  process.exit(1);
}

console.log('🔍 Checking OpenRouter API usage...\n');

// OpenRouter API endpoint for usage
const options = {
  hostname: 'openrouter.ai',
  path: '/api/v1/auth/key',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      if (res.statusCode === 200) {
        const response = JSON.parse(data);
        console.log('✅ API Key Status:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (response.data) {
          const keyInfo = response.data;
          console.log(`📝 Label: ${keyInfo.label || 'N/A'}`);
          console.log(`🔑 Key ID: ${keyInfo.id || 'N/A'}`);
          console.log(`💰 Credits: ${keyInfo.credits !== undefined ? keyInfo.credits : 'N/A'}`);
          console.log(`📊 Usage: ${keyInfo.usage !== undefined ? JSON.stringify(keyInfo.usage, null, 2) : 'N/A'}`);
          console.log(`⏰ Created: ${keyInfo.created_at || 'N/A'}`);
          console.log(`🔄 Last Used: ${keyInfo.last_used_at || 'N/A'}`);
        } else {
          console.log(JSON.stringify(response, null, 2));
        }
        
        console.log('\n💡 To view detailed usage:');
        console.log('   Visit: https://openrouter.ai/keys');
      } else {
        console.error(`❌ Error: ${res.statusCode}`);
        console.log('Response:', data);
        
        if (res.statusCode === 401) {
          console.log('\n⚠️  Authentication failed. Please check your API key.');
        }
      }
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
  console.log('\n💡 Alternative: Visit https://openrouter.ai/keys to check your usage');
});

req.end();

// Also provide instructions for checking usage via web
setTimeout(() => {
  console.log('\n📖 Additional Options:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. OpenRouter Dashboard:');
  console.log('   → https://openrouter.ai/keys');
  console.log('   → https://openrouter.ai/activity');
  console.log('\n2. If using Claude directly (Anthropic):');
  console.log('   → https://console.anthropic.com/settings/usage');
  console.log('\n3. Check your application\'s internal usage:');
  console.log('   → Query the Metering collection in MongoDB');
  console.log('   → Check billing dashboard: /api/v1/billing/usage');
}, 2000);










