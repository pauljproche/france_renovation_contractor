# France Renovation Contractor Dashboard & Bot

A comprehensive web-based system for managing apartment renovation projects in France. The platform enables contractors, clients, architects, and other stakeholders to create detailed project estimates (devis) and track project execution through an intelligent LLM-powered interface.

## System Architecture Overview

The application is structured around a **two-part workflow** that mirrors the real-world renovation process:

### User Flow

```
Landing Page
    ↓
Global Dashboard (Project Selection)
    ↓
Create New Project → Creating Devis
    ↓
Complete Devis → Unlock Tracking
    ↓
Track Project Execution
```

### Core Components

1. **Landing Page** - Marketing and initial entry point
2. **Global Dashboard** ✅ **Implemented** - Central hub showing all renovation projects
   - Project cards with status indicators (Draft, Ready, Active, Completed, Archived)
   - Project metrics (total projects, completion rate, client approvals, invoices, costs)
   - Create new projects (placeholder for future devis creation)
   - Navigate between projects
   - Demo projects for testing and onboarding
   - Project lifecycle management (delete, convert demos)
   - Settings page for language, role, and theme preferences
3. **Creating Devis** - HEMEA-like interface for building detailed project estimates (Planned)
   - Add materials, sections, pricing
   - Create comprehensive devis/estimates
   - Once complete, unlocks Tracking for that project
4. **Tracking System** ✅ **Implemented** - Execution tracking and project management
   - Track materials, approvals, deliveries
   - LLM-powered AI agent with bilingual responses (English/French)
   - Agent can query data and take actions (update approvals, validate items)
   - Chat history with language-aware display
   - Real-time data updates
   - Role-based access (Contractor, Client, Architect)
   - Multi-project support with project selection

### Terminology Note

- **User-facing UI**: Uses "Creating" / "Create Devis" and "Tracking" 
- **Technical documentation**: Uses "Phase 1" (Creating Devis) and "Phase 2" (Tracking) for development planning
- **Zulip chatbot phases**: Continue to use "Phase 2.3", "Phase 2.4" etc. for chatbot feature development

### Project Structure

Each renovation project follows this lifecycle:
- **Draft**: Project created, devis in progress
- **Ready**: Devis complete, tracking unlocked
- **Active**: Tracking in progress
- **Completed**: Project finished
- **Archived**: Historical reference

At any point, users can return to the Global Dashboard to switch between projects or create new ones.

## Phase 2: Tracking System (Current Implementation)

This repository currently contains the **Phase 2: Tracking System** implementation. The tracking system enables stakeholders to monitor project execution, track materials, manage approvals, and interact with an AI agent that can both answer questions and take actions on project data.

## Phase 2: Tracking System Goals

1. **Provide instant access to project information** via natural language queries
2. **Track and manage action items** across different roles (contractor, client, architect)
3. **Centralize project data** in a tabular format accessible via web dashboard
4. **Enable fast interactions** through Zulip chatbot integration
5. **Facilitate cross-role communication** and task assignment
6. **Support multiple projects** through the global dashboard architecture

## Phase 2: Tracking System Implementation Roadmap

The tracking system is being developed in phases:

### Phase 2.1: Tracking Web Dashboard MVP
- **Dashboard landing page** with at-a-glance metrics (orders pending, spend, deliveries) and a persistent AI agent prompt card
- **Dedicated materials view** hosting the tabular dataset (`materials.json`) with filters and deep links back to the dashboard
- **Natural language query interface** allowing users to ask questions about:
  - What needs to be validated
  - What items need to be purchased
  - Pricing information
  - Timeline/scheduling
- **AI agent responses** based on the displayed tabular data
- **Agent actions** - agent can update data directly via function calls
- **Role-based access** (contractor, client, architect, etc.)

#### Phase 2.1 Tracking UI Layout
- The landing page provides quick KPIs, recent alerts, and the "Ask the agent" form so stakeholders know what's available before prompting the AI agent.
- The materials page focuses on detailed tabular data; the agent UI (AIPanel) remains accessible (drawer/modal) for context-aware queries and actions.
- Navigation between the two views should be obvious (breadcrumb or primary nav) to keep discovery simple for new users.

