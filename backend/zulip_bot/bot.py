"""
Main Zulip bot service.

Listens for messages mentioning the bot, queries the FastAPI assistant,
and sends responses back to Zulip.
"""

import logging
import sys
from typing import Optional, Any

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
    
    def _is_validation_question(self, query: str) -> bool:
        """
        Check if the query is asking about items needing validation (question) vs requesting validation (action).
        
        Args:
            query: User's query text
        
        Returns:
            bool: True if this is a validation question (not an action request)
        """
        query_lower = query.lower()
        
        # Check if it's an action request (user wants to validate/approve something)
        action_patterns = [
            'validate the', 'validate this', 'validate [', 'approve the', 'approve this',
            'can you validate', 'please validate', 'validate item', 'validate as'
        ]
        if any(pattern in query_lower for pattern in action_patterns):
            return False  # This is an action, not a question
        
        # Check if it's a question (user wants to know what needs validation)
        question_keywords = [
            'what needs', 'what items need', 'show me', 'list', 'which items',
            'items requiring', 'needs to validate', 'pending validation',
            'what requires', 'what should be validated'
        ]
        return any(keyword in query_lower for keyword in question_keywords)
    
    def _get_recent_messages(self, message_type: str, stream: Any, topic: str, current_message_id: int, limit: int = 5) -> str:
        """
        Get recent messages from the conversation for context.
        
        Args:
            message_type: Type of message ('stream' or 'private')
            stream: Stream name or recipient (email for private, name for stream)
            topic: Topic name (for stream messages)
            current_message_id: ID of current message
            limit: Number of recent messages to fetch
        
        Returns:
            str: Formatted conversation history
        """
        try:
            if message_type == "private":
                # For private messages, get recent messages with this user
                # stream is the email address for private messages
                recipient_email = stream[0] if isinstance(stream, list) else stream
                result = self.client.get_messages({
                    "anchor": current_message_id,
                    "num_before": limit,
                    "num_after": 0,
                    "narrow": [{"operator": "pm-with", "operand": recipient_email}]
                })
            else:
                # For stream messages, get recent messages in this topic
                stream_name = stream if isinstance(stream, str) else str(stream)
                result = self.client.get_messages({
                    "anchor": current_message_id,
                    "num_before": limit,
                    "num_after": 0,
                    "narrow": [
                        {"operator": "stream", "operand": stream_name},
                        {"operator": "topic", "operand": topic}
                    ]
                })
            
            if result.get("result") == "success":
                messages = result.get("messages", [])
                # Format conversation history (exclude current message)
                context_lines = []
                for msg in messages:
                    if msg.get("id") == current_message_id:
                        continue  # Skip current message
                    sender = msg.get("sender_full_name", msg.get("sender_email", "Unknown"))
                    content = msg.get("content", "").strip()
                    # Remove bot mentions to clean up
                    bot_name = self.config['bot_name']
                    content = content.replace(f"@{bot_name}", "").replace(f"**{bot_name}**", "").replace(f"@**{bot_name}**", "").strip()
                    if content:
                        context_lines.append(f"{sender}: {content}")
                
                if context_lines:
                    # Return last N messages, oldest first
                    return "\n".join(context_lines[-limit:])
        except Exception as e:
            logger.warning(f"Could not fetch conversation history: {e}")
        
        return ""
    
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
    
    def _format_zulip_message(self, text: str) -> str:
        """
        Format message text for Zulip with proper line breaks.
        Minimal formatting - only fixes obvious issues without breaking markdown.
        
        Args:
            text: Raw message text from LLM
            
        Returns:
            str: Properly formatted text for Zulip
        """
        if not text:
            return text
        
        import re
        
        # Remove HTML tags (LLM sometimes generates HTML instead of markdown)
        text = re.sub(r'<[^>]+>', '', text)  # Remove all HTML tags like <hr>, <br>, etc.
        
        # Normalize line breaks
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        
        # Only fix cases where elements are clearly on the same line
        # Pattern 1: Bullet point item ending, followed by section header on same line
        # e.g., "• item — status **Section:**" -> "• item — status\n**Section:**"
        # Be careful not to break bold markdown that's already correct
        text = re.sub(r'([•]\s[^•\n]+?—[^•\n]+?)(\*\*[^*]+\*\*)', r'\1\n\2', text)
        
        # Pattern 2: Bullet point followed by "Total:" on same line
        # e.g., "• item Total: 7" -> "• item\n\nTotal: 7"
        text = re.sub(r'([•]\s[^\n]+?)(Total:?\s)', r'\1\n\n\2', text, flags=re.IGNORECASE)
        
        # Pattern 3: Remove standalone "**" lines (broken bold markdown)
        lines = text.split('\n')
        cleaned_lines = []
        for line in lines:
            stripped = line.strip()
            # Skip lines that are just "**" or "***" (broken markdown)
            if stripped in ['**', '***', '****']:
                continue
            cleaned_lines.append(line)
        
        text = '\n'.join(cleaned_lines)
        
        # Clean up excessive blank lines (more than 2 consecutive)
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        return text.strip()
    
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
        is_validation_question = self._is_validation_question(query)
        logger.info(f"User query: {query} (validation question: {is_validation_question})")
        
        # Get message metadata for response
        message_type = message.get("type", "stream")
        stream = message.get("display_recipient")
        topic = message.get("subject", "")
        message_id = message.get("id")
        
        logger.info(f"Message type: {message_type}, stream: {stream}, topic: {topic}")
        
        # Get recent conversation history for context
        conversation_context = self._get_recent_messages(message_type, stream, topic, message_id, limit=5)
        
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
            
            # Add conversation context to the prompt if available
            enhanced_prompt = query
            if conversation_context:
                enhanced_prompt = f"Recent conversation:\n{conversation_context}\n\nCurrent request: {query}"
                logger.info(f"Added conversation context ({len(conversation_context)} chars)")
            
            response = query_assistant(
                api_base_url=self.config["api_base_url"],
                prompt=enhanced_prompt,
                materials=self.materials_data,
                custom_tables=None  # Can be added later if needed
            )
            
            # Get both English and French responses
            answer_en = response.get("en", "").strip()
            answer_fr = response.get("fr", "").strip()
            
            # Check if the English response already contains both EN and FR sections
            # (LLM sometimes generates both in one response)
            has_french_section = "Articles nécessitant" in answer_en or "Articles nécessitant" in answer_fr
            
            # If English response already contains French section, use it as-is
            if has_french_section and answer_en:
                answer = answer_en
            # If both are provided and different, combine them
            elif answer_en and answer_fr and answer_en != answer_fr:
                # Combine with blank line separator
                answer = f"{answer_en}\n\n{answer_fr}"
            elif answer_en:
                # Only English available
                answer = answer_en
            elif answer_fr:
                # Only French available
                answer = answer_fr
            else:
                # Neither available
                answer = "Sorry, I couldn't generate a response."
            
            # Check if answer is empty
            if not answer or not answer.strip():
                logger.warning("Empty response from API, using fallback message")
                answer = "Sorry, I received an empty response. Please try rephrasing your question."
            
            # If this was a validation question, log it for monitoring
            # (The LLM should have formatted it correctly based on the prompt)
            if is_validation_question:
                logger.info("Validation question detected - checking response format")
                # Check if response follows expected format (has section headers and bullet points)
                if "**Items requiring client validation:**" not in answer:
                    logger.warning("Validation question response may not be properly formatted")
            
            # Format message for Zulip (ensure proper line breaks for markdown)
            response_text = self._format_zulip_message(answer)
            
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

