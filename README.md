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
   - LLM-powered assistant with bilingual responses (English/French)
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

This repository currently contains the **Phase 2: Tracking System** implementation. The tracking system enables stakeholders to monitor project execution, track materials, manage approvals, and interact with an AI assistant for project queries.

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
- **Dashboard landing page** with at-a-glance metrics (orders pending, spend, deliveries) and a persistent LLM prompt card
- **Dedicated materials view** hosting the tabular dataset (`materials.json`) with filters and deep links back to the dashboard
- **Natural language query interface** allowing users to ask questions about:
  - What needs to be validated
  - What items need to be purchased
  - Pricing information
  - Timeline/scheduling
- **LLM responses** based on the displayed tabular data
- **Role-based access** (contractor, client, architect, etc.)

#### Phase 2.1 Tracking UI Layout
- The landing page provides quick KPIs, recent alerts, and the “Ask the assistant” form so stakeholders know what’s available before prompting the LLM.
- The materials page focuses on detailed tabular data; the assistant UI remains accessible (drawer/modal) for context-aware questions.
- Navigation between the two views should be obvious (breadcrumb or primary nav) to keep discovery simple for new users.

### Phase 2.2: Tracking Backend Data Integration
- **Backend API** to store and manage project data
- **Database integration** for persistent storage
- **LLM access to backend data** instead of webpage scraping
- **Real-time data updates** reflected in LLM responses

### Phase 2.3: Tracking Zulip Chatbot Integration
- **Zulip bot** (`@contractor_bot` or similar)
- **Natural language queries** via Zulip mentions
- **LLM responses** based on backend data
- **Action item tracking** integrated with chat context

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

### Use Case 5: Zulip Integration
**User**: `@contractor_bot What's the status of the living room renovation?`
**Bot**: Responds with current status, pending items, and next steps.

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

### LLM Integration
- Natural language understanding for queries
- Context-aware responses based on project data
- Role-specific response formatting
- Task extraction and parsing

### Zulip Integration
- Bot account setup
- Message parsing and command handling
- LLM query processing
- Response formatting for chat context
- Action item detection and tracking

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
├── zulip_bot/               # Zulip chatbot integration (Phase 2.3+)
├── data/                    # Sample data and schemas
│   └── materials.json       # Current tracking data structure
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
│   │   │   ├── AIPanel.jsx             ✅ LLM assistant panel
│   │   │   ├── ProjectCard.jsx        ✅ Project card component
│   │   │   ├── Layout.jsx              ✅ Main layout with sidebar
│   │   │   └── ...
│   │   ├── contexts/
│   │   │   ├── ProjectsContext.jsx      ✅ Project state management
│   │   │   ├── ChatHistoryContext.jsx ✅ Chat history state
│   │   │   └── AppContext.jsx          ✅ Language, role, theme state
│   │   └── ...
├── backend/
│   └── main.py                         ✅ FastAPI backend with LLM integration
└── data/
    ├── materials.json                  ✅ Sample materials data
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
   - Copy `.env.example` to `.env`
   - Edit `.env` and add your OpenAI API key:
   ```bash
   OPENAI_API_KEY=sk-proj-your-key-here
   OPENAI_MODEL=gpt-4o-mini
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

### Running Both Services

- **Terminal 1**: Run FastAPI backend (`cd backend && uvicorn main:app --reload`)
- **Terminal 2**: Run React frontend (`cd frontend && npm run dev`)

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
- **LLM-powered assistant** for project queries
  - Bilingual responses (generates both English and French)
  - Language-aware display based on UI language toggle
  - Chat history with language switching support
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
- Zulip chatbot integration (Phase 2.3)
- Advanced task management features (Phase 2.4)

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