### Phase 2.2: Tracking Backend Data Integration
- **Backend API** to store and manage project data
- **Database integration** for persistent storage
- **AI agent access to backend data** via function calling instead of webpage scraping
- **Real-time data updates** reflected in agent responses and actions

### Phase 2.3: Tracking Zulip Chatbot Integration ✅ **Implemented**
- **Zulip bot** (`@contractor_bot`) - AI agent accessible via Zulip ✅
- **Natural language queries** via Zulip mentions ✅
- **AI agent responses** based on backend data ✅
- **Agent actions** - agent can take actions directly via chat ✅
  - "validate [item] as [role]" updates approval status
  - "approve [item] as client/cray" executes immediately
  - "reject [item] as [role]" updates status to rejected
  - Handles confirmations and extracts product identifiers correctly
- **Bilingual responses** (English and French) ✅
- **Conversation context** - agent uses recent messages for better understanding ✅
- **Action item tracking** integrated with chat context (basic implementation)

### Phase 2.4: Tracking Task Management & To-Do Lists
- **Role-based to-do lists** ("What do I need to do?")
- **Action item popups** showing:
  - Items to be ordered
  - Items to be validated
  - Actions to be taken
- **Task completion** (check off items)
- **Chat context linking** - clicking an action item navigates to the relevant chat message where the request was made
- **Cross-role task assignment** tracking

## Key Features

### Query Interface
- Ask questions in natural language about:
  - Project requirements and validations
  - Material lists and procurement
  - Cost estimates and pricing
  - Timeline and scheduling
  - Task assignments and responsibilities

### Role-Based Access
- **Contractor**: Manage work, validate requirements, track materials
- **Client**: Review progress, approve decisions, track costs
- **Architect**: Review plans, validate specifications, coordinate requirements
- **Other roles**: Project-specific permissions

### Task Management
- Generate to-do lists based on role and current project status
- Track action items with checkboxes
- Link tasks to original chat messages/requests
- Notify relevant parties of task assignments

### Data Management
- Tabular data display (Phase 2.1)
- Backend database (Phase 2.2+)
- Real-time updates
- Historical tracking

## Use Cases

### Use Case 1: Material Query
**User (Contractor)**: "What materials do I need to buy for the bathroom renovation?"
**System**: Queries data and returns list of materials with quantities, suppliers, and estimated costs.

### Use Case 2: Validation Check
**User (Architect)**: "What still needs to be validated before we can start the kitchen work?"
**System**: Returns list of pending validations, their requirements, and responsible parties.

### Use Case 3: To-Do List Generation
**User (Contractor)**: "What do I need to do?"
**System**: Shows popup with actionable items:
- [ ] Order tiles for bathroom (€450)
- [ ] Validate electrical plan with architect
- [ ] Schedule inspection for plumbing work
- [ ] Confirm delivery date with supplier

### Use Case 4: Task Completion & Context
**User**: Clicks checkbox to complete "Order tiles for bathroom"
**System**: Marks task complete and shows link to original chat message where tiles were discussed.

### Use Case 5: Zulip Integration - Query
**User**: `@contractor_bot What items need to be validated by the client?`
**Bot**: Responds with formatted list of items requiring validation, organized by section.

### Use Case 6: Zulip Integration - Validation Action
**User**: `@contractor_bot can you validate the cathat item in the cuisine as a client?`
**Bot**: Updates `approvals.client.status` to "approved" and confirms the update.

### Use Case 7: Zulip Integration - Rejection
**User**: `@contractor_bot reject the cathat item as client`
**Bot**: Updates `approvals.client.status` to "rejected" and confirms the update.

## Technical Requirements

### Frontend
- Web dashboard with clean, intuitive UI
- Tabular data display component
- Natural language input interface
- Task/to-do list popup component
- Role-based UI customization

### Backend
- API for data management
- Database schema for projects, tasks, materials, validations
- LLM integration (OpenAI, Claude, or local LLM)
- Role-based access control
- Real-time data synchronization

### AI Agent Integration
- Natural language understanding for queries
- Function calling capabilities (update_cell tool for data modifications)
- Context-aware responses based on project data
- Autonomous action-taking (validation updates, status changes)
- Role-specific response formatting
- Task extraction and parsing

