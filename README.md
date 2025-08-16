# Bay Area Family Event Planner

An automated system that discovers family-friendly events in the San Francisco Bay Area, checks calendar availability, sends approval requests via SMS, and handles event registration and calendar scheduling.

## 🚨 CRITICAL SAFETY FEATURES

This system includes multiple safety layers to prevent unauthorized payments:

- **Payment Guard**: Automatically detects and blocks any payment-related automation
- **Free Events Only**: Only processes events marked as free ($0 cost)
- **Manual Payment**: All paid events require explicit manual confirmation and payment
- **Safety Violations**: System logs and alerts on any payment-related detection
- **Emergency Shutdown**: Automatic shutdown if payment safety is compromised

## 🏗 Architecture

```
family-event-planner/
├── src/
│   ├── scrapers/        # Event source scrapers (SF Recreation, EventBrite, etc.)
│   ├── filters/         # Event filtering by age, schedule, location
│   ├── scoring/         # Event ranking system (novelty, urgency, social proof)
│   ├── mcp/            # MCP server integrations (Gmail, Twilio)
│   ├── automation/     # Registration automation (FREE events only)
│   ├── scheduler/      # Cron job management
│   ├── safety/         # Payment guards and error handling
│   └── api/           # REST API endpoints
├── config/            # Configuration files
├── data/             # SQLite database
└── logs/             # Application logs and screenshots
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Gmail account with API access
- Twilio account for SMS
- Valid MCP server configurations

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository>
   cd family-event-planner
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start the application:**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## ⚙️ Configuration

Create a `.env` file with the following settings:

```env
# Gmail MCP Configuration
PARENT1_EMAIL=parent1@example.com
PARENT2_EMAIL=parent2@example.com
MCP_GMAIL_CREDENTIALS=your_gmail_mcp_credentials

# Twilio MCP Configuration  
TWILIO_PHONE_TO=+15551234567
MCP_TWILIO_CREDENTIALS=your_twilio_mcp_credentials

# Location Settings
HOME_ADDRESS=San Francisco, CA
MAX_DISTANCE_MILES=30

# Schedule Settings
WEEKDAY_EARLIEST_TIME=16:30
WEEKEND_EARLIEST_TIME=08:00
WEEKEND_NAP_START=12:00
WEEKEND_NAP_END=14:00

# Event Preferences
MIN_CHILD_AGE=2
MAX_CHILD_AGE=4
MAX_COST_PER_EVENT=200
MIN_ADVANCE_WEEKS=2
MAX_ADVANCE_MONTHS=6

# Registration Info
PARENT1_NAME=Parent One
PARENT2_NAME=Parent Two
CHILD1_NAME=Child One
CHILD1_AGE=4
CHILD2_NAME=Child Two
CHILD2_AGE=2
EMERGENCY_CONTACT=+15551234567
```

## 🔄 How It Works

### 1. Event Discovery
- Scrapes multiple Bay Area event sources every 6 hours
- Filters events by age appropriateness (2-4 years old)
- Checks schedule compatibility (weekday evenings, weekends)
- Prioritizes novel venues and experiences

### 2. Event Scoring & Ranking
- **Novelty Score (35%)**: Prioritizes new venues and experiences
- **Urgency Score (25%)**: Registration opening soon, limited capacity
- **Social Score (20%)**: Instagram mentions, reviews, influencer recommendations
- **Match Score (15%)**: Age appropriateness, preferred activities
- **Cost Score (5%)**: Prefers free events, within budget

### 3. SMS Approval Workflow
- Sends 8-20 event suggestions per week
- Maximum 3 events per day
- Different message formats for FREE vs PAID events
- 24-hour response timeout (6 hours for urgent events)

#### FREE Event Message:
```
New family event found!
Story Time at Golden Gate Park ⭐ 4.8
Date: Sat, Nov 18, 10:00 AM (3 weeks away)
Location: Golden Gate Park
Cost: FREE
Ages: 2-5
✨ New venue for us!

Reply YES to book or NO to skip
```

#### PAID Event Message:
```
New family event found!
Children's Theatre Workshop ⭐ 4.6
Date: Sun, Nov 19, 2:00 PM (3 weeks away)
Location: Children's Creativity Museum
⚠️ COST: $45 - REQUIRES PAYMENT
Ages: 3-6
📸 Trending on Instagram

