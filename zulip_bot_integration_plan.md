# Zulip Bot Integration Plan

## Overview

This document outlines the plan for integrating a Zulip chatbot that connects to the existing AI assistant API. The bot will allow users to interact with the renovation contractor system via Zulip group chats by mentioning the bot (e.g., `@contractor_bot`).

## Architecture

```
Zulip Server
    ↓ (user mentions @bot)
Zulip Bot Service (Python)
    ↓ (HTTP request)
FastAPI Backend (/api/assistant/query)
    ↓ (function calls if needed)
Database (materials.json, edit-history.json)
    ↓ (response)
Zulip Bot Service
    ↓ (formatted message)
Zulip Server (back to user)
```

## Components

### 1. Zulip Bot Service
- **Location**: `backend/zulip_bot/` (new directory)
- **Technology**: Python using `zulip` Python SDK
- **Responsibilities**:
  - Connect to Zulip server via API
  - Listen for messages mentioning the bot
  - Extract user queries from messages
  - Load materials data from database
  - Call FastAPI assistant endpoint
  - Format and send responses back to Zulip
  - Handle function call results if agent performs actions

### 2. Integration Points

#### Existing Backend API
- **Endpoint**: `POST /api/assistant/query`
- **Request Model**: `MaterialsQuery`
  - `prompt`: str (user's question)
  - `materials`: Optional[dict] (materials data)
  - `customTables`: Optional[list] (custom table configurations)
- **Response**: 
  - `answer`: str (English response)
  - `answer_fr`: str (French response)
- **Function Calls**: Handles `update_cell` tool internally

#### Database Access
- **Materials Data**: `data/materials.json`
- **Edit History**: `data/edit-history.json`
- Bot service will need to read materials data to pass to API

## Setup Requirements

### 1. Zulip Server Setup
- Zulip server instance (self-hosted or cloud)
- Bot account created in Zulip
- Bot API key generated
- Bot added to relevant streams/channels

### 2. Python Dependencies
Add to `backend/requirements.txt`:
```
zulip>=0.10.0
```

### 3. Environment Variables
Add to `.env`:
```
ZULIP_EMAIL=bot@yourdomain.com
ZULIP_API_KEY=your_bot_api_key
ZULIP_SITE=https://your-zulip-instance.com
ZULIP_BOT_NAME=contractor_bot
```

### 4. Configuration
- Bot name/username in Zulip
- Streams/channels bot should listen to
- Rate limiting configuration
- Error handling preferences

## Implementation Steps

### Phase 1: Connection Test Script
1. Create `backend/zulip_bot/` directory
2. Add `zulip>=0.10.0` to `backend/requirements.txt`
3. Set up environment variables in `.env` (ZULIP_EMAIL, ZULIP_API_KEY, ZULIP_SITE)
4. Create `backend/zulip_bot/test_connection.py` - simple test script
5. Test script should:
   - Load configuration from environment variables
   - Initialize Zulip client
   - Verify connection to Zulip server
   - Listen for one test message mentioning the bot
   - Print connection status and received messages
   - Confirm basic connectivity works
6. Run test script to verify Zulip setup is correct
7. **Goal**: Confirm Zulip connection works before building full bot

### Phase 2: Basic Bot Setup
1. Create `backend/zulip_bot/bot.py` - main bot service
2. Create `backend/zulip_bot/config.py` - configuration management
3. Set up Zulip client connection (reuse from test script)
4. Implement message listener for bot mentions
5. Basic message echo/response functionality
6. Test basic connection and message reception
7. **Goal**: Bot can receive and respond to mentions

### Phase 3: API Integration
1. Implement function to load materials data from `data/materials.json`
2. Create function to call FastAPI `/api/assistant/query` endpoint
3. Handle API responses (both English and French)
4. Format responses for Zulip (markdown support)
5. Send responses back to Zulip
6. Test end-to-end query flow

### Phase 4: Function Call Handling
1. Detect when agent performs function calls (via API response)
2. Format function call results for user visibility
3. Show what actions were taken (e.g., "Updated price for Kitchen item #3")
4. Handle errors gracefully
5. Test function call scenarios

### Phase 5: Enhanced Features
1. Multi-language support (detect user language preference)
2. Context awareness (remember conversation context)
3. Rich formatting (tables, lists, code blocks)
4. Error messages and help commands
5. Rate limiting and spam prevention

### Phase 6: Production Readiness
1. Logging and monitoring
2. Error recovery and retry logic
3. Health checks
4. Deployment configuration
5. Documentation for users

## File Structure

```
backend/
├── main.py (existing FastAPI app)
├── zulip_bot/ (new)
│   ├── __init__.py
│   ├── test_connection.py (Phase 1: connection test script)
│   ├── bot.py (Phase 2: main bot service)
│   ├── config.py (Phase 2: configuration)
│   ├── api_client.py (Phase 3: FastAPI client wrapper)
│   ├── message_handler.py (Phase 3: message processing)
│   └── utils.py (helper functions)
├── requirements.txt (add zulip dependency)
└── .env (add Zulip config)
```

## Test Script Design (Phase 1)

### Test Connection Script Structure
```python
# backend/zulip_bot/test_connection.py
import os
from dotenv import load_dotenv
import zulip

def test_zulip_connection():
    # Load environment variables
    # Initialize Zulip client
    # Test connection
    # Listen for one message
    # Print results
```

### Test Script Goals
- Verify Zulip API credentials are correct
- Confirm bot can connect to Zulip server
- Test receiving a message mentioning the bot
- Validate environment setup before building full bot
- Simple, throwaway script for initial validation

### Running the Test
```bash
cd backend
python zulip_bot/test_connection.py
```

Expected output:
- Connection status
- Bot user info
- Any messages received
- Success/failure indicators

## Bot Service Design

### Main Bot Class Structure
```python
class ContractorBot:
    def __init__(self):
        # Initialize Zulip client
        # Load configuration
        # Set up API client for FastAPI backend
        
    def handle_message(self, message):
        # Check if bot is mentioned
        # Extract user query
        # Load materials data
        # Call assistant API
        # Format and send response
        
    def run(self):
        # Main event loop
        # Listen for messages
        # Process mentions
```

### Message Flow
1. User sends: `@contractor_bot What materials do I need for the kitchen?`
2. Bot detects mention and extracts query
3. Bot loads `materials.json` data
4. Bot calls `POST /api/assistant/query` with:
   - `prompt`: "What materials do I need for the kitchen?"
   - `materials`: {loaded materials data}
5. API returns response with answer
6. Bot formats response and sends to Zulip
7. User sees formatted answer in chat

## Error Handling

### Scenarios to Handle
- Zulip connection failures
- API endpoint unavailable
- Invalid materials data
- Function call errors
- Rate limiting
- Malformed user queries
- Network timeouts

### Error Response Format
- User-friendly error messages
- Logging for debugging
- Retry logic for transient failures
- Fallback responses

## Security Considerations

1. **API Key Security**: Store Zulip API key in environment variables, never in code
2. **Access Control**: Bot should only respond in authorized streams
3. **Input Validation**: Sanitize user inputs before sending to API
4. **Rate Limiting**: Prevent abuse with rate limiting
5. **Error Messages**: Don't expose sensitive information in error messages

## Testing Strategy

### Unit Tests
- Message parsing
- API client wrapper
- Response formatting
- Error handling

### Integration Tests
- End-to-end message flow
- Function call handling
- Multi-language responses
- Error scenarios

### Manual Testing
- Test in Zulip development environment
- Test various query types
- Test function call scenarios
- Test error handling

## Deployment

### Development
- Run bot service locally alongside FastAPI server
- Use development Zulip instance
- Enable verbose logging

### Production
- Run as systemd service or Docker container
- Monitor logs and health
- Set up alerts for failures
- Regular backups of configuration

## Configuration Options

### Bot Behavior
- Bot name/username
- Streams to listen to
- Response language (default to user's language or EN/FR)
- Response format (markdown, plain text)
- Function call verbosity (show/hide action details)

### Performance
- Message processing timeout
- API request timeout
- Rate limiting thresholds
- Concurrent request handling

## Future Enhancements

1. **Session Management**: Remember conversation context across messages
2. **Multi-User Support**: Handle multiple users in same stream
3. **Rich Interactions**: Buttons, dropdowns for common queries
4. **Scheduled Tasks**: Periodic updates or reminders
5. **Analytics**: Track usage, common queries, response times
6. **Custom Commands**: `/help`, `/status`, `/reload` commands
7. **File Attachments**: Handle image uploads for product identification
8. **Notifications**: Proactive notifications for important events

## Dependencies

### Required
- `zulip>=0.10.0` - Zulip Python API client
- `httpx` or `requests` - HTTP client for FastAPI calls (httpx already in requirements)
- `python-dotenv` - Environment variable management (already in requirements)

### Optional
- `asyncio` - For async message handling (if needed)
- `logging` - Enhanced logging (Python standard library)

## Timeline Estimate

- **Phase 1**: 0.5-1 day (connection test script)
- **Phase 2**: 1-2 days (basic bot setup)
- **Phase 3**: 2-3 days (API integration)
- **Phase 4**: 1-2 days (function call handling)
- **Phase 5**: 2-3 days (enhanced features)
- **Phase 6**: 1-2 days (production readiness)

**Total**: ~7.5-13 days for full implementation

## Notes

- The existing FastAPI endpoint is already well-structured and doesn't need changes
- The bot service will be a separate process that can run independently
- Consider using async/await for better performance with multiple concurrent requests
- The bot can be extended to support Discord/Slack later using similar patterns
- Keep bot service lightweight - delegate heavy processing to FastAPI backend