### Zulip Integration ✅ **Implemented**
- Bot account setup ✅
- Message parsing and command handling ✅
- AI agent query processing ✅
- Agent action execution via function calls ✅
- Response formatting for chat context ✅
  - Clean markdown formatting
  - HTML tag removal
  - Proper line breaks for lists and sections
  - Bilingual responses (EN/FR)
- Action item detection and tracking ✅ (basic)
- **Agent validation actions** ✅
  - Approve/reject items via natural language
  - Updates materials table directly via update_cell function
  - Handles product identifier extraction correctly
  - Conversation context awareness
  - Data reloading on each query for latest information

### Data Structure
- Project information
- Material lists with suppliers and prices
- Validation requirements and status
- Timeline and scheduling
- Task assignments and status
- Role permissions and access

## Creating Devis (Future Implementation - Phase 1)

The Creating Devis interface will provide a HEMEA-like experience for building detailed renovation project estimates:

- **Project setup** - Create new renovation projects from global dashboard
- **Section management** - Organize work by rooms/areas (kitchen, bathroom, etc.)
- **Material catalog** - Add materials with references, suppliers, pricing
- **Cost calculation** - Automatic TTC calculations, totals, budgets
- **Devis generation** - Export professional estimates
- **Multi-project support** - Manage multiple renovation projects simultaneously

Once a devis is marked complete, Tracking becomes available for that project.

## Future Enhancements

### Phase 2 Enhancements
- **Multi-language support** (French/English) ✅ **Fully implemented**
  - UI language toggle (English/French)
  - LLM generates bilingual responses (English and French)
  - Chat history displays in selected language
  - Language preference persists across sessions
- **Document upload and parsing** (plans, invoices, permits)
- **Image recognition** for progress tracking
- **Automated notifications** for deadlines and pending tasks
- **Reporting and analytics** dashboard
- **Mobile app** for on-site access
- **Integration with French construction standards** and regulations
- **Cost tracking and budget management**
- **Supplier management** and ordering automation

### System-Wide Enhancements
- **Theme customization** ✅ **Implemented** (Purple/Blue themes)
- **Project lifecycle management** ✅ **Implemented** (status indicators, project cards, metrics)
- **Settings page** ✅ **Implemented** (language, role, theme preferences)
- **Project templates** for common renovation types
- **Team collaboration** features across projects
- **Client portal** for approvals and updates
- **Export/import** functionality for project data

## Project Structure

```
france_renovation_contractor/
├── README.md                 # This file
├── frontend/                 # React app (currently Phase 2: Tracking)
│   ├── src/
│   │   ├── pages/           # Page components (Dashboard, Materials, etc.)
│   │   ├── components/       # UI components
│   │   └── ...
├── backend/                 # FastAPI backend (Phase 2: Tracking API)
│   ├── prompts/             # System prompts for LLM assistant
│   │   ├── system_prompt.md # Main system prompt (isolated for easy editing)
│   │   └── README.md        # Prompts documentation
│   └── zulip_bot/           # Zulip chatbot integration (Phase 2.3) ✅
├── data/                    # Sample data and schemas
│   ├── materials.json       # Current tracking data structure
│   └── edit-history.json    # Edit history tracking
└── docs/                    # Additional documentation

# Current structure (Phase 2):
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── GlobalDashboard.jsx    ✅ Implemented: Project selection & management
│   │   │   ├── Dashboard.jsx           ✅ Tracking dashboard
│   │   │   ├── Materials.jsx           ✅ Materials tracking
│   │   │   ├── ChatHistory.jsx        ✅ Chat history
│   │   │   ├── Settings.jsx            ✅ Settings page
│   │   │   ├── Login.jsx               ✅ Authentication
│   │   │   └── Landing.jsx             ✅ Landing page
│   │   ├── components/
│   │   │   ├── AIPanel.jsx             ✅ AI agent interface panel
│   │   │   ├── ProjectCard.jsx        ✅ Project card component
│   │   │   ├── Layout.jsx              ✅ Main layout with sidebar
│   │   │   └── ...
│   │   ├── contexts/
│   │   │   ├── ProjectsContext.jsx      ✅ Project state management
│   │   │   ├── ChatHistoryContext.jsx ✅ Chat history state
│   │   │   └── AppContext.jsx          ✅ Language, role, theme state
│   │   └── ...
├── backend/
│   ├── main.py                         ✅ FastAPI backend with LLM integration
│   ├── prompts/
│   │   └── system_prompt.md            ✅ Isolated system prompt
│   └── zulip_bot/
│       ├── bot.py                      ✅ Zulip bot implementation
│       ├── config.py                  ✅ Configuration management
│       └── api_client.py              ✅ API client for backend
└── data/
    ├── materials.json                  ✅ Sample materials data
    ├── edit-history.json               ✅ Edit history tracking
    └── materials-pending-approval.json ✅ Demo project data

# Future structure with Phase 1:
├── frontend/src/pages/
│   ├── CreateDevis.jsx                 📋 Planned: Devis creation
└── projects/                           📋 Planned: Project data storage
    ├── project-a/
    │   ├── devis.json                  📋 Phase 1 data
    │   └── materials.json               ✅ Phase 2 data
    └── project-b/
        └── ...
```

