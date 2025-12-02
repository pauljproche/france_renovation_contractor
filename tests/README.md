# Agent Test Suite

This test suite validates the agent's functionality across three main categories:

## Test Categories

The test suite includes 8 main categories:

1. **TODO Tests** - What needs to be done today
2. **VALIDATION Tests** - What needs to be validated
3. **EDITING MATERIALS Tests** - Material editing pipeline
4. **QUERY/INFORMATION Tests** - Information retrieval queries
5. **ARRAY OPERATIONS Tests** - Adding/removing array items
6. **CONFIRMATION HANDLING Tests** - Multiple match scenarios
7. **BILINGUAL RESPONSE Tests** - English and French responses
8. **ERROR HANDLING Tests** - Invalid input handling

### 1. TODO Tests
Tests what needs to be done today as different roles (client/contractor/architect).

**Variants tested:**
- "What needs to be done today as [role]?"
- "What do I need to do today as [role]?"
- "What are my tasks as [role]?"
- "What should I do as [role]?"
- "What are the action items for [role]?"

**Roles tested:** client, contractor, architect

**Validation Criteria:**
The test suite verifies that TODO responses are correct by:
1. **Counting items** - Calculates the actual number of items needing action for the specified role from the materials data
2. **Verifying count** - Checks that the response contains the correct count (e.g., "10 items", "Total: 10")
3. **Verifying items** - Checks that the response lists the correct items (at least 50% of expected items must appear)
4. **Checking format** - Verifies the response has proper structure (bullets, sections, etc.)
5. **Role verification** - Ensures the response mentions the correct role

An item needs action (TODO) if:
- It requires validation by that role (status: `rejected`, `change_order`, `null`, or any non-`approved` status)
- It needs to be ordered (`order.ordered == false`)
- It has pending delivery tracking (`order.delivery.date` or `order.delivery.status` is set)

### 2. VALIDATION Tests
Tests what needs to be validated by different roles.

**Variants tested:**
- "What needs to be validated by [role]?"
- "What items need to be validated by [role]?"
- "What items are requiring validation by [role]?"
- "Show me items that need [role] validation"
- "What is the validation status for [role]?"

**Roles tested:** client, contractor, architect

**Validation Criteria:**
The test suite verifies that validation responses are correct by:
1. **Counting items** - Calculates the actual number of items needing validation for the specified role from the materials data
2. **Verifying count** - Checks that the response contains the correct count (e.g., "10 items", "Total: 10")
3. **Verifying items** - Checks that the response lists the correct items (at least 50% of expected items must appear)
4. **Checking format** - Verifies the response has proper structure (bullets, sections, etc.)
5. **Role verification** - Ensures the response mentions the correct role

An item needs validation if its approval status is: `rejected`, `change_order`, `null`, or any value other than `approved`.

### 3. EDITING MATERIALS TABLE Tests
**⚠️ CRITICAL: These tests follow an exact pipeline and only modify the "beegcat" item in the cuisine section.**

The editing pipeline test performs these exact steps:
1. Modify the reference number to 7438
2. Modify it back to null
3. Set client validation to "change_order" and cray validation to "rejected"
4. Set client validation to "approved" and cray validation back to null

**Validation Criteria:**
The test suite verifies that editing operations are correct by:
1. **Loading data after each step** - Reads the actual materials.json file to verify changes
2. **Verifying exact values** - Checks that each field was set to the expected value
3. **Final state verification** - Confirms the data matches the original state after all steps
4. **Restoration verification** - Verifies the backup was properly restored

**Important:** By the end of the test, the data is restored to its original state. The test automatically:
- Creates a backup before starting
- Verifies each step by loading and checking the actual data
- Restores the backup after completion
- Verifies that the data matches the original state

### 4. QUERY/INFORMATION Tests
Tests that the agent correctly answers informational queries.

**Query types tested:**
- **Pricing queries**: "What is the total cost?", "What's the total price?", "What's the total TTC/HT?"
- **Timeline queries**: "What are the delivery dates?", "When will items be delivered?"
- **Section queries**: "Show me all items in the kitchen section", "What items are in the cuisine?"
- **Status queries**: "What's the status of [item]?"

**Validation Criteria:**
- Verifies response contains relevant keywords (price, delivery, etc.)
- Checks for numeric values in pricing queries
- Verifies date patterns in timeline queries
- Confirms section/items are mentioned in section queries

### 5. ARRAY OPERATIONS Tests
Tests adding and removing items from arrays (especially `replacementUrls`).

**Operations tested:**
- **Add**: Adding a replacement URL to an item
- **Remove**: Removing a replacement URL from an item

**Validation Criteria:**
- Verifies the URL was added/removed correctly
- Confirms all other URLs are preserved (no unintended changes)
- Tests use the "beegcat" item and automatically restore data after testing

### 6. CONFIRMATION HANDLING Tests
Tests behavior when multiple items match a query.

**Scenarios tested:**
- **Multiple matches**: Agent should ask for confirmation before updating
- **All confirmation**: Agent should handle "all" confirmation correctly
- **Single match**: Agent should update immediately without asking

**Validation Criteria:**
- Multiple matches: Agent asks for confirmation, doesn't update immediately
- Single match: Agent updates immediately, doesn't ask for confirmation
- Confirmation responses are handled appropriately

### 7. BILINGUAL RESPONSE Tests
Tests that responses are provided in both English and French.

**Query types tested:**
- Validation queries
- TODO queries
- Pricing queries

**Validation Criteria:**
- Response includes both English (`answer`) and French (`answer_fr`) versions
- Both languages contain similar content
- French includes appropriate French keywords
- Both have proper structure (bullets, sections, etc.)

### 8. ERROR HANDLING Tests
Tests behavior with invalid inputs.

