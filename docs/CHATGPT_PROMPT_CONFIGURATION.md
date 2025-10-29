# ChatGPT Prompt Configuration for Event Discovery

## Updated Prompt for Production

Replace your existing ChatGPT scheduled action prompt with this updated version:

---

## Full ChatGPT Prompt

```
Search for fully kid-centric, family-friendly events within 25 miles of San Francisco, California, that occur 14 days from today. Apply the following filters:
- Events must be specifically kid-focused (ages ~2–6 welcome) with stroller-friendly or toddler-appropriate setup.
- Weekday events must start after 5:00 PM; weekend events may be any time.
- Consider forecasted weather for outdoor events.
- Check my Google Calendar for conflicts on that date and exclude/flag any conflicting time slots.
- Rank all events 1–10 by relevance and quality.
- Highlight the Top 3 recommendations with detailed reasoning.
- For each event, include a Google Calendar add link using the standard action=TEMPLATE URL with title, dates (local), and details.
- If registration is available, include the registration URL.
- Return the result as a JSON with the following structure:

{
  "dateSearched": <DATE_SEARCHED>,
  "searchContext": {
    "searchRadiusMiles": <SEARCH_MILE_RADIUS>,
    "baseLocation": <BASE_LOCATION>,
    "targetDate": <TARGET_DATE>,
    "familyContext": {
      "wife": { "name": <WIFE_NAME>, "dob": <WIFE_DOB> },
      "children": [
        { "name": <CHILD_1_NAME>, "dob": <CHILD_1_DOB> },
        { "name": <CHILD_2_NAME>, "dob": <CHILD_2_NAME> }
      ]
    },
    "filters": {
      "kidCentricAgeRange": <KID_CENTRIC_AGE_RANGE>,
      "strollerFriendly": <STROLLER_FRIENDLY>,
      "weekdayAfter5pm": <WEEKDAY_AFTER_5PM>,
      "weekendAnytime": <WEEKEND_ANYTIME>,
      "prioritizeMissionBay": <PRIORITIZE_MISSION_BAY>,
      "considerWeather": <CONSIDER_WEATHER>
    },
    "calendarConflictsChecked": <CALENDAR_CONFLICTS_CHECKED>
  },
  "events": [
    {
      "rank": <RANK>,
      "pickType": <PICK_TYPE>,
      "score": <SCORE>,
      "event": {
        "title": <EVENT_TITLE>,
        "date": <EVENT_DATE>,
        "startTime": <EVENT_START_TIME>,
        "endTime": <EVENT_END_TIME>,
        "location": {
          "name": <EVENT_LOCATION_NAME>,
          "address": <EVENT_LOCATION_ADDRESS>,
          "distanceMiles": <EVENT_DISTANCE_MILES>
        },
        "cost": {
          "adult": <ADULT_COST>,
          "child": <CHILD_COST>,
          "infantFree": <INFANT_FREE>,
          "currency": <CURRENCY>
        },
        "description": <DESCRIPTION>,
        "weather": {
          "forecast": <WEATHER_FORECAST>,
          "riskLevel": <WEATHER_RISK_LEVEL>
        },
        "urls": {
          "eventPage": <EVENT_PAGE>,
          "registration": <REGISTRATION_LINK>,
          "addToCalendar": <GOOGLE_CALENDAR_LINK>
        },
        "calendarConflict": <CALENDAR_CONFLICT>
      },
      "reasoning": <REASONING>
    }
  ],
  "metadata": {
    "generatedBy": "GPT-5 Event Discovery Agent",
    "version": "1.0",
    "runtimeSeconds": <RUNTIME_SECONDS>
  }
}

Family Context:
- Wife: Joyce Zhang (born 02/24/1987)
- Child 1: Apollo Gray (born 04/26/2021)
- Child 2: Athena Gray (born 03/10/2023)

IMPORTANT: After generating the JSON response, make an HTTP POST request to save the results:

URL: https://family-event-planner-backend.onrender.com/api/chatgpt-event-discoveries
Method: POST
Headers:
  Content-Type: application/json
  X-API-Key: chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475

Body: Send the complete JSON response as the request body.

If the API request fails, log the error but continue with the normal response output.
```

---

## Configuration Steps

### 1. Update Your ChatGPT Scheduled Action

1. Go to your ChatGPT scheduled action settings
2. Replace the entire prompt with the text above
3. Set the schedule to run daily at 9:00 AM
4. Ensure the action is enabled

### 2. Verify API Key

The API key in the prompt is:
```
chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475
```

Make sure this matches the `CHATGPT_API_KEY` in your production environment variables.

### 3. Test the Integration

You can test the integration manually by running:

```bash
# Test the production API
curl -X POST https://family-event-planner-backend.onrender.com/api/chatgpt-event-discoveries \
  -H "Content-Type: application/json" \
  -H "X-API-Key: chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475" \
  -d @docs/test-discovery-sample.json
```

### 4. Monitor Results

After the scheduled action runs:

1. Check your backend logs for incoming requests
2. Visit `https://your-frontend-domain.com/dashboard/chatgpt-suggestions`
3. Verify the discoveries appear in the UI

---

## Troubleshooting

### Common Issues

1. **API Key Mismatch**: Ensure the key in the prompt matches your production environment
2. **Rate Limiting**: The API allows 5 requests per hour per IP
3. **JSON Format**: Ensure the JSON structure matches exactly
4. **Network Issues**: ChatGPT may have connectivity issues - the prompt includes error handling

### Monitoring

- Check backend logs: `https://dashboard.render.com` → Your backend service → Logs
- Monitor API usage in your application logs
- Check the frontend for new discoveries

---

## Expected Behavior

- **Daily at 9:00 AM**: ChatGPT runs the search
- **Immediate**: Results are posted to your API
- **Real-time**: You can view results in the UI
- **Interactive**: Mark events as interested, add to calendar, etc.

The system will automatically store all discoveries with full history, allowing you to review past suggestions and track your preferences over time.
