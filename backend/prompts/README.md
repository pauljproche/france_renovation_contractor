# System Prompts

This directory contains system prompts used by the renovation contractor assistant.

## Files

- `system_prompt.md` - Main system prompt for the assistant. This defines the behavior, rules, and instructions for the LLM when handling user queries.

## Usage

The system prompt is automatically loaded by the backend API (`main.py`) when processing assistant queries. The prompt is loaded from `system_prompt.md` using the `load_system_prompt()` function.

## Editing the Prompt

You can edit `system_prompt.md` directly. The changes will take effect the next time the backend processes a request (no restart needed if using `--reload` mode with uvicorn).

## Format

The prompt is written in Markdown format. The LLM can understand Markdown formatting, so you can use:
- Headers (`##`, `###`)
- Bold text (`**text**`)
- Lists (`-`, `*`)
- Code blocks (`` `code` ``)

## Fallback

If the prompt file is not found, the system will use a minimal fallback prompt and log a warning.

