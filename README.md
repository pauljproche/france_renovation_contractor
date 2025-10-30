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
- **Web-based dashboard** with LLM integration
- **Tabular data display** showing project information (requirements, materials, prices, timelines)
- **Natural language query interface** allowing users to ask questions about:
  - What needs to be validated
  - What items need to be purchased
  - Pricing information
  - Timeline/scheduling
- **LLM responses** based on the displayed tabular data
- **Role-based access** (contractor, client, architect, etc.)

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

## Notes

- Focus on French apartment renovation context and requirements
- Consider French construction regulations and standards
- Ensure GDPR compliance for client data
- Support multiple concurrent projects
- Design for scalability as more contractors/clients are added

