# OpenAI API Key Setup Guide

## Using Organization API Key (CloverAI)

Since you have **Owner** access to the CloverAI organization, you can create and use organization API keys that will charge to the company card instead of your personal account.

## Step 1: Create a New API Key in the Organization

### Option A: Create a Project-Specific Key (Recommended)

1. **Go to Projects** (in the left sidebar)
2. **Create a new project** called "France Renovation Contractor" (or similar)
   - This helps track usage and costs separately
3. **Go to API keys** within that project
4. **Create a new secret key**
   - Name it: `france-renovation-contractor-production`
   - **Important**: Select **"Service account"** (not "You") for ownership
     - ✅ **Service account** = Better for production apps (key works even if you leave)
     - ❌ **You** = Key disabled if you're removed from org/project
   - Select the "France Renovation Contractor" project
   - Set permissions to "All" (or "Restricted" if you want to limit later)
   - Copy the key immediately (you won't see it again!)

### Option B: Create Organization-Level Key

1. **Go to API keys** (Organization settings)
2. Click **"+ Create new secret key"**
3. Name it: `france-renovation-contractor-production`
4. **Important**: Select **"Service account"** (not "You") for ownership
   - Service accounts are better for production applications
   - Keys tied to "You" are disabled if you leave the organization
5. Copy the key immediately

## Step 2: Configure the Key in Your Application

### For Local Development

1. **Edit `backend/.env` file:**
   ```bash
   cd backend
   nano .env
   ```

2. **Add or update the API key:**
   ```bash
   OPENAI_API_KEY=sk-proj-...your-organization-key-here...
   OPENAI_MODEL=gpt-4o
   ```

3. **Secure the file:**
   ```bash
   chmod 600 .env  # Only you can read/write
   ```

### For Production (AWS EC2)

1. **SSH into your EC2 instance**
2. **Edit the production `.env` file:**
   ```bash
   cd /opt/france-renovation/backend
   sudo nano .env
   ```

3. **Add the organization API key:**
   ```bash
   OPENAI_API_KEY=sk-proj-...your-organization-key-here...
   OPENAI_MODEL=gpt-4o
   ```

4. **Secure the file:**
   ```bash
   sudo chmod 600 .env
   sudo chown $USER:$USER .env
   ```

5. **Restart the backend service:**
   ```bash
   sudo systemctl restart france-renovation-backend
   ```

## Step 3: Verify It's Working

### Test the API Key

1. **Start your backend:**
   ```bash
   cd backend
   source venv/bin/activate
   python -c "from openai import OpenAI; import os; from dotenv import load_dotenv; load_dotenv(); client = OpenAI(api_key=os.getenv('OPENAI_API_KEY')); print('✅ API key is valid!' if client.models.list() else '❌ Invalid key')"
   ```

2. **Check the app works:**
   - Start the app
   - Make a query to the AI assistant
   - Verify it responds correctly

### Verify Organization Billing

1. **Go to OpenAI Platform → Usage**
2. **Check the usage dashboard**
   - You should see API calls being tracked
   - Costs will be charged to the organization's card
   - If you created a project, you can filter by project

## Step 4: Monitor Usage and Costs

### Current Setup
- ✅ **Billing method**: Company card already configured
- ✅ **Credit available**: $100 (will be used first before charging card)

### Set Up Usage Alerts (Highly Recommended)

1. **Go to Organization → Limits**
2. **Set up usage limits** to prevent unexpected charges:
   - **Credit alert**: Set alert when credit drops below $20 (so you know when it's running low)
   - **Monthly spending limit**: Set a reasonable limit (e.g., $200-500/month) after credit is used
   - **Rate limits**: If needed to prevent abuse
   - **Alert thresholds**: Get notified at 50%, 75%, 90% of limits

### Monitor Credit Usage

1. **Go to Organization → Usage**
2. **Check credit balance** regularly:
   - See how much of the $100 credit has been used
   - Track daily/weekly usage patterns
   - Estimate when credit will run out

3. **After credit is used**:
   - Charges will automatically switch to the company card
   - Make sure to set spending limits to avoid surprises

### Track Usage by Project

If you created a project-specific key:
1. **Go to Projects → Your Project**
2. **View usage dashboard** for that project
3. **Track costs** separately from other organization usage

### Regular Monitoring

- **Weekly**: Check usage in Organization → Usage
- **Monthly**: Review billing in Organization → Billing
- **Set alerts**: Get notified when usage exceeds thresholds

## Security Best Practices

### ✅ DO:
- ✅ Store API key in `.env` file (never commit to git)
- ✅ Use different keys for dev/staging/production
- ✅ Rotate keys periodically (every 3-6 months)
- ✅ Use project-specific keys for better tracking
- ✅ Set usage limits to prevent runaway costs
- ✅ Monitor usage regularly

### ❌ DON'T:
- ❌ Commit API keys to git (already in `.gitignore`)
- ❌ Share API keys in chat/email
- ❌ Use the same key for multiple projects
- ❌ Leave keys in code comments
- ❌ Expose keys in frontend code (already safe - backend only)

## Troubleshooting

### "Invalid API key" Error

1. **Check the key is correct:**
   - No extra spaces
   - Full key copied (starts with `sk-proj-` or `sk-`)
   - Key hasn't been revoked

2. **Verify organization access:**
   - Make sure you're still an Owner
   - Check the key wasn't deleted

3. **Check environment variable:**
   ```bash
   cd backend
   source venv/bin/activate
   python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('Key loaded:', 'Yes' if os.getenv('OPENAI_API_KEY') else 'No')"
   ```

### "Insufficient quota" Error

1. **Check organization limits:**
   - Go to Organization → Limits
   - Verify spending limits aren't exceeded
   - Check rate limits

2. **Check billing:**
   - Go to Organization → Billing
   - Verify payment method is valid

### Usage Not Showing Up

1. **Wait a few minutes** - usage can take time to appear
2. **Check the correct project** if using project-specific keys
3. **Verify the key is from the organization** (not personal account)

## Cost Optimization Tips

### Make the $100 Credit Last Longer

1. **Use appropriate models:**
   - `gpt-4o` for complex queries (current setting) - ~$0.01-0.03 per query
   - Consider `gpt-4o-mini` for simpler queries to save costs (~70% cheaper)
   - Use `gpt-3.5-turbo` for very simple tasks (if acceptable) - ~90% cheaper

2. **Estimate credit duration:**
   - With `gpt-4o`: ~3,000-10,000 queries depending on complexity
   - With `gpt-4o-mini`: ~10,000-30,000 queries
   - Monitor actual usage to predict when credit runs out

2. **Optimize prompts:**
   - Shorter prompts = lower costs
   - Use system prompts efficiently
   - Cache common responses when possible

3. **Set temperature appropriately:**
   - Lower temperature = more deterministic (and often cheaper)
   - Current: `temperature=0.2` (good for cost/quality balance)

4. **Monitor and adjust:**
   - Review usage patterns weekly
   - Identify high-cost operations
   - Optimize based on actual usage

## Next Steps

1. ✅ Create organization API key
2. ✅ Configure in `backend/.env`
3. ✅ Test the application
4. ⚠️ **Set up usage alerts** (especially credit low alert)
5. 📊 Monitor first week of usage to estimate credit duration
6. 🔔 Set spending limits for after credit is used
7. ✅ Adjust limits/alerts based on actual usage

## Quick Reference

- **Current credit**: $100 (will be used first)
- **After credit**: Charges to company card automatically
- **Monitor**: Organization → Usage dashboard
- **Set alerts**: Organization → Limits
- **Estimate**: ~3,000-10,000 queries with gpt-4o before credit runs out

## Notes

- **Organization keys** work exactly like personal keys - no code changes needed
- **Billing** goes to the organization's payment method automatically
- **Usage tracking** is available in the OpenAI dashboard
- **You can revoke/rotate keys** anytime from the dashboard
- **Multiple keys** can be active simultaneously (useful for dev/staging/prod)
