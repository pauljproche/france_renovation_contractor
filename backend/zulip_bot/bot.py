"""
Main Zulip bot service.

Listens for messages mentioning the bot, queries the FastAPI assistant,
and sends responses back to Zulip.
"""

import logging
import sys
from typing import Optional

try:
    import zulip
except ImportError:
    print("ERROR: zulip package not installed.")
    print("Please run: pip install -r requirements.txt")
    sys.exit(1)

from .config import load_config
from .api_client import load_materials_data, query_assistant


# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ContractorBot:
    """Zulip bot that connects to the renovation contractor AI assistant."""
    
    def __init__(self):
        """Initialize the bot with configuration."""
        try:
            self.config = load_config()
            logger.info(f"Configuration loaded for bot: {self.config['bot_name']}")
        except ValueError as e:
            logger.error(f"Configuration error: {e}")
            sys.exit(1)
        
        # Initialize Zulip client
        self.client = zulip.Client(
            email=self.config["email"],
            api_key=self.config["api_key"],
            site=self.config["site"]
        )
        logger.info("Zulip client initialized")
        
        # Load materials data once at startup
        try:
            self.materials_data = load_materials_data(self.config["materials_file_path"])
            logger.info("Materials data loaded successfully")
        except FileNotFoundError:
            logger.warning(f"Materials file not found: {self.config['materials_file_path']}")
            self.materials_data = None
        except Exception as e:
            logger.error(f"Error loading materials data: {e}")
            self.materials_data = None
        
        # Get bot's user ID for mention detection
        self.bot_user_id = None
        self._get_bot_user_id()
    
    def _get_bot_user_id(self):
        """Get the bot's user ID from Zulip."""
        try:
            result = self.client.get_members()
            if result.get("result") == "success":
                for user in result.get("members", []):
                    if user.get("email") == self.config["email"]:
                        self.bot_user_id = user.get("user_id")
                        logger.info(f"Bot user ID: {self.bot_user_id}")
                        return
            logger.warning("Could not find bot user in member list")
        except Exception as e:
            logger.error(f"Error getting bot user ID: {e}")
    
    def _is_bot_mentioned(self, message: dict) -> bool:
        """
        Check if the bot is mentioned in a message.
        
        Args:
            message: Zulip message dictionary
        
        Returns:
            bool: True if bot is mentioned
        """
        # Check for @-mentions
        if self.bot_user_id:
            mentions = message.get("mentions", [])
            if self.bot_user_id in mentions:
                return True
        
        # Also check if bot name appears in content
        content = message.get("content", "").lower()
        bot_name_lower = self.config["bot_name"].lower()
        if bot_name_lower in content:
            # Check if it's actually a mention (not just part of another word)
            # Simple check: look for @bot_name or bot_name at start/after space
            if f"@{bot_name_lower}" in content or f"**{bot_name_lower}**" in content:
                return True
        
        return False
    
    def _extract_query(self, message: dict) -> str:
        """
        Extract the user's query from a message, removing bot mentions.
        
        Args:
            message: Zulip message dictionary
        
        Returns:
            str: Extracted query text
        """
        content = message.get("content", "")
        
        # Remove bot mentions
        bot_name = self.config["bot_name"]
        # Remove @bot_name
        content = content.replace(f"@{bot_name}", "")
        # Remove **bot_name** (Zulip mention format)
        content = content.replace(f"**{bot_name}**", "")
        # Remove @**bot_name**
        content = content.replace(f"@**{bot_name}**", "")
        
        # Clean up whitespace
        content = content.strip()
        
        return content if content else "Hello"
    
    def _handle_message(self, message: dict):
        """
        Handle an incoming message that mentions the bot.
        
        Args:
            message: Zulip message dictionary
        """
        if not self._is_bot_mentioned(message):
            return
        
        logger.info(f"Bot mentioned in message from {message.get('sender_email', 'unknown')}")
        
        # Extract user query
        query = self._extract_query(message)
        logger.info(f"User query: {query}")
        
        # Get message metadata for response
        message_type = message.get("type", "stream")
        stream = message.get("display_recipient")
        topic = message.get("subject", "")
        message_id = message.get("id")
        
        logger.info(f"Message type: {message_type}, stream: {stream}, topic: {topic}")
        
        # Send "typing" indicator
        try:
            if message_type == "private":
                # Direct message
                self.client.set_typing_status({
                    "to": [message.get("sender_email")],
                    "op": "start"
                })
            else:
                # Stream message - display_recipient is the stream name (string)
                stream_name = stream if isinstance(stream, str) else str(stream)
                self.client.set_typing_status({
                    "to": stream_name,
                    "topic": topic,
                    "op": "start"
                })
        except Exception as e:
            logger.warning(f"Could not set typing status: {e}")
        
        try:
            # Query the assistant API
            logger.info("Querying assistant API...")
            response = query_assistant(
                api_base_url=self.config["api_base_url"],
                prompt=query,
                materials=self.materials_data,
                custom_tables=None  # Can be added later if needed
            )
            
            # Format response (use English for now, can add language detection later)
            answer = response.get("en", response.get("fr", "Sorry, I couldn't generate a response."))
            
            # Check if answer is empty
            if not answer or not answer.strip():
                logger.warning("Empty response from API, using fallback message")
                answer = "Sorry, I received an empty response. Please try rephrasing your question."
            
            # Format message for Zulip (support markdown)
            response_text = f"{answer}"
            
            logger.info(f"Prepared response (length: {len(response_text)}): {response_text[:100]}...")
            
            # Send response based on message type
            if message_type == "private":
                # Direct message
                logger.info(f"Sending private message to {message.get('sender_email')}")
                result = self.client.send_message({
                    "type": "private",
                    "to": message.get("sender_email"),
                    "content": response_text
                })
                logger.info(f"Send message result: {result}")
            else:
                # Stream message - display_recipient is the stream name (string)
                stream_name = stream if isinstance(stream, str) else str(stream)
                logger.info(f"Sending stream message to '{stream_name}', topic: '{topic}'")
                result = self.client.send_message({
                    "type": "stream",
                    "to": stream_name,
                    "topic": topic,
                    "content": response_text
                })
                logger.info(f"Send message result: {result}")
            
            logger.info("Response sent successfully")
            
        except Exception as e:
            logger.error(f"Error handling message: {e}", exc_info=True)
            
            # Send error message to user
            error_msg = "Sorry, I encountered an error processing your request. Please try again later."
            try:
                if message_type == "private":
                    self.client.send_message({
                        "type": "private",
                        "to": message.get("sender_email"),
                        "content": error_msg
                    })
                else:
                    stream_name = stream if isinstance(stream, str) else str(stream)
                    self.client.send_message({
                        "type": "stream",
                        "to": stream_name,
                        "topic": topic,
                        "content": error_msg
                    })
            except Exception as send_error:
                logger.error(f"Could not send error message: {send_error}")
        finally:
            # Stop typing indicator
            try:
                if message_type == "private":
                    self.client.set_typing_status({
                        "to": [message.get("sender_email")],
                        "op": "stop"
                    })
                else:
                    stream_name = stream if isinstance(stream, str) else str(stream)
                    self.client.set_typing_status({
                        "to": stream_name,
                        "topic": topic,
                        "op": "stop"
                    })
            except Exception as e:
                logger.warning(f"Could not stop typing status: {e}")
    
    def _handle_message_sync(self, event: dict):
        """
        Synchronous message handler wrapper.
        
        Args:
            event: Zulip event dictionary
        """
        if event.get("type") == "message":
            message = event.get("message", {})
            self._handle_message(message)
    
    def run(self):
        """Start the bot and listen for messages."""
        logger.info("Starting contractor bot...")
        logger.info(f"Bot will respond to mentions of: @{self.config['bot_name']}")
        logger.info("Press Ctrl+C to stop")
        
        try:
            # Register event handler
            self.client.call_on_each_event(
                self._handle_message_sync,
                event_types=["message"]
            )
        except KeyboardInterrupt:
            logger.info("Bot stopped by user")
        except Exception as e:
            logger.error(f"Error in bot event loop: {e}", exc_info=True)
            sys.exit(1)


def main():
    """Main entry point for the bot."""
    bot = ContractorBot()
    bot.run()


if __name__ == "__main__":
    main()

