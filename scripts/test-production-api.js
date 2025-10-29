#!/usr/bin/env node

/**
 * Test production API endpoint for ChatGPT Event Discovery
 */

const PRODUCTION_API_URL =
  "https://family-event-planner-backend.onrender.com/api/chatgpt-event-discoveries";
const API_KEY =
  "chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475";

async function testProductionAPI() {
  console.log("🧪 Testing Production ChatGPT Event Discovery API...\n");

  try {
    // Test GET endpoint
    console.log("📡 Testing GET endpoint...");
    const getResponse = await fetch(PRODUCTION_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log("✅ GET endpoint working");
      console.log(
        `   Found ${data.discoveries?.length || 0} existing discoveries`
      );
    } else {
      console.log(`⚠️  GET endpoint returned status: ${getResponse.status}`);
      const errorText = await getResponse.text();
      console.log(`   Error: ${errorText}`);
    }

    // Test POST endpoint with sample data
    console.log("\n📡 Testing POST endpoint...");
    const sampleData = {
      dateSearched: "2025-10-29T09:00:00Z",
      searchContext: {
        searchRadiusMiles: 25,
        baseLocation: "San Francisco, California",
        targetDate: "2025-11-12",
        familyContext: {
          wife: { name: "Joyce Zhang", dob: "1987-02-24" },
          children: [
            { name: "Apollo Gray", dob: "2021-04-26" },
            { name: "Athena Gray", dob: "2023-03-10" },
          ],
        },
        filters: {
          kidCentricAgeRange: "2-6 years",
          strollerFriendly: true,
          weekdayAfter5pm: true,
          weekendAnytime: true,
          prioritizeMissionBay: true,
          considerWeather: true,
        },
        calendarConflictsChecked: true,
      },
      events: [
        {
          rank: 1,
          pickType: "TOP PICK",
          score: 10,
          event: {
            title: "Test Event - Production Verification",
            date: "2025-11-12",
            startTime: "2025-11-12T10:00:00",
            endTime: "2025-11-12T12:00:00",
            location: {
              name: "Test Venue",
              address: "123 Test St, San Francisco, CA",
              distanceMiles: 5.0,
            },
            cost: {
              adult: 20,
              child: 10,
              infantFree: true,
              currency: "USD",
            },
            description:
              "This is a test event to verify production API functionality",
            urls: {
              eventPage: "https://example.com",
              addToCalendar:
                "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Test+Event",
            },
          },
          reasoning: "Test event for production verification",
        },
      ],
      metadata: {
        generatedBy: "Production Test Script",
        version: "1.0",
        runtimeSeconds: 1,
      },
    };

    const postResponse = await fetch(PRODUCTION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(sampleData),
    });

    if (postResponse.ok) {
      const result = await postResponse.json();
      console.log("✅ POST endpoint working");
      console.log(`   Discovery ID: ${result.discoveryId}`);
      console.log(`   Events saved: ${result.eventsCount}`);
    } else {
      console.log(
        `❌ POST endpoint failed with status: ${postResponse.status}`
      );
      const errorText = await postResponse.text();
      console.log(`   Error: ${errorText}`);
    }

    console.log("\n🎉 Production API test complete!");
    console.log("\n📝 Next steps:");
    console.log(
      "1. Update your ChatGPT scheduled action with the production URL"
    );
    console.log("2. Wait for the next scheduled run (9:00 AM daily)");
    console.log("3. Check the UI at your frontend domain for new discoveries");
  } catch (error) {
    console.error("❌ API test failed:", error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Check if your backend service is running on Render.com");
    console.log("2. Verify the CHATGPT_API_KEY is set in production");
    console.log("3. Check Render.com logs for any deployment issues");
  }
}

testProductionAPI();
