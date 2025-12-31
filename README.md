# Coworkr

A voice-first AI assistant for enterprise productivity. Manage tasks, calendar, team workload, and CRM through natural conversation.

Built for the ElevenLabs + Google Cloud AI Hackathon.

---

## Project Overview

### Problem

Knowledge workers spend significant time on administrative tasks: scheduling meetings, tracking to-dos, checking team availability, and managing CRM data. These tasks require switching between multiple apps and manual data entry.

### Solution

Coworkr is a voice-first AI assistant that acts as a virtual colleague. Users speak naturally to:

- Create and assign tasks with due dates
- Schedule meetings with team members
- Check team workload and availability
- Query CRM data (deals, contacts, accounts)
- Get daily summaries of tasks and calendar

The assistant understands context, handles natural language dates ("tomorrow at 2pm", "next Friday", "end of week"), and responds with synthesized voice.

### Why This Matters

Enterprise productivity tools are moving toward conversational interfaces. Coworkr demonstrates how combining Google Gemini for intent understanding with ElevenLabs for voice synthesis creates a seamless hands-free experience for busy professionals.

---

## Key Features

| Feature | Description |
|---------|-------------|
| Voice-First Interaction | Speak naturally; get voice responses via ElevenLabs |
| Task Management | Create, assign, complete, update tasks via voice or text |
| Team Collaboration | Assign tasks to team members, check workload |
| Calendar Management | Schedule meetings, check availability, reschedule events |
| CRM Integration | View deals, contacts, accounts, pipeline summaries |
| Natural Language Dates | Understands "tomorrow", "next Monday", "noon", "end of week" |
| Real-Time Updates | WebSocket-based instant UI updates |
| Multi-User Teams | Each team member has their own tasks, events, workload |

---

## Architecture

```
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|   React Frontend  |<--->|   Next.js API     |<--->|   Firestore DB    |
|   (Next.js 14)    |     |   + Socket.io     |     |   (Google Cloud)  |
|                   |     |                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
         |                        |
         |                        v
         |               +-------------------+
         |               |                   |
         |               |   Google Gemini   |
         |               |   (Intent + NLU)  |
         |               |                   |
         |               +-------------------+
         |
         v
+-------------------+
|                   |
|   ElevenLabs      |
|   Voice Agent     |
|   (Conversational)|
|                   |
+-------------------+
```

### How Gemini is Used

- **Intent Detection**: Gemini 2.5 Flash analyzes user speech to extract structured intent (CREATE_TASK, SCHEDULE_MEETING, CHECK_AVAILABILITY, etc.)
- **Parameter Extraction**: Extracts task titles, assignee names, dates, times, priorities from natural language
- **Context Awareness**: Receives current tasks, events, and team members to make intelligent decisions

### How ElevenLabs is Used

- **Conversational Voice Agent**: ElevenLabs agent handles the voice conversation loop
- **Webhook Integration**: Agent calls our webhook (`/api/agent/webhook/smart`) with user speech
- **Natural Voice Responses**: Agent speaks responses back to users with configurable voice

### Why Google Cloud Run

- Serverless deployment with automatic scaling
- Native support for WebSockets (Socket.io)
- Easy environment variable management
- Integrated with Firestore and other Google Cloud services

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Node.js, Next.js API Routes, Socket.io |
| AI/LLM | Google Gemini 2.5 Flash (via @google/generative-ai) |
| Voice | ElevenLabs Conversational AI Agent |
| Database | Firebase Firestore (Native mode) |
| Auth | Firebase Authentication (demo mode available) |
| Hosting | Google Cloud Run |

---

## How It Works (End-to-End Flow)

```
1. USER SPEAKS
   "Schedule a meeting with Mike tomorrow at 2pm about the budget review"
                    |
                    v
2. ELEVENLABS AGENT
   Captures speech, sends transcript to webhook
                    |
                    v
3. WEBHOOK (/api/agent/webhook/smart)
   Receives: { "text": "Schedule a meeting with Mike..." }
                    |
                    v
4. GEMINI INTENT DETECTION
   Analyzes text, extracts:
   {
     "intent": "SCHEDULE_MEETING_WITH",
     "params": {
       "attendeeName": "Mike",
       "date": "tomorrow",
       "time": "2pm",
       "title": "budget review"
     }
   }
                    |
                    v
5. ACTION HANDLER
   - Parses "tomorrow" + "2pm" into Date object
   - Finds "Mike Johnson" in team members
   - Creates event in Firestore
                    |
                    v
6. RESPONSE GENERATED
   "Scheduled 'budget review' with Mike Johnson on Friday, Jan 2 at 2:00 PM."
                    |
                    v
7. ELEVENLABS SPEAKS
   Agent synthesizes and speaks the response
                    |
                    v
8. UI UPDATES (Optional)
   Socket.io pushes update to web dashboard
```

