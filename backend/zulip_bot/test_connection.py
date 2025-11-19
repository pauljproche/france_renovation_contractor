"""
Test script to verify Zulip connection and basic setup.

This script:
1. Loads Zulip configuration from environment variables
2. Initializes Zulip client
3. Verifies connection to Zulip server
4. Listens for test messages mentioning the bot
5. Prints connection status and received messages

Usage:
    python zulip_bot/test_connection.py

Environment variables required:
    ZULIP_EMAIL: Bot email address (e.g., bot@yourdomain.com)
    ZULIP_API_KEY: Bot API key from Zulip
    ZULIP_SITE: Zulip server URL (e.g., https://your-zulip-instance.com)
    ZULIP_BOT_NAME: Bot name/username (optional, for mention detection)
"""

import os
import sys
import time
from dotenv import load_dotenv

try:
    import zulip
except ImportError:
    print("ERROR: zulip package not installed.")
    print("Please run: pip install -r requirements.txt")
    sys.exit(1)


def load_config():
    """Load configuration from environment variables."""
    # Load .env file from backend directory
    import os as os_module
    backend_dir = os_module.path.dirname(os_module.path.dirname(os_module.path.abspath(__file__)))
    env_path = os_module.path.join(backend_dir, '.env')
    # Try loading from backend/.env first, then fall back to default behavior
    if os_module.path.exists(env_path):
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()  # Fall back to default search
    
    email = os.getenv("ZULIP_EMAIL")
    api_key = os.getenv("ZULIP_API_KEY")
    site = os.getenv("ZULIP_SITE")
    bot_name = os.getenv("ZULIP_BOT_NAME", "contractor_bot")
    
    if not email:
        print("ERROR: ZULIP_EMAIL environment variable not set")
        sys.exit(1)
    if not api_key:
        print("ERROR: ZULIP_API_KEY environment variable not set")
        sys.exit(1)
    if not site:
        print("ERROR: ZULIP_SITE environment variable not set")
        sys.exit(1)
    
    # Strip https:// or http:// from site URL if present
    # Zulip client expects just the domain name
    site = site.replace("https://", "").replace("http://", "").rstrip("/")
    
    return {
        "email": email,
        "api_key": api_key,
        "site": site,
        "bot_name": bot_name
    }


def test_connection(config):
    """Test Zulip connection and print status."""
    print("=" * 60)
    print("Zulip Connection Test")
    print("=" * 60)
    print(f"Site: {config['site']}")
    print(f"Email: {config['email']}")
    print(f"Bot Name: {config['bot_name']}")
    # Show first 6 and last 4 chars of API key for verification (security: don't show full key)
    api_key_preview = config['api_key'][:6] + "..." + config['api_key'][-4:] if len(config['api_key']) > 10 else "***"
    print(f"API Key (preview): {api_key_preview}")
    print("-" * 60)
    
    try:
        # Initialize Zulip client
        print("\n[1/4] Initializing Zulip client...")
        client = zulip.Client(
            email=config["email"],
            api_key=config["api_key"],
            site=config["site"]
        )
        print("✓ Client initialized")
        
        # Get bot's own profile to verify connection
        print("\n[2/4] Verifying connection to Zulip server...")
        try:
            result = client.get_profile()
            print(f"  Debug: Response = {result}")  # Debug output
            if result.get("result") == "success":
                profile = result
                print("✓ Connection successful!")
                print(f"  User ID: {profile.get('user_id', 'N/A')}")
                print(f"  Full Name: {profile.get('full_name', 'N/A')}")
                print(f"  Email: {profile.get('email', 'N/A')}")
            else:
                print(f"✗ Connection failed: Unexpected response - {result}")
                return False
        except Exception as e:
            print(f"✗ Connection failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
        
        # Get bot's user ID for mention detection
        print("\n[3/4] Getting bot user information...")
        try:
            users_result = client.get_members()
            if users_result["result"] == "success":
                bot_user = None
                for user in users_result.get("members", []):
                    if user.get("email") == config["email"]:
                        bot_user = user
                        break
                
                if bot_user:
                    bot_user_id = bot_user.get("user_id")
                    print(f"✓ Bot user ID: {bot_user_id}")
                    print(f"  Bot can be mentioned as: @{bot_user.get('full_name', config['bot_name'])}")
                else:
                    print("⚠ Warning: Could not find bot user in member list")
                    bot_user_id = None
            else:
                print("⚠ Warning: Could not retrieve user list")
                bot_user_id = None
        except Exception as e:
            print(f"⚠ Warning: Could not get user info: {str(e)}")
            bot_user_id = None
        
        # Test message reception
        print("\n[4/4] Testing message reception...")
        print("  Listening for messages (30 seconds timeout)...")
        print(f"  Send a message mentioning the bot in any stream to test.")
        print("  Press Ctrl+C to stop early.\n")
        
        # Register event handler
        def handle_message(event):
            """Handle incoming messages."""
            if event["type"] == "message":
                message = event["message"]
                content = message.get("content", "")
                sender_email = message.get("sender_email", "")
                stream = message.get("display_recipient", "")
                topic = message.get("subject", "")
                
                # Check if bot is mentioned
                is_mention = False
                if bot_user_id:
                    # Check for @-mentions
                    mentions = message.get("mentions", [])
                    if bot_user_id in mentions:
                        is_mention = True
                
                # Also check if bot name appears in content
                if not is_mention and config["bot_name"].lower() in content.lower():
                    is_mention = True
                
                print(f"\n{'=' * 60}")
                print("MESSAGE RECEIVED")
                print(f"{'=' * 60}")
                print(f"From: {sender_email}")
                print(f"Stream: {stream}")
                print(f"Topic: {topic}")
                print(f"Mentions bot: {'Yes' if is_mention else 'No'}")
                print(f"Content: {content[:200]}..." if len(content) > 200 else f"Content: {content}")
                print(f"{'=' * 60}\n")
                
                if is_mention:
                    print("✓ SUCCESS: Bot mention detected!")
                    print("  Connection test complete. Bot is ready for integration.")
                    return True
            
            return False
        
        # Subscribe to all messages
        print("  Subscribing to message stream...")
        callback = lambda event: handle_message(event)
        
        # Run event loop for 30 seconds
        print("  Waiting for messages...\n")
        client.call_on_each_event(callback, event_types=["message"], timeout=30)
        
        print("\n" + "=" * 60)
        print("Test completed (timeout reached)")
        print("=" * 60)
        print("✓ Connection is working!")
        print("  If you sent a message and didn't see it, check:")
        print("  - Bot has access to the stream/channel")
        print("  - Message actually mentioned the bot")
        print("  - Bot account is properly configured")
        
        return True
        
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user.")
        print("✓ Connection test completed (interrupted)")
        return True
    except Exception as e:
        print(f"\n✗ Error during test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function."""
    print("\n")
    config = load_config()
    success = test_connection(config)
    
    print("\n" + "=" * 60)
    if success:
        print("RESULT: Connection test PASSED")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Verify bot has access to the streams you want to use")
        print("2. Test mentioning the bot in a message")
        print("3. Proceed to Phase 2: Basic Bot Setup")
        sys.exit(0)
    else:
        print("RESULT: Connection test FAILED")
        print("=" * 60)
        print("\nPlease check:")
        print("1. Zulip server URL is correct")
        print("2. Bot API key is valid")
        print("3. Bot email matches the API key")
        print("4. Network connectivity to Zulip server")
        sys.exit(1)


if __name__ == "__main__":
    main()