## Getting Started (Phase 2: Tracking Dashboard)

### Quick Start - Run All Services

The easiest way to start the application is to use the provided startup script, which will start all three services (backend, frontend, and Zulip bot) with a single command:

**Option 1: Using the shell script (Linux/macOS)**
```bash
chmod +x start_app.sh
./start_app.sh
```

**Option 2: Using the Python script (Cross-platform)**
```bash
python start_app.py
```

This will start:
- **FastAPI Backend** on http://localhost:8000
- **React Frontend** on http://localhost:5173
- **Zulip Bot** (listening for messages)

All services will run in the background, and logs will be written to the `logs/` directory. Press `Ctrl+C` to stop all services.

> **Note**: Make sure you have:
> - Python dependencies installed (`pip install -r backend/requirements.txt`)
> - Node.js dependencies installed (`cd frontend && npm install`)
> - Environment variables configured (see setup sections below)

### Manual Setup (Individual Services)

If you prefer to run services individually or need to set up the project from scratch:

### Backend Setup (FastAPI)

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment (recommended)**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   - Create `backend/.env` file and add your configuration:
   ```bash
   # Required for AI agent
   OPENAI_API_KEY=sk-proj-your-key-here
   OPENAI_MODEL=gpt-4o
   
   # Optional: Zulip bot configuration (if using Zulip integration)
   ZULIP_EMAIL=your-bot@example.com
   ZULIP_API_KEY=your-api-key-here
   ZULIP_SITE=your-zulip-instance.com
   ZULIP_BOT_NAME=contractor_bot
   API_BASE_URL=http://localhost:8000
   MATERIALS_FILE_PATH=../data/materials.json
   ```

5. **Run the FastAPI server**
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The API will be available at `http://localhost:8000`

### Frontend Setup (React)

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Optional: Configure backend URL** – create `frontend/.env.local` if you need to change the backend URL:
   ```bash
   VITE_API_BASE_URL=http://localhost:8000
   ```
   (Defaults to `http://localhost:8000` if not set)

3. **Run the dev server**
   ```bash
   npm run dev
   ```

4. **Validate data regularly**
   ```bash
   npm run lint:data
   ```
   This reuses `scripts/validateMaterials.js` to make sure the dashboard and assistant see clean data.

### Zulip Bot Setup (Optional)

The Zulip bot allows you to interact with the AI agent via Zulip chat. To use it:

1. **Configure environment variables**
   - Create or edit `backend/.env` and add your Zulip credentials:
   ```bash
   ZULIP_EMAIL=your-bot@example.com
   ZULIP_API_KEY=your-api-key-here
   ZULIP_SITE=your-zulip-instance.com
   ZULIP_BOT_NAME=contractor_bot
   API_BASE_URL=http://localhost:8000
   MATERIALS_FILE_PATH=../data/materials.json
   ```