---

## Environment Variables

Create a `.env.local` file with the following variables:

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLOUD_PROJECT_ID` | Your Google Cloud project ID |
| `GOOGLE_CLOUD_REGION` | GCP region (e.g., us-central1) |
| `GOOGLE_AI_API_KEY` | Google AI API key for Gemini |
| `GEMINI_MODEL` | Model name (gemini-2.5-flash recommended) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Service account email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Service account private key (with \n for newlines) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `ELEVENLABS_AGENT_ID` | ElevenLabs conversational agent ID |
| `ELEVENLABS_VOICE_ID_MALE` | Voice ID for male voice |
| `ELEVENLABS_VOICE_ID_FEMALE` | Voice ID for female voice |
| `GOOGLE_CALENDAR_CLIENT_ID` | OAuth client ID for Calendar |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_CALENDAR_REDIRECT_URI` | OAuth redirect URI |
| `NEXT_PUBLIC_APP_URL` | Your app URL (http://localhost:3000 for dev) |
| `SESSION_SECRET` | Secret for session encryption |

---

## Running Locally (Any Machine)

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher
- A Google Cloud project with Firestore enabled
- Google AI API key (get from https://aistudio.google.com/apikey)
- ElevenLabs account with API key and Conversational AI Agent

### Setting Up ElevenLabs Agent

1. **Create an ElevenLabs account** at https://elevenlabs.io

2. **Get your API key**:
   - Go to https://elevenlabs.io/app/settings/api-keys
   - Create a new API key and save it

3. **Create a Conversational AI Agent**:
   - Go to https://elevenlabs.io/app/conversational-ai
   - Click "Create Agent"
   - Name it (e.g., "Coworkr Assistant")
   - Select a voice (e.g., "Adam" for male, "Rachel" for female)

4. **Configure the Agent**:
   - **System Prompt**: Set a friendly assistant personality
   - **First Message**: "Hello! I'm Coworkr, your AI assistant. How can I help you today?"
   - **LLM**: Select "gpt-4o-mini" or similar

5. **Set up Webhook** (for local development):
   - Install ngrok: `npm install -g ngrok`
   - Run ngrok: `ngrok http 3000`
   - Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
   - In ElevenLabs Agent settings, add a webhook:
     - URL: `https://your-ngrok-url/api/agent/webhook/smart`
     - Method: POST

6. **Get your Agent ID**:
   - In the agent settings, find the Agent ID (starts with `agent_`)
   - Add it to your `.env.local` as `ELEVENLABS_AGENT_ID`

### Install Steps

```bash
# Clone the repository
git clone https://github.com/murali-techie/coworkr-ai-assistant.git
cd coworkr-ai-assistant

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# (See Environment Variables section above)
```

### Seed Demo Data (Optional)

```bash
npm run seed
```

This creates 6 team members, sample tasks, events, deals, and contacts.

### Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Build for Production

```bash
npm run build
npm start
```

---

## Running with Docker (Recommended)

### Build Image

```bash
docker build -t coworkr .
```

### Run Container

```bash
docker run -p 8080:8080 \
  -e GOOGLE_AI_API_KEY=your_key \
  -e ELEVENLABS_API_KEY=your_key \
  -e ELEVENLABS_AGENT_ID=your_agent_id \
  -e NEXT_PUBLIC_FIREBASE_API_KEY=your_key \
  -e NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project \
  -e FIREBASE_ADMIN_CLIENT_EMAIL=your_email \
  -e FIREBASE_ADMIN_PRIVATE_KEY="your_private_key" \
  coworkr
```

Open http://localhost:8080 in your browser.

---

## Deploying to Google Cloud Run

### Prerequisites

1. Google Cloud CLI installed and authenticated
2. Docker installed
3. A Google Cloud project with these APIs enabled:
   - Cloud Run API
   - Artifact Registry API

### Deploy Commands

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/coworkr

# Deploy to Cloud Run
gcloud run deploy coworkr \
  --image gcr.io/YOUR_PROJECT_ID/coworkr \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_AI_API_KEY=xxx,ELEVENLABS_API_KEY=xxx,..."
```

### Update Environment Variables

```bash
gcloud run services update coworkr \
  --region us-central1 \
  --set-env-vars "KEY=value,KEY2=value2"
```

---

## Hackathon Compliance

### Google Cloud Usage

- **Gemini 2.5 Flash**: Primary AI for intent detection and natural language understanding
- **Firestore**: Database for users, tasks, events, deals, contacts
- **Cloud Run**: Production hosting with WebSocket support

### ElevenLabs Usage

- **Conversational AI Agent**: Voice agent with webhook integration
- **Text-to-Speech**: Natural voice responses for the web UI
- **Voice Configuration**: Customizable voice settings (stability, style)

### Open Source Compliance

- All dependencies are MIT/Apache 2.0 licensed
- No proprietary code or closed-source dependencies
- This project is MIT licensed

---

## Demo Notes for Judges

### Quick Start (2 minutes)

1. Open the app in a browser
2. Click "Try Demo Mode" to bypass login
3. Click the voice widget (bottom right) to start ElevenLabs agent

### Example Voice Commands

| Say This | What Happens |
|----------|--------------|
| "Hello" | Greeting with task/meeting summary |
| "What are my tasks?" | Lists pending tasks with priorities |
| "Create a task to review the proposal due tomorrow" | Creates task with due date |
| "Assign task to David called prepare slides due Friday" | Creates and assigns to team member |
| "Schedule meeting with Mike tomorrow at 2pm about budget" | Creates calendar event |
| "Is Sarah available?" | Shows Sarah's workload and meetings |
| "Who has the least workload?" | Shows team member with fewest tasks |
| "Mark review proposal as done" | Completes the task |
| "What deals do I have?" | Shows CRM pipeline summary |

### Features to Test

1. **Natural Language Dates**: Try "noon", "this afternoon", "end of week", "next Monday"
2. **Team Collaboration**: Assign tasks, check availability, schedule with team
3. **Voice Responses**: Agent speaks back naturally
4. **Real-Time UI**: Watch the dashboard update as you make changes

### Known Limitations

- Voice agent requires HTTPS in production (works on localhost for testing)
- ElevenLabs agent needs public webhook URL (use ngrok for local testing)
- Calendar OAuth requires redirect URI configuration

---

## Project Structure

```
coworkr/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Login/signup pages
│   │   ├── (dashboard)/          # Main dashboard layout
│   │   │   ├── tasks/            # Task management UI
│   │   │   ├── calendar/         # Calendar UI
│   │   │   ├── deals/            # CRM deals UI
│   │   │   ├── team/             # Team management UI
│   │   │   └── contacts/         # Contacts UI
│   │   └── api/                  # API routes
│   │       ├── agent/webhook/    # ElevenLabs webhook
│   │       ├── chat/             # Chat processing
│   │       ├── tasks/            # Task CRUD
│   │       ├── calendar/         # Calendar + OAuth
│   │       └── tts/              # Text-to-speech
│   ├── components/               # React components
│   ├── lib/                      # Core libraries
│   │   ├── ai/                   # Gemini integration
│   │   ├── firebase/             # Firestore client + admin
│   │   └── voice/                # ElevenLabs TTS
│   └── hooks/                    # React hooks
├── scripts/
│   └── seed-data.js              # Demo data seeder
├── public/                       # Static assets
├── server.js                     # Custom server (Socket.io)
├── Dockerfile                    # Production Docker image
└── package.json
```

---

## API Reference

### Webhook (ElevenLabs Integration)

```
POST /api/agent/webhook/smart
Content-Type: application/json

Request:
{ "text": "user's spoken message" }

Response:
{
  "success": true,
  "response": "Agent's spoken response",
  "intent": "DETECTED_INTENT",
  "data": { ... }
}
```

### Supported Intents

| Intent | Description |
|--------|-------------|
| `GET_TASKS` | List user's tasks |
| `CREATE_TASK` | Create new task |
| `COMPLETE_TASK` | Mark task as done |
| `UPDATE_TASK` | Update task details |
| `ASSIGN_TASK` | Create and assign to team member |
| `GET_EVENTS` | List calendar events |
| `CREATE_EVENT` | Schedule new event |
| `SCHEDULE_MEETING_WITH` | Schedule with team member |
| `CHECK_AVAILABILITY` | Check team member's schedule |
| `CHECK_WORKLOAD` | Compare team workloads |
| `DAILY_SUMMARY` | Overview of day |
| `GET_DEALS` | List CRM deals |
| `GREETING` | Handle hello/hi |

---

## License

MIT License. See LICENSE file.

---

## Team

Built for the ElevenLabs + Google Cloud AI Hackathon 2025.
