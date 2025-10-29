# ChatGPT Daily Event Suggestions

This feature allows ChatGPT's scheduled actions to send AI-curated event suggestions directly to your Family Event Planner application.

## Overview

ChatGPT runs a scheduled search daily at 9:00 AM, finding kid-friendly events 14 days in advance. The results are automatically posted to your application via API, where you can review, mark favorites, and add events to your calendar.

## Setup Instructions

### 1. Configure Environment Variables

Add the following to your `.env` file:

```bash
# ChatGPT API Key for Event Discovery
CHATGPT_API_KEY=chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475
```

**Important**: Keep this API key secure! It authenticates ChatGPT's requests to your backend.

### 2. Configure ChatGPT Scheduled Action

In your ChatGPT scheduled action (running daily at 9:00 AM), add the following configuration:

#### API Endpoint Configuration

- **URL**: `https://your-backend-domain.com/api/chatgpt-event-discoveries`
  - For local development: `http://localhost:3000/api/chatgpt-event-discoveries`
  - For production (Render): `https://family-event-planner-backend.onrender.com/api/chatgpt-event-discoveries`

- **Method**: `POST`

- **Headers**:
  ```json
  {
    "Content-Type": "application/json",
    "X-API-Key": "chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475"
  }
  ```

- **Body**: The JSON output from your ChatGPT prompt (see below)

#### ChatGPT Prompt Instructions

Your ChatGPT prompt should output JSON in this exact format:

```json
{
  "dateSearched": "2025-11-28T09:00:00Z",
  "searchContext": {
    "searchRadiusMiles": 25,
    "baseLocation": "San Francisco, California",
    "targetDate": "2025-12-12",
    "familyContext": {
      "wife": { "name": "Joyce Zhang", "dob": "1987-02-24" },
      "children": [
        { "name": "Apollo Gray", "dob": "2021-04-26" },
        { "name": "Athena Gray", "dob": "2023-03-10" }
      ]
    },
    "filters": {
      "kidCentricAgeRange": "2-6 years",
      "strollerFriendly": true,
      "weekdayAfter5pm": true,
      "weekendAnytime": true,
      "prioritizeMissionBay": true,
      "considerWeather": true
    },
    "calendarConflictsChecked": true
  },
  "events": [
    {
      "rank": 1,
      "pickType": "TOP PICK",
      "score": 10,
      "event": {
        "title": "California Academy of Sciences - NightLife",
        "date": "2025-12-12",
        "startTime": "18:00:00",
        "endTime": "22:00:00",
        "location": {
          "name": "California Academy of Sciences",
          "address": "55 Music Concourse Drive, San Francisco, CA 94118",
          "distanceMiles": 5.2
        },
        "cost": {
          "adult": 24.95,
          "child": 19.95,
          "infantFree": true,
          "currency": "USD"
        },
        "description": "Evening exploration with live music, planetarium shows, and hands-on exhibits perfect for young families.",
        "weather": {
          "forecast": "Clear, 58°F",
          "riskLevel": "low"
        },
        "urls": {
          "eventPage": "https://www.calacademy.org/nightlife",
          "registration": "https://www.calacademy.org/tickets",
          "addToCalendar": "https://calendar.google.com/calendar/render?action=TEMPLATE&text=California+Academy+of+Sciences+-+NightLife&dates=20251212T180000/20251212T220000&details=Evening+exploration+with+live+music&location=55+Music+Concourse+Drive,+San+Francisco,+CA+94118"
        },
        "calendarConflict": false
      },
      "reasoning": "Top-rated science museum with toddler-friendly exhibits, indoor setting protects from weather, evening hours work for weekday, and located near Mission Bay for easy access."
    }
  ],
  "metadata": {
    "generatedBy": "GPT-5 Event Discovery Agent",
    "version": "1.0",
    "runtimeSeconds": 45
  }
}
```

**Required Fields**:
- `dateSearched` - ISO 8601 timestamp of when the search was performed
- `searchContext.targetDate` - The date events are for (YYYY-MM-DD format)
- `searchContext` - Object with search parameters and filters
- `events` - Array of event objects with all fields shown above
- Each event must have: `rank`, `pickType`, `score`, `event` (with all subfields), and `reasoning`

### 3. Testing the Integration

You can test the API endpoint manually with curl:

```bash
curl -X POST https://family-event-planner-backend.onrender.com/api/chatgpt-event-discoveries \
  -H "Content-Type: application/json" \
  -H "X-API-Key: chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475" \
  -d '{
    "dateSearched": "2025-11-28T09:00:00Z",
    "searchContext": {
      "targetDate": "2025-12-12",
      "baseLocation": "San Francisco, CA",
      "searchRadiusMiles": 25
    },
    "events": [
      {
        "rank": 1,
        "pickType": "TOP PICK",
        "score": 10,
        "event": {
          "title": "Test Event",
          "date": "2025-12-12",
          "startTime": "18:00:00",
          "endTime": "20:00:00",
          "location": {
            "name": "Test Venue",
            "address": "123 Test St, SF, CA",
            "distanceMiles": 5
          },
          "cost": {
            "adult": 20,
            "child": 10,
            "currency": "USD"
          },
          "description": "A test event",
          "urls": {
            "eventPage": "https://example.com",
            "addToCalendar": "https://calendar.google.com/..."
          }
        },
        "reasoning": "This is a test"
      }
    ],
    "metadata": {
      "generatedBy": "Test",
      "version": "1.0"
    }
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "Event discovery saved successfully",
  "discoveryId": 1,
  "eventsCount": 1,
  "createdAt": "2025-11-28T09:00:00.000Z"
}
```

