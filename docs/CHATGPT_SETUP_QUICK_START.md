# ChatGPT Event Discovery - Quick Start Guide

## Step 1: Add API Key to Environment

Add this line to your `.env` file:

```bash
CHATGPT_API_KEY=chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475
```

## Step 2: Restart Your Backend Server

```bash
# If running locally
npm run dev

# If on Render.com, redeploy or restart the service
```

## Step 3: Configure ChatGPT Scheduled Action

In your ChatGPT scheduled action settings, configure it to make an HTTP request:

### Request Configuration

**Method**: POST

**URL**: 
- Production: `https://family-event-planner-backend.onrender.com/api/chatgpt-event-discoveries`
- Local: `http://localhost:3000/api/chatgpt-event-discoveries`

**Headers**:
```
Content-Type: application/json
X-API-Key: chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475
```

**Body**: Use the JSON output from your ChatGPT prompt

### Update Your ChatGPT Prompt

Add these lines to the end of your existing prompt:

```
After generating the event recommendations, make an HTTP POST request to save the results:

URL: https://family-event-planner-backend.onrender.com/api/chatgpt-event-discoveries
Headers:
  Content-Type: application/json
  X-API-Key: chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475

Send the complete JSON response as the request body.
```

## Step 4: Test the Integration

### Option A: Manual Test with curl

```bash
curl -X POST https://family-event-planner-backend.onrender.com/api/chatgpt-event-discoveries \
  -H "Content-Type: application/json" \
  -H "X-API-Key: chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475" \
  -d @test-discovery.json
```

Create `test-discovery.json` with sample data (see full documentation for format).

### Option B: Wait for Scheduled Run

Wait for your 9:00 AM scheduled action to run and check:

1. ChatGPT action logs for success/error messages
2. Your backend logs for incoming request
3. The UI at `/dashboard/chatgpt-suggestions` for the new discovery

## Step 5: Access the UI

1. Go to: `https://your-frontend-domain.com/dashboard/chatgpt-suggestions`
2. You should see your discoveries listed in the left sidebar
3. Click on a discovery to view detailed event information
4. Use the heart icon to mark events as interested
5. Click "Add to Calendar" to add events to Google Calendar

## Troubleshooting

### "Unauthorized" Error
- Double-check the API key matches in both `.env` and ChatGPT settings
- Ensure backend server restarted after adding the env var

### "Rate Limit Exceeded"
- Current limit: 5 requests per hour
- Wait 60 minutes before trying again

### Events Not Showing Up
- Check ChatGPT action logs for errors
- Verify the JSON format matches the required schema
- Check backend logs: `tail -f logs/combined.log`

### Need Help?
See the full documentation: `docs/CHATGPT_EVENT_DISCOVERY.md`

