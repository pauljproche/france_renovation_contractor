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
        
        Based on the system prompt:
        - Questions: "what items need to be validated?", "show me items requiring validation"
        - Actions: "validate [item] as [role]", "approve [item] as [role]"
        
        Args:
            query: User's query text
            
        Returns:
            bool: True if this is a validation question (not an action request)
        """
        query_lower = query.lower()
        
        # Check if it's an action request (user wants to validate/approve something)
        # Pattern: "validate [item] as [role]" or "approve [item] as [role]"
        action_patterns = [
            'validate the', 'validate this', 'validate [', 
            'approve the', 'approve this', 'approve [',
            'can you validate', 'please validate', 
            'validate as', 'approve as',
            # Also check for patterns with role specification
            'validate', 'approve'  # These followed by "as" indicate action
        ]
        
        # More specific check: if "validate" or "approve" is followed by "as", it's an action
        if any(pattern in query_lower for pattern in action_patterns):
            # Check if it's followed by "as [role]" which indicates an action
            if ' as ' in query_lower or ' as ' in query_lower:
                return False  # This is an action, not a question
            # If validate/approve appears but not with "as", check if it's a question pattern
            if any(q in query_lower for q in ['what', 'which', 'show', 'list', 'needs to', 'requiring']):
                return True  # This is a question
        
        # Check if it's a question (user wants to know what needs validation)
        # Based on system prompt: "what items need to be validated?", "show me items requiring validation"
        question_keywords = [
            'what needs', 'what items need', 'show me', 'list', 'which items',
            'items requiring', 'needs to validate', 'pending validation',
            'what requires', 'what should be validated',
            'what needs to be validated', 'what does', 'what have to'
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
        Handles the response format from system prompt: EN: and FR: markers.
        Minimal formatting - only fixes obvious issues without breaking markdown.
        
        Based on system prompt requirements:
        - Responses should have "EN:" and "FR:" markers
        - Use plain text or markdown formatting only
        - No HTML tags
        - Proper blank lines between sections
        
        Args:
            text: Raw message text from LLM (may contain EN:/FR: markers)
            
        Returns:
            str: Properly formatted text for Zulip
        """
        if not text:
            return text
        
        import re
        
        # Remove HTML tags (system prompt says: DO NOT use HTML tags like <hr>, <br>, etc.)
        text = re.sub(r'<[^>]+>', '', text)
        
        # Normalize line breaks
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        
        # Handle EN:/FR: markers if present (system prompt format)
        # Remove markers since Zulip will display the full message
        # But preserve the structure (blank line between languages)
        text = re.sub(r'^EN:\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'^FR:\s*', '', text, flags=re.MULTILINE)
        
        # Fix formatting issues per system prompt requirements
        # Pattern 1: Bullet point item ending, followed by section header on same line
        # System prompt: "Each section header on its own line"
        # e.g., "• item — status **Section:**" -> "• item — status\n**Section:**"
        text = re.sub(r'([•]\s[^•\n]+?—[^•\n]+?)(\*\*[^*]+\*\*)', r'\1\n\2', text)
        
        # Pattern 2: Bullet point followed by "Total:" on same line
        # System prompt: "One blank line before 'Total:'"
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
        # System prompt: "One blank line between sections"
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
            # Reload materials data to ensure we have the latest data
            try:
                self.materials_data = load_materials_data(self.config["materials_file_path"])
                # Log data summary for debugging
                if self.materials_data and self.materials_data.get("sections"):
                    total_items = sum(len(s.get("items", [])) for s in self.materials_data["sections"])
                    logger.info(f"Materials data reloaded: {len(self.materials_data['sections'])} sections, {total_items} total items")
            except Exception as e:
                logger.warning(f"Failed to reload materials data, using cached data: {e}")
                # Continue with cached data if reload fails
            
            # Query the assistant API
            logger.info("Querying assistant API...")
            
            # Add conversation context to the prompt if available
            # Per system prompt: For confirmations, extract from ORIGINAL request in conversation context
            # BUT: For validation questions, don't include context to ensure systematic checking
            enhanced_prompt = query
            if conversation_context and not is_validation_question:
                # Include context for actions/confirmations (system prompt: "Look at conversation context")
                enhanced_prompt = f"Recent conversation:\n{conversation_context}\n\nCurrent request: {query}"
                logger.info(f"Added conversation context ({len(conversation_context)} chars)")
            elif conversation_context and is_validation_question:
                # System prompt: "Go through EVERY section" - context might cause LLM to skip items
                logger.info("Skipping conversation context for validation question to ensure systematic checking of ALL items")
            
            response = query_assistant(
                api_base_url=self.config["api_base_url"],
                prompt=enhanced_prompt,
                materials=self.materials_data,
                custom_tables=None  # Can be added later if needed
            )
            
            # Get both English and French responses
            # The backend now returns responses in format: {"answer": "...", "answer_fr": "..."}
            # These are parsed from the LLM's response which should have "EN:" and "FR:" markers
            answer_en = response.get("en", "").strip()
            answer_fr = response.get("fr", "").strip()
            
            # Check if the response already contains both EN and FR sections in the format
            # This can happen if the LLM includes both languages in one response
            # Format should be: "EN: [text]\n\nFR: [text]" per system prompt
            has_en_marker = answer_en.startswith("EN:") or "\nEN:" in answer_en
            has_fr_marker = answer_fr.startswith("FR:") or "\nFR:" in answer_fr or "FR:" in answer_en
            
            # Check if English response already contains French section (old format or combined response)
            has_french_section = "Articles nécessitant" in answer_en or "Articles nécessitant" in answer_fr
            
            # If response already contains both languages in one string, use it as-is
            if has_french_section and answer_en and (has_en_marker or has_fr_marker):
                # Remove EN:/FR: markers if present since Zulip will display both
                answer = answer_en.replace("EN:", "").replace("FR:", "").strip()
            elif has_french_section and answer_en:
                # Old format with both languages combined
                answer = answer_en
            # If both are provided separately and different, combine them
            elif answer_en and answer_fr and answer_en != answer_fr:
                # Remove markers if present
                en_clean = answer_en.replace("EN:", "").strip()
                fr_clean = answer_fr.replace("FR:", "").strip()
                # Combine with blank line separator (matching system prompt format)
                answer = f"{en_clean}\n\n{fr_clean}"
            elif answer_en:
                # Only English available, remove marker if present
                answer = answer_en.replace("EN:", "").strip()
            elif answer_fr:
                # Only French available, remove marker if present
                answer = answer_fr.replace("FR:", "").strip()
            else:
                # Neither available
                answer = "Sorry, I couldn't generate a response."
            
            # Check if answer is empty
            if not answer or not answer.strip():
                logger.warning("Empty response from API, using fallback message")
                answer = "Sorry, I received an empty response. Please try rephrasing your question."
            
            # If this was a validation question, log it for monitoring
            # (The LLM should have formatted it correctly based on the system prompt)
            if is_validation_question:
                logger.info("Validation question detected - checking response format")
                # Check if response follows expected format from system prompt
                # Should have section headers like "**Items requiring [CLIENT/CRAY] validation:**"
                has_validation_format = (
                    "**Items requiring" in answer or 
                    "**Articles nécessitant" in answer or
                    "Items requiring" in answer
                )
                if not has_validation_format:
                    logger.warning("Validation question response may not follow expected format from system prompt")
                # Check for role-specific validation (client vs cray)
                if "client" in query.lower() and "cray" in answer.lower() and "client" not in answer.lower():
                    logger.warning("Possible role mismatch: query mentions client but response may reference cray")
                elif "cray" in query.lower() and "client" in answer.lower() and "cray" not in answer.lower():
                    logger.warning("Possible role mismatch: query mentions cray but response may reference client")
            
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