## Using the Feature

### Accessing ChatGPT Suggestions

1. Navigate to the dashboard: `/dashboard`
2. Click on "ChatGPT Suggestions" in the top navigation (or "AI Picks" on mobile)
3. View all past discoveries in the left sidebar
4. Select a discovery to see detailed event information

### Interactive Features

For each event, you can:

- **Mark as Interested**: Click the heart icon to save events you're interested in
- **Add to Calendar**: Click "Add to Calendar" to add the event to your Google Calendar
- **Register**: Click "Register" to go to the event's registration page
- **View Details**: Click "Details" to visit the event's main webpage

### Discovery Information

Each discovery shows:

- **Top 3 Picks**: Highlighted recommendations with badges
- **Search Context**: Location, date, filters, and family information
- **Event Details**: Date, time, location, cost, description, weather forecast
- **Calendar Conflicts**: Warnings if events conflict with your calendar
- **AI Reasoning**: Explanation of why each event was recommended

## API Reference

### POST /api/chatgpt-event-discoveries

Save a new event discovery from ChatGPT.

**Authentication**: X-API-Key header required

**Rate Limit**: 5 requests per hour per IP

**Request Body**: See JSON schema above

**Response**:
```json
{
  "success": true,
  "discoveryId": 123,
  "eventsCount": 10,
  "createdAt": "2025-11-28T09:00:00Z"
}
```

### GET /api/chatgpt-event-discoveries

List all discoveries.

**Query Parameters**:
- `limit` (default: 10) - Number of discoveries to return
- `offset` (default: 0) - Pagination offset
- `targetDate` (optional) - Filter by target date (YYYY-MM-DD)

**Response**:
```json
{
  "success": true,
  "discoveries": [...],
  "pagination": {
    "total": 50,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

### GET /api/chatgpt-event-discoveries/:id

Get a single discovery by ID.

**Response**:
```json
{
  "success": true,
  "discovery": {
    "id": 1,
    "date_searched": "2025-11-28T09:00:00Z",
    "target_date": "2025-12-12",
    "search_context": {...},
    "events": [...],
    "metadata": {...},
    "interested_event_ranks": [1, 3],
    "created_at": "2025-11-28T09:00:00Z"
  }
}
```

### PATCH /api/chatgpt-event-discoveries/:id/mark-interested

Toggle interested status for an event.

**Request Body**:
```json
{
  "eventRank": 1
}
```

**Response**:
```json
{
  "success": true,
  "interestedRanks": [1, 3, 5]
}
```

## Database Schema

The feature uses the `chatgpt_event_discoveries` table:

```sql
CREATE TABLE chatgpt_event_discoveries (
  id SERIAL PRIMARY KEY,
  date_searched TIMESTAMP NOT NULL,
  target_date DATE NOT NULL,
  search_context JSONB NOT NULL,
  events JSONB NOT NULL,
  metadata JSONB,
  interested_event_ranks INTEGER[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chatgpt_discoveries_date_searched ON chatgpt_event_discoveries(date_searched);
CREATE INDEX idx_chatgpt_discoveries_target_date ON chatgpt_event_discoveries(target_date);
```

## Security

- API key authentication prevents unauthorized submissions
- Rate limiting (5 requests/hour) prevents abuse
- Input validation ensures data integrity
- JSONB storage provides SQL injection protection

## Troubleshooting

### API Key Error

If you see "Unauthorized: Invalid or missing API key":
1. Verify the API key in your `.env` file matches the one in ChatGPT
2. Ensure the header name is exactly `X-API-Key` (case-sensitive)
3. Check that the backend server has restarted after adding the env var

### Rate Limit Error

If you see "Rate limit exceeded":
- Wait 1 hour before the next request
- The limit resets on a rolling window basis
- Consider adjusting `MAX_REQUESTS_PER_WINDOW` in the code if needed

### Missing Fields Error

If you see "Missing required fields":
- Verify your JSON includes all required fields
- Check that `searchContext.targetDate` exists
- Ensure `events` is an array with at least one event

### Events Not Appearing

If events don't show up in the UI:
1. Check the backend logs for API errors
2. Verify the database connection is working
3. Try refreshing the page
4. Check browser console for frontend errors

## Future Enhancements

Potential improvements:
- Email notifications when new discoveries arrive
- Automated calendar blocking for top picks
- Integration with event registration automation
- Historical trend analysis of recommendations
- Family preference learning over time

