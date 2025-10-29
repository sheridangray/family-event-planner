#!/bin/bash

# Test script for ChatGPT Event Discovery API
# This script tests the POST endpoint with sample data

echo "🧪 Testing ChatGPT Event Discovery API..."
echo ""

# Configuration
API_KEY="chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475"
BACKEND_URL="http://localhost:3000"  # Change to production URL if needed

# Check if sample JSON exists
if [ ! -f "docs/test-discovery-sample.json" ]; then
    echo "❌ Error: docs/test-discovery-sample.json not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "📡 Sending POST request to: ${BACKEND_URL}/api/chatgpt-event-discoveries"
echo ""

# Make the request
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "${BACKEND_URL}/api/chatgpt-event-discoveries" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d @docs/test-discovery-sample.json)

# Extract HTTP status
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "📥 Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Check status
if [ "$HTTP_STATUS" = "201" ]; then
    echo "✅ Success! Discovery saved successfully"
    echo ""
    echo "🎉 Next steps:"
    echo "   1. Open your browser to http://localhost:3001/dashboard/chatgpt-suggestions"
    echo "   2. You should see the test discovery in the list"
    echo "   3. Click on it to view the 5 sample events"
elif [ "$HTTP_STATUS" = "401" ]; then
    echo "❌ Authentication failed"
    echo "   Check that:"
    echo "   - CHATGPT_API_KEY is set in your .env file"
    echo "   - Backend server has been restarted after adding the env var"
elif [ "$HTTP_STATUS" = "429" ]; then
    echo "⏱️  Rate limit exceeded"
    echo "   Wait 1 hour before trying again (limit: 5 requests/hour)"
elif [ "$HTTP_STATUS" = "000" ] || [ -z "$HTTP_STATUS" ]; then
    echo "❌ Connection failed"
    echo "   Check that:"
    echo "   - Backend server is running (npm run dev)"
    echo "   - URL is correct: ${BACKEND_URL}"
else
    echo "❌ Request failed with status: $HTTP_STATUS"
fi

echo ""

