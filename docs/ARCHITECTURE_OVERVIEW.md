# Architecture Overview - Tracking System

This document provides a high-level overview of how the tracking system works, focusing on the core interactions between the frontend, backend, and AI agent. This is designed for junior engineers getting started with the project.

## Table of Contents

1. [System Overview](#system-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [AI Agent Flow (Web Interface)](#ai-agent-flow-web-interface)
5. [Zulip Bot Flow](#zulip-bot-flow)
6. [Data Flow](#data-flow)

---

## System Overview

The tracking system is a web application that helps manage renovation projects. It consists of:

- **Frontend**: React application (runs in browser)
- **Backend**: FastAPI server (Python)
- **AI Agent**: OpenAI LLM that can answer questions and take actions
- **Zulip Bot**: Alternative interface via Zulip chat

### Key Components

```
User Browser (Frontend)
    ↓
FastAPI Backend (Python)
    ↓
OpenAI API (LLM)
    ↓
Materials Data (JSON file)
```

---

## Frontend Architecture

### Main Entry Point

**File**: `frontend/src/App.jsx`

This is the root component that sets up routing and context providers. It wraps the entire app with:
- `LanguageProvider` - Manages language preference (EN/FR)
- `RoleProvider` - Manages user role (Contractor, Client, etc.)
- `AIPanelProvider` - Manages AI panel visibility state

### Tracking Pages Structure

**File**: `frontend/src/components/Layout.jsx`

The Layout component provides the main structure:
- **Sidebar**: Navigation menu (visible on tracking pages)
- **TopBar**: Language toggle, role switcher, AI panel toggle
- **Main Content**: Where page components render (Dashboard, Materials, etc.)

### Key Tracking Pages

1. **Dashboard** (`frontend/src/pages/Dashboard.jsx`)
   - Shows project overview and metrics
   - Has access to AI Panel sidebar

2. **Materials** (`frontend/src/pages/Materials.jsx`)
   - Displays materials table
   - Has access to AI Panel sidebar

3. **Chat History** (`frontend/src/pages/ChatHistory.jsx`)
   - Shows all past conversations with AI agent
   - Displays both English and French responses

### AI Panel Component

**File**: `frontend/src/components/AIPanel.jsx`

This is the main AI interaction component. Key features:

- **Location**: Renders as a sidebar panel (can be toggled open/closed)
- **State Management**: 
  - `chatMessages` - Array of conversation messages
  - `currentSessionId` - Tracks conversation sessions
  - `loading` - Loading state during API calls

**Key Function**: `handleSubmit()` (line 145)
- Called when user submits a question
- Creates a new session if needed
- Calls `queryMaterialsAssistant()` to get AI response
- Updates UI with response
- Saves to chat history

### Data Management

**File**: `frontend/src/hooks/useMaterialsData.js`

This hook manages materials data:
- Fetches data from backend API
- Provides reload functionality
- Broadcasts reload events when data changes

**File**: `frontend/src/contexts/ChatHistoryContext.jsx`

Manages chat history:
- Stores conversation history in localStorage
- Provides `addEntry()` function to save conversations
- Used by both AI Panel and Chat History page

---

## Backend Architecture

### Main API Server

**File**: `backend/main.py`

FastAPI application that handles:
- API endpoints for materials data
- AI agent queries
- Data updates

### Key Endpoint: `/api/assistant/query`

**Function**: `query_assistant()` (line 356)

This is the main endpoint that processes AI queries:

1. **Receives Request**:
   ```python
   {
       "prompt": "What needs to be validated?",
       "materials": {...},  # Full materials data
       "language": "en"      # User's language preference
   }
   ```

2. **Loads System Prompt**:
   - Reads from `backend/prompts/system_prompt.md`
   - This tells the LLM how to behave

3. **Prepares Data**:
   - Formats materials data as JSON string
   - Adds any custom tables if provided
   - Adds language instruction

4. **Calls OpenAI**:
   - Sends system prompt + user prompt + materials data
   - LLM can call `update_cell` function if action needed

5. **Parses Response**:
   - Extracts English and French versions
   - Looks for "EN:" and "FR:" markers in response

6. **Returns Response**:
   ```python
   {
       "answer": "English response...",
       "answer_fr": "French response..."
   }
   ```

### Update Function

**Function**: `update_cell()` (line 228)

When the AI agent needs to update data (e.g., validate an item), it calls this function:
- Validates the update (checks product matches, etc.)
- Updates the materials JSON file
- Logs the edit to history
- Returns updated data

---

## AI Agent Flow (Web Interface)

### User Interaction Flow

```
1. User opens AI Panel (sidebar)
   ↓
2. User types question: "What needs to be validated by client?"
   ↓
3. User clicks Submit
   ↓
4. Frontend: AIPanel.handleSubmit() called
   ↓
5. Frontend: queryMaterialsAssistant() called
   File: frontend/src/services/assistant.js
   ↓
6. HTTP POST to /api/assistant/query
   Body: { prompt, materials, language }
   ↓
7. Backend: query_assistant() processes request
   File: backend/main.py (line 356)
   ↓
8. Backend: Loads system prompt
   File: backend/prompts/system_prompt.md
   ↓
9. Backend: Calls OpenAI API
   - Sends: system prompt + user prompt + materials data
   - LLM analyzes and generates response
   ↓
10. Backend: Parses response
    - Extracts EN: and FR: sections
    - Returns { answer, answer_fr }
   ↓
11. Frontend: Receives response
    - Displays in AI Panel (shows only current language)
    - Saves to chat history (saves both languages)
   ↓
12. If response indicates data was updated:
    - Frontend triggers MATERIALS_RELOAD_EVENT
    - Materials table refreshes automatically
```

### Key Code Locations

**Frontend - User Input**:
- `frontend/src/components/AIPanel.jsx` → `handleSubmit()` (line 145)
- `frontend/src/services/assistant.js` → `queryMaterialsAssistant()` (line 3)

**Backend - Request Processing**:
- `backend/main.py` → `query_assistant()` (line 356)
- `backend/main.py` → `load_system_prompt()` (line 56)

**Backend - Data Updates**:
- `backend/main.py` → `update_cell()` (line 228)
- Called automatically by LLM when action needed

### Language Handling

The system supports bilingual responses:

1. **User selects language** (EN/FR toggle in TopBar)
   - Stored in `AppContext` (localStorage)
   - Passed to backend as `language` parameter

2. **Backend receives language**:
   - Adds instruction to LLM to format response with EN:/FR: markers
   - LLM generates both languages

3. **Frontend displays**:
   - **AI Panel**: Shows only the selected language
   - **Chat History**: Shows both languages for reference

**Code References**:
- Language state: `frontend/src/contexts/AppContext.jsx` → `LanguageProvider`
- Language toggle: `frontend/src/components/TopBar.jsx` → `LanguageToggle`
- AI Panel display: `frontend/src/components/AIPanel.jsx` → line 443 (shows based on `language`)

### Detailed AIPanel Component Flow

The AIPanel component manages the entire conversation lifecycle. Here's how it works:

#### Component Initialization

**File**: `frontend/src/components/AIPanel.jsx`

**State Setup** (lines 32-48):
```javascript
const [prompt, setPrompt] = useState('');           // User's input text
const [loading, setLoading] = useState(false);      // Loading indicator
const [chatMessages, setChatMessages] = useState([]); // Conversation messages
const [currentSessionId, setCurrentSessionIdState] = useState(null); // Session tracking
```

**Data Hooks**:
- `useMaterialsData()` - Gets current materials data to send to backend
- `useLanguage()` - Gets user's language preference
- `useChatHistory()` - Saves conversations to chat history
- `useCustomTable()` - Gets custom table configurations

#### Session Management

**File**: `frontend/src/utils/aiPanelStorage.js`

The AIPanel uses sessions to group related conversations:

1. **Session Creation** (line 152-157 in AIPanel.jsx):
   - When user sends first message, creates new session
   - Uses `createNewSession()` from `aiPanelStorage.js` (line 67)
   - Generates unique UUID for session ID
   - Stores in localStorage with username prefix

2. **Session Persistence** (lines 50-56 in AIPanel.jsx):
   - Automatically saves messages whenever `chatMessages` changes
   - Uses `saveCurrentSession()` from `aiPanelStorage.js` (line 78)
   - Saves to localStorage: `ai-panel-sessions-{username}`

3. **Session Loading**:
   - User can switch between sessions via dropdown
   - `loadSession()` loads messages from localStorage (line 95 in aiPanelStorage.js)
   - Messages restored to `chatMessages` state

#### Message Submission Flow

**Function**: `handleSubmit()` (line 145 in AIPanel.jsx)

Here's the detailed step-by-step:

```
1. User types question and clicks Submit
   ↓
2. handleSubmit() called
   ↓
3. Create session if first message:
   - createNewSession() → generates UUID
   - Sets currentSessionId state
   ↓
4. Add user message to UI immediately:
   - setChatMessages([...prev, { type: 'user', content: prompt }])
   - This shows user's question right away (optimistic UI)
   ↓
5. Clear input and show loading:
   - setPrompt('')
   - setLoading(true)
   ↓
6. Call queryMaterialsAssistant():
   - File: frontend/src/services/assistant.js
   - Sends: { prompt, materials, customTables, language }
   - Returns: { en: "...", fr: "..." }
   ↓
7. On success:
   - Add assistant message: { type: 'assistant', content: { en, fr } }
   - Check if response indicates data update (line 183-187)
   - If update detected: dispatch MATERIALS_RELOAD_EVENT
   - Save to chat history (both languages)
   ↓
8. On error:
   - Add error message: { type: 'error', content: errorMessage }
   - Save error to chat history
   ↓
9. Hide loading:
   - setLoading(false)
```

#### Message Display

**Rendering Logic** (lines 426-463 in AIPanel.jsx):

Messages are rendered in a loop:
```javascript
chatMessages.map((message, index) => {
  // User messages: Show with "You" label
  // Assistant messages: Show with "Response" label
  // Error messages: Show with warning styling
})
```

**Language Display** (lines 440-453):
- Checks if `message.content` is object (has `en` and `fr`)
- If object: Shows only the language matching `language` state
- If string (legacy): Shows as-is

**Auto-scrolling** (lines 286-290):
- `useEffect` watches `chatMessages` and `loading`
- Automatically scrolls to bottom when new messages arrive
- Uses `contentRef` to access scroll container

#### Data Update Detection

**Code** (lines 183-187 in AIPanel.jsx):
```javascript
const updatePattern = /(successfully updated|has been updated|mis à jour|a été mis à jour)/i;
if (updatePattern.test(englishText) || updatePattern.test(frenchText)) {
  window.dispatchEvent(new CustomEvent(MATERIALS_RELOAD_EVENT));
}
```

When AI agent updates data:
1. Response contains "successfully updated" (EN or FR)
2. Pattern match triggers `MATERIALS_RELOAD_EVENT`
3. Materials table listens for this event
4. Table automatically refreshes to show new data

#### Session Lifecycle Management

**Auto-save on Changes** (lines 50-56):
- `useEffect` watches `chatMessages` and `currentSessionId`
- Automatically saves session whenever messages change
- Ensures no data loss

**Clear on Navigation** (lines 73-87):
- When user navigates away from tracking pages
- Saves current session first
- Clears session and messages
- Prevents stale data

**Save on Panel Close** (lines 89-96):
- When AI panel is closed
- Saves current session
- Preserves conversation for later

**Save on Unmount** (lines 98-106):
- When component unmounts (e.g., logout)
- Saves session in cleanup function
- Ensures data persistence

#### Chat History Integration

**Saving to History** (lines 190-195 in AIPanel.jsx):
```javascript
addEntry({
  prompt: userPrompt,
  response: answer,  // { en: "...", fr: "..." }
  sessionId: currentSessionId
});
```

- Each conversation saved to `ChatHistoryContext`
- Stored in localStorage separately from sessions
- Chat History page displays all conversations
- Shows both languages for reference

#### Key Utility Functions

**File**: `frontend/src/utils/aiPanelStorage.js`

- `createNewSession()` - Creates new session with UUID
- `saveCurrentSession(messages)` - Saves messages to localStorage
- `loadSession(sessionId)` - Loads messages for a session
- `loadAIPanelSessions()` - Gets all saved sessions
- `deleteSession(sessionId)` - Removes a session

**Storage Keys**:
- Sessions: `ai-panel-sessions-{username}` (localStorage)
- Current session ID: `ai-panel-current-session-{username}` (sessionStorage)

#### Visual Flow Diagram

```
User Input (textarea)
    ↓
handleSubmit() triggered
    ↓
┌─────────────────────────────────────┐
│ 1. Create/Get Session               │
│    - createNewSession() if first    │
│    - Get currentSessionId            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. Update UI State                  │
│    - Add user message to chatMessages│
│    - Clear input                    │
│    - Show loading indicator         │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. API Call                        │
│    - queryMaterialsAssistant()      │
│    - Sends: prompt, materials, lang │
│    - Waits for response             │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 4. Process Response                │
│    - Add assistant message          │
│    - Check for data updates         │
│    - Save to chat history           │
│    - Hide loading                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 5. Auto-save Session                │
│    - saveCurrentSession()           │
│    - Persists to localStorage       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 6. Auto-scroll                      │
│    - Scroll to bottom                │
│    - Show new message                │
└─────────────────────────────────────┘
```

#### Error Handling

**Error States** (lines 196-209 in AIPanel.jsx):
- Network errors caught in try/catch
- Error message added to `chatMessages` with `type: 'error'`
- Error also saved to chat history
- User sees error in UI with warning styling

#### Session Dropdown

**Session Management UI** (lines 297-402 in AIPanel.jsx):
- Dropdown shows all saved sessions
- Each session shows: date, message count
- User can:
  - Switch to different session
  - Delete a session
  - Create new session
- Sessions sorted by most recent first

---

## Zulip Bot Flow

The Zulip bot provides an alternative interface to the AI agent via Zulip chat.

### Architecture

```
Zulip Chat
    ↓
Zulip Bot (Python)
    ↓
FastAPI Backend (same as web)
    ↓
OpenAI API
```

### Bot Implementation

**File**: `backend/zulip_bot/bot.py`

**Main Class**: `ContractorBot

**Key Methods**:

1. **`_handle_message()`** (line 273)
   - Called when bot is mentioned in Zulip
   - Extracts user's query
   - Determines if it's a validation question or action

2. **`_is_validation_question()`** (line 107)
   - Checks if query is a question ("what needs...") vs action ("validate...")
   - Returns True for questions, False for actions

3. **`_extract_query()`** (line 198)
   - Removes bot mentions from message
   - Returns clean query text

4. **`query_assistant()`** (from `api_client.py`)
   - Calls same backend endpoint as web interface
   - File: `backend/zulip_bot/api_client.py` → `query_assistant()` (line 28)

### Bot Flow

```
1. User mentions @contractor_bot in Zulip
   ↓
2. Zulip sends event to bot
   ↓
3. Bot: _handle_message() called
   File: backend/zulip_bot/bot.py (line 273)
   ↓
4. Bot: Extracts query from message
   - Removes @mentions
   - Gets conversation context (recent messages)
   ↓
5. Bot: Determines if validation question
   - If question: skips context (ensures complete results)
   - If action: includes context (for confirmations)
   ↓
6. Bot: Calls backend API
   - Same endpoint as web: /api/assistant/query
   - Uses api_client.query_assistant()
   ↓
7. Backend: Processes same as web request
   - Same query_assistant() function
   - Same system prompt
   - Same LLM interaction
   ↓
8. Bot: Formats response for Zulip
   - Removes EN:/FR: markers (shows both languages)
   - Cleans up markdown formatting
   - Handles HTML tags
   ↓
9. Bot: Sends response to Zulip
   - Replies in same stream/topic or private message
```

### Key Differences from Web Interface

1. **No language toggle**: Bot always shows both languages
2. **Conversation context**: Bot can use recent Zulip messages
3. **Formatting**: Bot formats for chat (removes markers, cleans markdown)
4. **No session management**: Each message is independent (though context is used)

**Code References**:
- Bot main logic: `backend/zulip_bot/bot.py` → `ContractorBot` class
- API client: `backend/zulip_bot/api_client.py` → `query_assistant()`
- Response formatting: `backend/zulip_bot/bot.py` → `_format_zulip_message()` (line 240)

---

## Data Flow

### Materials Data

**Storage**: `data/materials.json`

**Structure**:
```json
{
  "sections": [
    {
      "id": "kitchen",
      "label": "Kitchen",
      "items": [
        {
          "product": "Faucet Model X",
          "approvals": {
            "client": { "status": "pending" },
            "cray": { "status": "approved" }
          },
          ...
        }
      ]
    }
  ]
}
```

### Data Loading Flow

1. **Frontend loads data**:
   - `useMaterialsData()` hook fetches from `/api/materials`
   - Caches in React state

2. **Backend serves data**:
   - `backend/main.py` → `load_materials_data()` (line 46)
   - Reads from `data/materials.json`

3. **Data updates**:
   - AI agent calls `update_cell()` function
   - Backend writes to `data/materials.json`
   - Frontend receives reload event
   - Frontend refetches data

### Edit History

**Storage**: `data/edit-history.json`

Tracks all changes made to materials:
- Who made the change (agent/manual)
- What changed (field, old value, new value)
- When it changed

**Function**: `log_edit()` in `backend/main.py` (line 130)

---

## Key Concepts for Beginners

### 1. System Prompt

**File**: `backend/prompts/system_prompt.md`

This is the "instruction manual" for the AI agent. It tells the LLM:
- How to interpret user queries
- How to format responses
- When to take actions vs just answer questions
- How to extract information from requests

**Important**: Both web and Zulip bot use the same system prompt for consistency.

### 2. Function Calling

The LLM can call functions (like `update_cell`) to take actions:
- User says: "validate demo_item as client"
- LLM recognizes this as an action (not a question)
- LLM calls `update_cell()` function
- Function updates the materials data
- LLM responds: "Successfully validated..."

### 3. Language Handling

- User's language preference is stored in browser (localStorage)
- Sent to backend so LLM knows which language to prioritize
- LLM always generates both EN and FR
- Frontend displays based on user's selection

### 4. Session Management

- Web interface: Manages conversation sessions (group related messages)
- Sessions saved to localStorage
- Each session has an ID and timestamp
- Chat History page shows all sessions

---

## Quick Reference: File Locations

### Frontend
- **AI Panel**: `frontend/src/components/AIPanel.jsx`
- **API Service**: `frontend/src/services/assistant.js`
- **Chat History**: `frontend/src/pages/ChatHistory.jsx`
- **Materials Hook**: `frontend/src/hooks/useMaterialsData.js`
- **Language Context**: `frontend/src/contexts/AppContext.jsx`

### Backend
- **Main API**: `backend/main.py`
- **Query Endpoint**: `backend/main.py` → `query_assistant()` (line 356)
- **Update Function**: `backend/main.py` → `update_cell()` (line 228)
- **System Prompt**: `backend/prompts/system_prompt.md`

### Zulip Bot
- **Bot Main**: `backend/zulip_bot/bot.py`
- **API Client**: `backend/zulip_bot/api_client.py`

### Data
- **Materials**: `data/materials.json`
- **Edit History**: `data/edit-history.json`

---

## Next Steps

To dive deeper:

1. **Start with the AI Panel**: Read `frontend/src/components/AIPanel.jsx` → `handleSubmit()`
2. **Follow the API call**: See `frontend/src/services/assistant.js`
3. **Understand backend processing**: Read `backend/main.py` → `query_assistant()`
4. **Learn the system prompt**: Read `backend/prompts/system_prompt.md`
5. **See how updates work**: Read `backend/main.py` → `update_cell()`

For Zulip bot:
1. Start with `backend/zulip_bot/bot.py` → `_handle_message()`
2. See how it calls the same backend: `backend/zulip_bot/api_client.py`