Reply YES to receive payment link
Reply NO to skip
```

### 4. Automated Registration (FREE Events Only)
- **CRITICAL**: Only processes events with $0 cost
- Detects and blocks any payment fields
- Fills common registration forms automatically
- Takes screenshots for confirmation
- **NEVER** handles payment information

### 5. Calendar Integration
- Checks both parents' calendars for conflicts
- Creates calendar events with:
  - 30-minute travel buffer
  - Multiple reminders (1 week, 1 day, 2 hours)
  - Event details and preparation notes
  - Registration confirmations

## 🛡️ Safety Features

### Payment Protection
- **Pre-registration validation**: Verifies event cost is $0
- **Page scanning**: Detects credit card fields, payment keywords
- **Form validation**: Blocks sensitive form fields
- **Emergency shutdown**: Automatic stop if payment detected
- **Audit logging**: All safety violations logged

### Error Handling
- **Graceful degradation**: Fallback mechanisms for all operations
- **Retry logic**: Exponential backoff for failed operations
- **Health monitoring**: Continuous system health checks
- **Error classification**: Critical/High/Medium/Low severity levels

## 🔌 API Endpoints

### System Status
```bash
GET /health
# Returns system health, error stats, uptime
```

### Event Management
```bash
GET /api/events?status=discovered
POST /api/events/:id/approve
POST /api/events/:id/reject
POST /api/events/:id/register  # FREE events only
POST /api/events/:id/calendar
```

### Manual Operations
```bash
POST /api/scrape
POST /api/score
POST /api/process-approvals
```

### Emergency Controls
```bash
POST /emergency-shutdown  # Safety override
```

## 📊 Monitoring

### Logs
- `logs/combined.log`: All application logs
- `logs/error.log`: Error logs only
- `logs/errors.json`: Structured error data
- `logs/screenshots/`: Registration screenshots

### Health Checks
- Database connectivity
- MCP server status
- Scraper functionality
- Payment guard violations
- Recent error rates

### Daily Reports
Automated daily summary at 6:00 PM:
- Events discovered, proposed, booked
- System health status
- Pending approvals
- Cost summaries
- Attention-needed items

## 🗓️ Scheduled Tasks

- **Every 6 hours**: Event discovery and scraping
- **Every 30 minutes**: Process approved events for registration
- **Every 4 hours**: Check approval timeouts, send reminders
- **Daily 9:00 AM**: Event processing and scoring
- **Daily 10:00 AM**: Calendar sync for booked events
- **Daily 6:00 PM**: Generate daily reports
- **Every 15 minutes**: System health checks

## 🚨 Emergency Procedures

### If Payment Fields Detected
1. System automatically stops registration
2. Logs safety violation
3. Takes screenshot of issue
4. Notifies via error logs
5. Manual intervention required

### System Health Issues
- **Critical errors**: Automatic alerts and potential shutdown
- **High error rates**: Degraded mode operation
- **MCP failures**: Fallback to manual processing
- **Database issues**: Emergency data backup

## 🧪 Testing

### Manual Testing (Recommended)
```bash
# Test with free events first
POST /api/scrape
GET /api/events?status=discovered
POST /api/events/:id/approve
POST /api/events/:id/register
```

### Safety Testing
- Verify payment detection works
- Test emergency shutdown
- Validate error handling
- Check violation logging

## 📈 Performance Metrics

### Success Criteria
- ✅ 8-20 relevant events suggested per week
- ✅ 2-6 week advance notice for 80% of events
- ✅ Registration within 5 minutes for high-demand events
- ✅ 90%+ novel events (not previously attended)
- ✅ 80%+ approval rate on suggestions
- ✅ 90%+ successful auto-registration for approved free events
- ✅ Zero payment safety violations

### Key Performance Indicators
- Event discovery rate
- Approval-to-booking conversion
- Calendar conflict rate
- System uptime
- Error rates by component
- Safety violation count (should be 0)

## 🔒 Security Considerations

### Data Protection
- No credit card information stored
- Personal information encrypted
- MCP credentials secured
- Access logs maintained

### Operational Security
- Rate limiting on external requests
- Input validation on all forms
- SQL injection prevention
- XSS protection on web interface

## 🆘 Troubleshooting

### Common Issues

**MCP Connection Failures**
```bash
# Check MCP credentials and connectivity
GET /health
# Review logs for specific MCP errors
```

**Scraping Issues**
```bash
# Test individual scrapers
POST /api/scrape {"source": "SF Recreation & Parks"}
```

**Registration Failures**
```bash
# Check screenshots in logs/screenshots/
# Review error logs for specific failures
```

**SMS Not Sending**
```bash
# Verify Twilio MCP configuration
# Check phone number format
```

### Support Contacts
- System logs: `logs/combined.log`
- Error tracking: `logs/errors.json`
- Health dashboard: `GET /health`
- Emergency shutdown: `POST /emergency-shutdown`

## 📝 Development

### Adding New Event Sources
1. Create scraper in `src/scrapers/`
2. Extend `BaseScraper` class
3. Add to `ScraperManager`
4. Update database schema if needed

### Extending Functionality
- Follow safety-first principles
- Add comprehensive error handling
- Include payment guard checks
- Update health monitoring

## 📄 License

This project is for personal/family use. Commercial use requires additional safety audits and payment processing compliance.

---

**⚠️ IMPORTANT**: This system is designed for family event discovery and handles NO payment processing. All paid events require manual intervention and payment completion.