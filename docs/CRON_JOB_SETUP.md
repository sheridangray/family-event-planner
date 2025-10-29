# ChatGPT Event Discovery Cron Job Setup

This guide explains how to set up and configure the automated ChatGPT event discovery cron job that runs every 5 minutes.

## 📋 Overview

The cron job automatically:
1. **Generates event discoveries** using OpenAI API
2. **Posts results** to your backend API
3. **Saves to database** for viewing in the UI

**Schedule**: Runs every 5 minutes (`*/5 * * * *`)

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install
```

This will install the `openai` package required for the cron job.

### 2. Set Environment Variables

Add these environment variables to your Render.com dashboard:

#### For the Cron Job Service

1. Go to Render.com Dashboard
2. Navigate to the `chatgpt-event-discovery` cron job service
3. Go to **Environment** tab
4. Add the following variables:

```
OPEN_AI_API_KEY=your_openai_api_key_here
CHATGPT_API_KEY=chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475
BACKEND_API_URL=https://family-event-planner-backend.onrender.com
```

**Important**: 
- Set `OPEN_AI_API_KEY` to `sync: false` (secure/secret)
- Set `CHATGPT_API_KEY` to `sync: false` (secure/secret)
- `BACKEND_API_URL` is optional (defaults to production URL)

### 3. Deploy to Render

The cron job is configured in `render.yaml` and will be automatically created when you deploy:

```yaml
- type: cron
  name: chatgpt-event-discovery
  schedule: "*/5 * * * *"
  startCommand: node scripts/chatgpt-event-discovery-cron.js
```

After pushing to GitHub, Render will:
1. Create the cron job service
2. Install dependencies
3. Run on the specified schedule

### 4. Verify Deployment

1. Go to Render.com Dashboard
2. Open the `chatgpt-event-discovery` service
3. Check **Logs** tab for execution output
4. You should see: `✅ Cron job completed successfully!`

---

## 🧪 Local Testing

### Test the Script Locally

1. **Set environment variables** in `.env`:
   ```bash
   OPEN_AI_API_KEY=your_openai_api_key_here
   CHATGPT_API_KEY=chatgpt_d34a5deb43e66c59b1a94997a641f8ec3eb2f7c6cdc6fb619d462c21961f4475
   BACKEND_API_URL=http://localhost:3000  # For local testing
   ```

2. **Run the script**:
   ```bash
   npm run chatgpt-cron
   ```

   Or directly:
   ```bash
   node scripts/chatgpt-event-discovery-cron.js
   ```

### Expected Output

```
🚀 ChatGPT Event Discovery Cron Job - 2025-10-29T12:00:00.000Z
==========================================

📝 Building discovery prompt...
   Target date: 2025-11-12

🤖 Calling OpenAI API...
   ✅ Received 3456 characters from OpenAI

📦 Parsing JSON response...
   ✅ Parsed successfully: 5 events found

📡 POSTing to backend API...

✅ Success!
   Discovery ID: 2
   Events saved: 5
   Runtime: 12.34s
   Target date: 2025-11-12

