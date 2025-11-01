# France Renovation Contractor Dashboard & Bot

A web-based dashboard and Zulip chatbot system for managing apartment renovation projects in France. The system enables contractors, clients, architects, and other stakeholders to interact with an LLM-powered assistant to query project data, track tasks, validate requirements, and manage renovation workflows.

## Project Overview

This project aims to streamline communication and task management for apartment renovation projects in France through an intelligent LLM-powered interface. The system will help stakeholders quickly access information about project requirements, materials, costs, timelines, and action items.

## Goals

1. **Provide instant access to project information** via natural language queries
2. **Track and manage action items** across different roles (contractor, client, architect)
3. **Centralize project data** in a tabular format accessible via web dashboard
4. **Enable fast interactions** through Zulip chatbot integration
5. **Facilitate cross-role communication** and task assignment

## MVP Phases

### Phase 1: Web Dashboard MVP
- **Dashboard landing page** with at-a-glance metrics (orders pending, spend, deliveries) and a persistent LLM prompt card
- **Dedicated materials view** hosting the tabular dataset (`materials.json`) with filters and deep links back to the dashboard
- **Natural language query interface** allowing users to ask questions about:
  - What needs to be validated
  - What items need to be purchased
  - Pricing information
  - Timeline/scheduling
- **LLM responses** based on the displayed tabular data
- **Role-based access** (contractor, client, architect, etc.)

#### Phase 1 UI Layout
- The landing page provides quick KPIs, recent alerts, and the “Ask the assistant” form so stakeholders know what’s available before prompting the LLM.
- The materials page focuses on detailed tabular data; the assistant UI remains accessible (drawer/modal) for context-aware questions.
- Navigation between the two views should be obvious (breadcrumb or primary nav) to keep discovery simple for new users.

### Phase 2: Backend Data Integration
- **Backend API** to store and manage project data
- **Database integration** for persistent storage
- **LLM access to backend data** instead of webpage scraping
- **Real-time data updates** reflected in LLM responses

### Phase 3: Zulip Chatbot Integration
- **Zulip bot** (`@contractor_bot` or similar)
- **Natural language queries** via Zulip mentions
- **LLM responses** based on backend data
- **Action item tracking** integrated with chat context

### Phase 4: Task Management & To-Do Lists
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
- Tabular data display (Phase 1)
- Backend database (Phase 2+)
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

## Future Enhancements

- **Multi-language support** (French/English)
- **Document upload and parsing** (plans, invoices, permits)
- **Image recognition** for progress tracking
- **Automated notifications** for deadlines and pending tasks
- **Reporting and analytics** dashboard
- **Mobile app** for on-site access
- **Integration with French construction standards** and regulations
- **Cost tracking and budget management**
- **Supplier management** and ordering automation

## Project Structure

```
france_renovation_contractor/
├── README.md                 # This file
├── frontend/                 # Web dashboard (Phase 1+)
├── backend/                 # API and data management (Phase 2+)
├── zulip_bot/               # Zulip chatbot integration (Phase 3+)
├── data/                    # Sample data and schemas
└── docs/                    # Additional documentation
```

## Getting Started (Phase 1 Dashboard)

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

## Notes

- Focus on French apartment renovation context and requirements
- Consider French construction regulations and standards
- Ensure GDPR compliance for client data
- Support multiple concurrent projects
- Design for scalability as more contractors/clients are added


