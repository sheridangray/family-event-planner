# Bay Area Family Event Planner

**Modern automated system for discovering family-friendly events in the San Francisco Bay Area, with intelligent filtering, email approval workflow, automated registration, and calendar integration.**

![System Architecture](https://img.shields.io/badge/Architecture-Microservices-blue) ![Node.js](https://img.shields.io/badge/Node.js-20+-green) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 🏗️ System Architecture

```
Family Event Planner
├── 🔧 Backend (Node.js + Express)
│   ├── Event Discovery Engine (10 scrapers)
│   ├── Smart Filtering & Scoring System  
│   ├── Email Notification Service (OAuth)
│   ├── Calendar Integration (Google Calendar)
│   ├── Automated Registration (FREE events only)
│   └── Safety & Payment Guards
│
├── 🎨 Frontend (Next.js + TypeScript)
│   ├── Mobile-first Responsive Design
│   ├── Real-time Dashboard & Analytics
│   ├── Event Management Interface
│   ├── Calendar Views & Settings
│   └── Google OAuth Authentication
│
└── 🗄️ Infrastructure
    ├── PostgreSQL Database (Render)
    ├── File Storage & Logging
    ├── Webhook Integrations (Gmail)
    └── Background Job Scheduler
```

## 🚀 Key Features

### 🔍 **Intelligent Event Discovery**
- **10 Active Event Sources**: SF Rec & Parks, Exploratorium, Cal Academy, Chase Center, SF Library, FunCheapSF, Bay Area Kid Fun, and more
- **Smart Age Filtering**: AI-powered age appropriateness detection (2-4 years)
- **Schedule Compatibility**: Weekday evenings (4:30 PM+), weekends with nap time awareness
- **Location Intelligence**: 30-mile radius with travel time calculation
- **Deduplication**: Advanced event matching across sources

### 📊 **Advanced Scoring System**
- **Novelty Score (35%)**: Prioritizes new venues and unique experiences
- **Urgency Score (25%)**: Registration deadlines, limited capacity detection
- **Social Proof (20%)**: Instagram mentions, Google reviews, influencer content
- **Family Match (15%)**: Age range compatibility, activity preferences
- **Cost Efficiency (5%)**: Preference for free events, budget optimization

### 📧 **Email-First Approval Workflow**
- **Smart Recipient Routing**: Joyce (production) / Sheridan (development)
- **Rich Event Details**: Venue info, ratings, cost, age ranges, special notes
- **One-Click Responses**: Reply "YES" or "NO" to approve/reject events
- **Calendar Integration**: OAuth-based event creation on primary calendar
- **No Spam Confirmation**: Silent processing, no unnecessary reply emails

### 🤖 **Automated Registration (FREE Events Only)**
- **Payment Safety**: Multiple layers prevent any payment processing
- **Form Automation**: Intelligent field detection and family data filling  
- **Screenshot Verification**: Visual confirmation of all registrations
- **Venue-Specific Adapters**: Custom logic for major venues (10 adapters)
- **Error Recovery**: Graceful fallback to manual registration links

### 🗓️ **Calendar & Scheduling**
- **Google Calendar Integration**: OAuth-based event creation with attendees
- **Conflict Detection**: Automatic calendar checking for both parents
- **Smart Reminders**: 1 week, 1 day, 2 hours before events
- **Travel Buffers**: 30-minute arrival buffers for all events
- **Family Coordination**: Shared calendar visibility

## 🎯 **User Experience**

### 📱 **Mobile-First Dashboard**
- **Real-time Analytics**: Event discovery metrics, approval rates, attendance tracking
- **Event Management**: Browse, filter, approve/reject discovered events
- **Calendar Views**: Monthly calendar with event details and status
- **Settings Control**: Family profiles, preferences, notification settings
- **System Monitoring**: Scraper health, automation status, system alerts

### 🔐 **Secure Family Access**
- **Google OAuth**: Secure authentication for family members only
- **Role-Based Access**: Joyce and Sheridan have full system access
- **Session Management**: Secure token handling with NextAuth.js
- **HTTPS Everywhere**: End-to-end encryption for all communications

## 🛡️ **Safety & Security**

### 💰 **Payment Protection (Critical)**
- **Zero Payment Processing**: System never handles payment information
- **Multi-Layer Detection**: Page scanning, field validation, keyword blocking
- **Emergency Shutdown**: Automatic system halt if payment fields detected
- **Audit Logging**: All safety violations logged with screenshots
- **Manual Override**: Paid events require explicit manual payment

### 🚨 **Error Handling & Monitoring**
- **Graceful Degradation**: Fallback mechanisms for all critical operations
- **Health Monitoring**: Continuous system health checks and alerting
- **Error Classification**: Critical/High/Medium/Low severity levels
- **Retry Logic**: Exponential backoff for transient failures
- **Data Backup**: Automated database backups and recovery

## 🏗️ **Technical Stack**

### Backend (`/src/`)
```javascript
// Core Services
├── Event Discovery Engine (src/scrapers/)
│   ├── 10 venue-specific scrapers
│   ├── Intelligent deduplication 
│   └── Real-time health monitoring
│
├── Smart Processing Pipeline (src/filters/, src/scoring/)
│   ├── Age-appropriate filtering
│   ├── Schedule compatibility
│   ├── Advanced scoring algorithms
│   └── Preference learning
│
├── Communication Services (src/mcp/)
│   ├── Gmail OAuth integration
│   ├── Email notification system
│   └── Webhook processing
│
├── Automation Engine (src/automation/)
│   ├── 10 venue-specific adapters
│   ├── Form filling automation
│   ├── Payment safety guards
│   └── Screenshot verification
│
└── Infrastructure (src/services/, src/safety/)
    ├── PostgreSQL database layer
    ├── Calendar management
    ├── Error handling & logging
    └── Background job scheduler
```

### Frontend (`/frontend/src/`)
```typescript
// Modern React Architecture
├── Pages & Routing (app/)
│   ├── Dashboard with real-time updates
│   ├── Event management interface
│   ├── Calendar views & scheduling
│   ├── Analytics & reporting
│   └── Settings & preferences
│
├── Component Library (components/)
│   ├── Responsive mobile-first design
│   ├── Real-time data visualization
│   ├── Interactive event cards
│   ├── Calendar widgets
│   └── Form controls & settings
│
├── State Management (lib/)
│   ├── TanStack Query for server state
│   ├── Zustand for client state
│   ├── API client with error handling
│   └── Type-safe interfaces
│
└── Infrastructure
    ├── NextAuth.js authentication
    ├── Tailwind CSS styling
    ├── TypeScript everywhere
    └── Turbopack for fast builds
```

## 📊 **Event Sources & Coverage**

| Source | Status | Events/Week | Coverage |
|--------|--------|-------------|----------|
| **SF Recreation & Parks** | ✅ Active | 15-25 | Sports, Arts, Family Programs |
| **Exploratorium** | ✅ Active | 5-8 | Science, Interactive Learning |
| **California Academy of Sciences** | ✅ Active | 3-5 | Nature, Planetarium, Aquarium |
| **Chase Center** | ✅ Active | 2-4 | Sports, Concerts, Family Shows |
| **SF Public Library** | ✅ Active | 10-15 | Story Time, Educational Programs |
| **FunCheapSF** | ✅ Active | 20-30 | Free Events, Festivals, Markets |
| **Bay Area Kid Fun** | ✅ Active | 8-12 | Family Activities, Seasonal Events |
| **Kids Out and About SF** | ✅ Active | 6-10 | Classes, Workshops, Playgroups |
| **Yerba Buena Gardens Festival** | ✅ Active | 2-5 | Cultural Events, Performances |
| **Community Events** | ✅ Active | 5-8 | Local Festivals, Neighborhood Events |

**Total Discovery**: 70-120 events/week → 8-20 curated suggestions → 2-6 bookings/week

## 🚀 **Quick Start**

### Prerequisites
- **Node.js 20+** with npm
- **PostgreSQL 16** database
- **Google Cloud Project** with Calendar & Gmail APIs
- **MCP Credentials** for Gmail integration

### 🔧 **Backend Setup**
```bash
# Clone and install dependencies
git clone <repository>
cd family-event-planner
npm install

# Start PostgreSQL (Docker)
docker-compose up -d postgres

# Environment configuration
cp .env.example .env
# Edit .env with your settings (see Configuration section)

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### 🎨 **Frontend Setup**
```bash
# Navigate to frontend directory
cd frontend
npm install

# Start development server (runs on port 3002)
npm run dev
```

### 🌐 **Production Deployment (Render)**
Both backend and frontend auto-deploy from the `main` branch:
- **Backend**: https://family-event-planner-backend.onrender.com
- **Frontend**: https://family-event-planner-frontend.onrender.com

## ⚙️ **Configuration**

### Environment Variables (`.env`)
```bash
# 👥 Family Configuration
PARENT1_EMAIL=joyce.yan.zhang@gmail.com
PARENT2_EMAIL=sheridan.gray@gmail.com
PARENT1_NAME=Joyce Zhang
PARENT2_NAME=Sheridan Gray
CHILD1_NAME=Apollo Gray
CHILD1_AGE=4
CHILD2_NAME=Athena Gray  
CHILD2_AGE=2

# 🔐 Google OAuth & APIs
MCP_GMAIL_CREDENTIALS_JSON={"installed":{...}}
GOOGLE_OAUTH_TOKEN={"access_token":"..."}
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# 📍 Location & Scheduling
HOME_ADDRESS=San Francisco, CA
MAX_DISTANCE_MILES=30
WEEKDAY_EARLIEST_TIME=16:30
WEEKEND_EARLIEST_TIME=08:00
WEEKEND_NAP_START=12:00
WEEKEND_NAP_END=14:00

# 🎯 Event Preferences  
MIN_CHILD_AGE=2
MAX_CHILD_AGE=4
MAX_COST_PER_EVENT=200
MIN_ADVANCE_DAYS=2
MAX_ADVANCE_MONTHS=6

# 🔍 Discovery Settings
EVENTS_PER_WEEK_MIN=8
EVENTS_PER_WEEK_MAX=20
EVENTS_PER_DAY_MAX=3
SCAN_FREQUENCY_HOURS=6

# 🗄️ Database
DATABASE_URL=postgresql://user:pass@localhost:5432/family_event_planner

# 🔑 API Keys
TOGETHER_AI_API_KEY=your_llm_api_key
WEATHER_API_KEY=your_weather_key
API_KEY=your_secure_api_key
```

## 🔄 **Automated Workflows**

### 📅 **Scheduled Tasks**
- **Every 6 hours**: Event discovery and scraping across all sources
- **Every 30 minutes**: Process approved events for automated registration
- **Every 4 hours**: Check approval timeouts, send reminder notifications
- **Daily 9:00 AM**: Scoring and ranking of newly discovered events
- **Daily 6:00 PM**: Generate comprehensive daily reports
- **Every 15 minutes**: System health monitoring and error detection

### 📧 **Email Workflow**
```
1. 🔍 Event Discovery → Intelligent filtering → Smart scoring
2. 📧 Email to Joyce/Sheridan: "New Family Event: Story Time (FREE)"
3. 📱 Reply: "YES" → ✅ Automatic calendar event creation
4. 🤖 FREE events → Automated registration with safety checks
5. 📅 Calendar updates with reminders and family coordination
```

## 🔌 **API Reference**

### System Health & Monitoring
```bash
GET  /health                          # System status and metrics
GET  /api/automation/status           # Automation engine status  
GET  /api/automation/health           # Component health checks
GET  /api/automation/scraper-runs     # Recent scraper execution logs
```

### Event Management
```bash
GET  /api/events                      # List events with filtering
POST /api/events/:id/approve          # Approve event for booking
POST /api/events/:id/reject           # Reject event suggestion
GET  /api/events/:id/details          # Get detailed event information
```

### Manual Operations
```bash
POST /api/automation/discover         # Trigger manual event discovery
POST /api/automation/scrape          # Run specific scraper
POST /api/automation/process          # Process pending approvals
```

### Dashboard Data
```bash
GET  /api/dashboard/stats             # Real-time dashboard statistics
GET  /api/dashboard/events            # Recent events and activity
GET  /api/dashboard/analytics         # Performance metrics and trends
```

## 📊 **Performance Metrics**

### 🎯 **Success Criteria**
- ✅ **8-20 relevant events suggested per week**
- ✅ **2-6 week advance notice for 80% of events**
- ✅ **< 5 minutes registration time for high-demand events**
- ✅ **90%+ novel events (not previously attended)**
- ✅ **80%+ approval rate on suggestions** 
- ✅ **95%+ successful auto-registration for FREE events**
- ✅ **Zero payment safety violations**

### 📈 **Key Performance Indicators**
- **Discovery Rate**: 70-120 raw events → 8-20 suggestions weekly
- **Approval Conversion**: 80% of suggestions get approved
- **Booking Success**: 95% of approved FREE events get registered
- **Calendar Accuracy**: 100% calendar events created for approvals
- **System Uptime**: 99.5% availability target
- **Safety Record**: 0 payment violations (critical)

## 🧪 **Testing & Quality Assurance**

### Test Coverage
```bash
# Unit Tests
npm run test:unit              # Core logic and utilities

# Integration Tests  
npm run test:integration       # API endpoints and workflows

# Error Scenario Tests
npm run test:errors           # Safety and failure conditions

# Full Test Suite
npm run test:coverage         # Generate coverage report
```

### Manual Testing Workflows
```bash
# Test event discovery
curl -X POST /api/automation/discover

# Test specific scraper
curl -X POST /api/automation/scrape \
  -H "Content-Type: application/json" \
  -d '{"source": "SF Recreation & Parks"}'

# Test email workflow  
# (Reply to actual event notification email)

# Test calendar integration
# (Check Google Calendar after approval)
```

## 🚨 **Emergency Procedures**

### Payment Safety Violations
```
1. 🚨 System automatically halts all automation
2. 📸 Screenshots captured of the issue  
3. 📝 Detailed logs written to error tracking
4. 🔔 Alert sent to error monitoring system
5. 🛠️ Manual intervention required to resume
```

### System Health Issues
```
Critical Errors    → Automatic service restart + alerts
High Error Rates   → Degraded mode operation  
Database Issues    → Emergency backup + read-only mode
External API Fails → Graceful fallback to manual processes
```

## 🔒 **Security & Privacy**

### Data Protection
- **No Payment Data**: Zero credit card or banking information stored
- **Encrypted Credentials**: All API keys and tokens securely encrypted
- **HTTPS Everywhere**: End-to-end encryption for all communications
- **Minimal Data Collection**: Only necessary family and preference data
- **Regular Backups**: Automated database backups with encryption

### Access Control
- **Family-Only Access**: Restricted to Joyce and Sheridan email addresses
- **OAuth Authentication**: Google-based secure login system
- **Session Management**: Secure JWT tokens with expiration
- **API Key Protection**: Rate limiting and request validation
- **Audit Logging**: All actions logged for security review

## 🆘 **Troubleshooting**

### Common Issues

**📧 Emails Not Sending**
```bash
# Check OAuth token status
GET /health

# Verify Gmail API credentials
# Review logs: logs/combined.log
```

**🔍 Scraping Failures**
```bash
# Test individual scrapers
POST /api/automation/scrape {"source": "Exploratorium"}

# Check scraper health
GET /api/automation/health
```

**🤖 Registration Failures**
```bash
# Review automation logs
GET /api/automation/status

# Check screenshots: logs/screenshots/
# Review error details in logs/errors.json
```

**📅 Calendar Issues**
```bash
# Test OAuth token refresh
# Verify Google Calendar API access
# Check calendar sharing permissions
```

### Support Resources
- **System Logs**: `logs/combined.log` for all activities
- **Error Tracking**: `logs/errors.json` for structured error data  
- **Health Dashboard**: `GET /health` for real-time system status
- **Performance Metrics**: Frontend dashboard for detailed analytics

## 🛠️ **Development**

### Adding New Event Sources
1. Create scraper class extending `BaseScraper` in `src/scrapers/`
2. Implement required methods: `scrapeEvents()`, `parseEventData()`
3. Add registration adapter in `src/automation/adapters/`
4. Update scraper registry in `src/scrapers/index.js`
5. Add comprehensive tests and error handling

### Extending Frontend Features
1. Create React components in `frontend/src/components/`
2. Add new pages in `frontend/src/app/`
3. Update API client in `frontend/src/lib/api.ts`
4. Follow TypeScript best practices and responsive design
5. Test across mobile and desktop breakpoints

### Safety-First Development
- **Never bypass payment guards** - all changes must maintain safety
- **Comprehensive error handling** - graceful degradation required
- **Audit logging** - log all significant system actions
- **Test safety scenarios** - verify payment protection works
- **Code review required** - all changes reviewed for safety

## 📈 **Roadmap & Future Enhancements**

### Short Term (Next 3 months)
- [ ] **Enhanced Mobile Experience**: Native mobile app with push notifications
- [ ] **Smart Recommendations**: ML-powered personalization based on attendance history
- [ ] **Event Reminders**: SMS/push notifications 1 hour before events
- [ ] **Weather Integration**: Automatic event suggestions based on weather forecasts
- [ ] **Social Features**: Share events with other Bay Area families

### Medium Term (3-6 months)  
- [ ] **Multi-City Support**: Expand beyond Bay Area to other family-friendly cities
- [ ] **Advanced Calendar Intelligence**: Optimize scheduling based on travel time and preferences
- [ ] **Venue Partnerships**: Direct integration with major venues for priority access
- [ ] **Cost Optimization**: Budget tracking and cost-per-event analytics
- [ ] **Event Reviews**: Family feedback system for event quality

### Long Term (6+ months)
- [ ] **AI Event Creation**: Generate custom events based on family interests
- [ ] **Community Platform**: Connect with other families for group events
- [ ] **Virtual Events**: Integration with online family activities and classes
- [ ] **Travel Events**: Weekend getaways and vacation planning
- [ ] **Educational Tracking**: Monitor children's learning and development through events

## 📄 **License & Usage**

This project is designed for **personal/family use**. The system includes comprehensive safety measures and is specifically configured for the Gray/Zhang family's event discovery needs.

**⚠️ Important**: Commercial use would require additional safety audits, payment processing compliance (PCI DSS), and legal review of automated registration capabilities.

---

**🎉 Built with ❤️ for Apollo (4) and Athena (2) by the Gray family**

*Last updated: September 2025 | System version: 2.0.0*