✨ Cron job completed successfully!
```

---

## 📊 How It Works

### Execution Flow

1. **Script starts** - Loads environment variables
2. **Build prompt** - Creates the event discovery prompt with target date (14 days from now)
3. **Call OpenAI** - Uses GPT-4o-mini to generate event discoveries
4. **Parse JSON** - Extracts and validates the JSON response
5. **POST to backend** - Sends results to `/api/chatgpt-event-discoveries`
6. **Log results** - Reports success/failure

### Prompt Generation

The script automatically:
- Calculates target date (14 days from today)
- Includes family context (Apollo, Athena, Joyce)
- Applies all filters (ages 2-6, stroller-friendly, etc.)
- Requests JSON format

### JSON Validation

The script validates:
- Required fields: `dateSearched`, `searchContext`, `events`
- Event structure with all sub-fields
- Date formats (ISO 8601)

---

## 🔧 Configuration

### Cron Schedule

Current schedule: **Every 5 minutes** (`*/5 * * * *`)

To change the frequency, update `render.yaml`:

```yaml
schedule: "*/5 * * * *"  # Every 5 minutes
schedule: "0 * * * *"    # Every hour
schedule: "0 9 * * *"    # Daily at 9:00 AM
schedule: "0 */2 * * *"  # Every 2 hours
```

### OpenAI Model

The script uses `gpt-4o-mini` by default for cost efficiency. To upgrade:

Edit `scripts/chatgpt-event-discovery-cron.js`:
```javascript
model: "gpt-4o-mini",  // Current
model: "gpt-4o",       // More powerful (higher cost)
```

### Target Date Calculation

Events are searched for **14 days from today**. To change:

Edit `scripts/chatgpt-event-discovery-cron.js`:
```javascript
function getTargetDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);  // Change this number
  return date.toISOString().split("T")[0];
}
```

---

## 📝 Monitoring

### Render Logs

View execution logs in Render.com:
1. Go to `chatgpt-event-discovery` service
2. Click **Logs** tab
3. See real-time execution output

### Successful Run Indicators

✅ `✅ Cron job completed successfully!`
✅ `Discovery ID: X`
✅ `Events saved: N`

### Error Indicators

❌ `❌ Error: ...`
❌ `❌ Cron job failed!`

### Common Issues

#### OpenAI API Key Missing
```
❌ ERROR: OPEN_AI_API_KEY environment variable is required
```
**Solution**: Add `OPEN_AI_API_KEY` to Render environment variables

#### Backend API Error
```
❌ Backend API error: 401 - Unauthorized
```
**Solution**: Verify `CHATGPT_API_KEY` is set correctly

#### JSON Parse Error
```
❌ Failed to parse JSON: ...
```
**Solution**: Check OpenAI response format, may need to adjust prompt

---

## 🛠️ Troubleshooting

### Cron Job Not Running

1. **Check Render deployment**: Ensure service is deployed
2. **Verify schedule**: Check `render.yaml` schedule syntax
3. **Check logs**: Look for startup errors in Render logs

### API Failures

1. **Test locally first**: Run `npm run chatgpt-cron` locally
2. **Check environment variables**: Verify all keys are set
3. **Verify backend**: Ensure backend API is running and accessible
4. **Check rate limits**: OpenAI has rate limits; wait and retry

### Rate Limiting

The backend API has rate limiting (5 requests/hour per IP). The cron runs every 5 minutes (12 times/hour), so:
- ✅ Multiple cron jobs can share the limit
- ⚠️ If you have multiple cron instances, you may hit limits
- 📊 Consider reducing frequency if needed

---

## 📈 Costs

### OpenAI API Costs

**Model**: `gpt-4o-mini`
- **Cost**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Estimated per run**: ~$0.01-0.02
- **Per day** (288 runs): ~$2.88-5.76
- **Per month**: ~$86-173

**To reduce costs**:
1. Reduce frequency (every 15 minutes instead of 5)
2. Use smaller model (`gpt-4o-mini` is already selected)
3. Limit max tokens in response

### Render Cron Job Costs

- **Free tier**: 750 hours/month
- **Cron runs**: 288 times/day × 30 days = 8,640 runs/month
- **Estimated runtime**: ~15 seconds per run
- **Total time**: ~36 hours/month (well under free tier)

---

## 🔐 Security

### Environment Variables

All sensitive keys are marked `sync: false` in `render.yaml`:
- `OPEN_AI_API_KEY`: Secret
- `CHATGPT_API_KEY`: Secret

### API Authentication

The script authenticates with backend using:
- **Header**: `X-API-Key: <CHATGPT_API_KEY>`
- **Validated**: Backend middleware checks this key

---

## 📚 Files

- **Script**: `scripts/chatgpt-event-discovery-cron.js`
- **Config**: `render.yaml` (cron service configuration)
- **Package**: `package.json` (openai dependency)
- **Docs**: `docs/CRON_JOB_SETUP.md` (this file)

---

## ✅ Deployment Checklist

- [ ] `openai` package added to `package.json`
- [ ] `render.yaml` updated with cron job service
- [ ] `OPEN_AI_API_KEY` added to Render environment
- [ ] `CHATGPT_API_KEY` added to Render environment
- [ ] Tested locally with `npm run chatgpt-cron`
- [ ] Pushed to GitHub (triggers Render deployment)
- [ ] Verified cron job appears in Render dashboard
- [ ] Checked logs for successful execution
- [ ] Verified discoveries appear in UI

---

## 🎉 Success!

Once deployed, the cron job will:
- ✅ Run automatically every 5 minutes
- ✅ Generate fresh event discoveries
- ✅ Save to your database
- ✅ Appear in your UI at `/dashboard/chatgpt-suggestions`

You can view all discoveries at: `https://sheridangray.com/dashboard/chatgpt-suggestions`

Happy automated event discovering! 🎈