2. **Get Zulip API credentials**
   - Log into your Zulip instance
   - Go to Settings → Your bots → Add a new bot
   - Copy the bot's email and API key
   - Use your Zulip instance domain (without https://) for `ZULIP_SITE`

3. **Run the bot**
   - The bot will automatically start when using the startup script
   - Or run manually: `python -m backend.zulip_bot.bot`
   - The bot responds to mentions of `@contractor_bot` in Zulip

> **Note**: The Zulip bot requires the FastAPI backend to be running to process queries.

### Running Services Individually

If you prefer to run services in separate terminals:

- **Terminal 1**: Run FastAPI backend (`cd backend && uvicorn main:app --reload`)
- **Terminal 2**: Run React frontend (`cd frontend && npm run dev`)
- **Terminal 3**: Run Zulip bot (`python -m backend.zulip_bot.bot`)

> **Tip**: Use the startup script (`./start_app.sh` or `python start_app.py`) to run all three services at once!

### AI Agent-Powered Table Edits & Reloading

- The AI agent can now edit `data/materials.json` directly by calling the backend `update_cell` function (function calling). When the agent responds with a successful update, the Materials table automatically refreshes via a shared `materials-data-reload` event so every visible view stays in sync.
- The Materials page header includes a **Reload data** button for manual refreshes. This forces the React hook to re-fetch `/materials.json` (with cache busting) in case you made changes outside the agent or while experimenting with data files.
- Any component that needs fresh materials can call the exported `reload()` helper from `useMaterialsData`. It triggers a local refetch and broadcasts the reload event so other mounts update themselves without a full page reload.

### System Prompt Management

- **Isolated system prompt** - The LLM system prompt is stored in `backend/prompts/system_prompt.md` for easy editing and version control
- Edit the prompt directly without touching Python code
- Changes take effect on next request (with `--reload` mode)
- Supports markdown formatting for better readability
- See `backend/prompts/README.md` for more details

## Implementation Status

### ✅ Completed (Phase 2: Tracking)
- **Global Dashboard MVP** ✅
  - Project cards with status indicators and lifecycle management
  - Project metrics (total projects, completion rate, client approvals, invoices, costs)
  - Demo projects for testing and onboarding
  - Settings page (language, role, theme preferences)
  - Project selection and navigation
- **Tracking Dashboard** with KPIs and metrics
- **Materials tracking table** with editable fields
- **LLM-powered AI agent** for project queries and actions
  - Can query data and take actions (update approvals, validate items)
  - Bilingual responses (generates both English and French)
  - Language-aware display based on UI language toggle
  - Chat history with language switching support
  - Function calling for autonomous data updates
- **Chat history** with conversation tracking
  - Automatically cleared on logout/login for privacy
  - Language-aware response display
- **Role-based access** (Contractor, Client, Architect)
- **Multi-language UI support** (French/English) with language toggle
- **Theme support** (Purple/Blue themes)
- **Backend API** for data management and LLM queries
- **Real-time data updates**
- **Protected routes** requiring project selection for tracking pages

### 🚧 In Progress
- Enhanced UI/UX improvements
- Advanced task management features (Phase 2.4)

### ✅ Recently Completed
- **Zulip chatbot integration (Phase 2.3)** ✅
  - Bot responds to mentions in Zulip
  - Queries backend API for LLM responses
  - Supports both stream and private messages
  - Integrated with startup script for easy deployment
  - **Validation actions** - Can approve/reject items directly via chat commands
  - **System prompt isolation** - Prompt stored in `backend/prompts/system_prompt.md` for easy editing
  - **Improved formatting** - Clean markdown formatting, HTML tag removal, proper line breaks
  - **Product identifier extraction** - Correctly handles complex requests like "validate X in Y as Z"
  - **Confirmation handling** - Properly extracts context from conversation history
  - **Table updates** - Bot can update materials table directly (approval status, etc.)

### 📋 Planned (Creating Devis - Phase 1)
- Devis creation interface (HEMEA-like)
- Project creation workflow from global dashboard
- Integration between Creating Devis and Tracking
- Devis export functionality

## Notes

- Focus on French apartment renovation context and requirements
- Consider French construction regulations and standards
- Ensure GDPR compliance for client data
- Support multiple concurrent projects (architecture ready)
- Design for scalability as more contractors/clients are added
- Clear separation between Creating Devis and Tracking workflows
- User-facing UI uses "Creating" and "Tracking" terminology; "Phase" terminology reserved for technical development planning