**Error types tested:**
- **Nonexistent item**: Query for item that doesn't exist
- **Invalid field**: Attempt to set non-existent field
- **Invalid value**: Attempt to set invalid status value
- **Malformed request**: Incomplete request (missing item name)

**Validation Criteria:**
- Agent does NOT claim success for invalid inputs
- Agent indicates error or asks for clarification
- Graceful error handling (no crashes)

## Running the Tests

### Prerequisites
1. The backend API must be running on `http://localhost:8000` (or set `API_BASE_URL` environment variable)
2. The materials.json file must exist in `data/materials.json`
3. The "beegcat" item must exist in the cuisine/kitchen section

### Run the test suite:

#### Run all tests:
```bash
# From the project root
python3 tests/agent_test_suite.py
```

#### Run only high-priority tests (faster):
```bash
# Runs only core functionality tests: validation, editing, array operations
python3 tests/agent_test_suite.py --priority
# or
python3 tests/agent_test_suite.py -p
```

#### Run specific categories:
```bash
# Run only validation tests
python3 tests/agent_test_suite.py --categories validation

# Run multiple categories
python3 tests/agent_test_suite.py --categories validation editing array

# Available categories: todo, validation, editing, query, array, confirmation, bilingual, error
```

#### List available categories:
```bash
python3 tests/agent_test_suite.py --list-categories
```

### Test Execution Modes

**Full Suite** (default):
- Runs all 8 categories
- All variants for each test type
- Most comprehensive but slowest

**Priority Mode** (`--priority`):
- Runs only high-priority categories: validation, editing, array operations
- Only default variants (no variant testing)
- Faster execution, focuses on core functionality
- Recommended for quick checks

**Selective Mode** (`--categories`):
- Run only specified categories
- All variants for selected categories
- Good for testing specific features

### Cost Estimation

**⚠️ IMPORTANT: This test suite makes API calls that cost money!**

The test suite uses GPT-4o, which charges per token:
- **Input tokens**: ~$0.03 per 1,000 tokens
- **Output tokens**: ~$0.06 per 1,000 tokens

**Estimated Costs (GPT-4o):**

⚠️ **These are estimates based on current pricing. Always check with `--estimate-cost` before running!**

| Mode | API Calls | Estimated Cost |
|------|-----------|----------------|
| **Priority Mode** | 9 calls | **~$2.00 - $2.50** |
| **Single Category** | 2-15 calls | **~$0.50 - $4.00** |
| **Full Suite** | 58 calls | **~$13.00 - $16.00** |

**Cost by Category (approximate):**
- `validation`: ~$4.00 (15 calls)
- `editing`: ~$1.00 (4 calls, complex)
- `array`: ~$0.50 (2 calls)
- `todo`: ~$4.00 (15 calls)
- `query`: ~$3.00 (12 calls)
- `confirmation`: ~$0.80 (3 calls)
- `bilingual`: ~$0.80 (3 calls)
- `error`: ~$1.00 (4 calls)

**Note:** Costs are based on:
- ~8,000 input tokens per call (system prompt + materials data + user prompt)
- ~400 output tokens per call (average response)
- GPT-4o pricing: $0.03/1k input tokens, $0.06/1k output tokens

Actual costs may be higher if:
- Responses are longer than average
- Materials data is larger
- API retries occur

**View cost estimate before running:**
```bash
# Estimate cost without running
python3 tests/agent_test_suite.py --estimate-cost

# Estimate cost for specific categories
python3 tests/agent_test_suite.py --estimate-cost --categories validation editing

# Estimate cost for priority mode
python3 tests/agent_test_suite.py --estimate-cost --priority
```

**Skip cost warning (use with caution):**
```bash
python3 tests/agent_test_suite.py --skip-cost-warning --priority
```

**Note:** Actual costs may vary based on:
- Response lengths (output tokens)
- Materials data size (input tokens)
- Model pricing changes
- API rate limits/retries

### Recommendations

**Use priority mode for development:**
- Run `--priority` for quick validation during development (~$2.00-2.50)
- Fastest way to verify core functionality

**Check costs first:**
- Always run `--estimate-cost` before running tests
- Prevents accidental expensive runs

**Test specific features:**
- Use `--categories` to test only what you need
- Saves money by running only relevant tests

**Full suite:**
- Only run before important releases (~$13-16)
- Most comprehensive but most expensive

### Performance Tips

- The test suite can take 5-15 minutes for full run (depending on LLM response times)
- Priority mode typically takes 2-3 minutes
- Single category tests take 1-3 minutes depending on category

### Environment Variables

- `API_BASE_URL`: Base URL for the API (default: `http://localhost:8000`)

## Test Output

The test suite provides:
- Real-time status for each test (✓ passed, ✗ failed)
- Duration for each test
- Summary statistics
- Detailed error messages for failed tests
- Category breakdown

## Backup Management

The test suite automatically creates backups in `tests/backups/` before running editing tests. Backups are named with timestamps:
- `materials_editing_pipeline_YYYYMMDD_HHMMSS.json`

## Notes

- **TODO and VALIDATION tests** can have different variants - the test suite tests multiple phrasings to ensure robustness
- **EDITING MATERIALS tests** follow an exact pipeline - these are strict and must modify only the specified row
- All editing tests restore data to original state after completion
- The test suite is designed to be safe - it won't permanently modify your data

## Troubleshooting

### "Could not find beegcat item"
- Ensure the materials.json file contains an item with `product: "beegcat"` in the cuisine/kitchen section

### "Cannot connect to backend API"
- Make sure the backend is running: `python3 start_app.py` or `uvicorn backend.main:app --reload`
- Check that the API is accessible at the configured URL

### "Test timeout"
- Some tests may take longer if the LLM is slow to respond
- Increase timeout values in the code if needed

