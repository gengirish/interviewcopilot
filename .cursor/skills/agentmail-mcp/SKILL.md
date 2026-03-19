---
name: agentmail-mcp
description: Integrate AgentMail MCP to give TurfStack AI agents their own email inboxes for sending transactional emails (registration confirmations, booking receipts, tournament notifications) and building email-driven workflows. Use when adding email sending, email inboxes, automated notifications, or any email communication feature to TurfStack.
---

# AgentMail MCP — TurfStack Integration

AgentMail provides programmable email inboxes for AI agents via MCP. In TurfStack, use it to send transactional emails and build automated email workflows.

## MCP Setup

Add to `.cursor/mcp.json` (or Cursor MCP settings):

```json
{
  "mcpServers": {
    "AgentMail": {
      "command": "npx",
      "args": ["-y", "agentmail-mcp"],
      "env": {
        "AGENTMAIL_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

Get an API key at [console.agentmail.to](https://console.agentmail.to/).

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `create_inbox` | Create a new email inbox (e.g. `notifications@agentmail.to`) |
| `list_inboxes` | List all inboxes |
| `send_message` | Send an email from an inbox |
| `get_message` | Read a specific email |
| `list_messages` | List messages in an inbox |
| `reply_to_message` | Reply to an existing thread |

Use `--tools` to load only what you need:
```json
"args": ["-y", "agentmail-mcp", "--tools", "send_message,list_messages"]
```

## TurfStack Use Cases

### 1. Registration Confirmation
Send a welcome email after `POST /auth/register` succeeds.

```python
# backend/src/sfms/services/email_service.py
import httpx, os

AGENTMAIL_API_KEY = os.getenv("AGENTMAIL_API_KEY")
FROM_INBOX = os.getenv("AGENTMAIL_FROM_INBOX", "noreply@agentmail.to")
BASE_URL = "https://api.agentmail.to/v0"

async def send_registration_email(to_email: str, full_name: str):
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{BASE_URL}/inboxes/{FROM_INBOX}/messages",
            headers={"Authorization": f"Bearer {AGENTMAIL_API_KEY}"},
            json={
                "to": [{"email": to_email}],
                "subject": "Welcome to TurfStack!",
                "text": f"Hi {full_name}, your account is ready. Start exploring venues: https://turfstack.vercel.app/venues",
                "html": f"<p>Hi <strong>{full_name}</strong>,</p><p>Your TurfStack account is ready. <a href='https://turfstack.vercel.app/venues'>Explore venues →</a></p>"
            }
        )
```

### 2. Booking Confirmation
After a booking is created, send receipt with court, time, and payment details.

### 3. Tournament Registration
Notify team when they register for a tournament, include bracket info when available.

## Backend Integration Pattern

1. Add `AGENTMAIL_API_KEY` and `AGENTMAIL_FROM_INBOX` to Fly.io secrets:
   ```bash
   fly secrets set AGENTMAIL_API_KEY="sk_..." AGENTMAIL_FROM_INBOX="noreply@agentmail.to"
   ```

2. Create `backend/src/sfms/services/email_service.py` with async send functions.

3. Call from routers **after** the main operation succeeds — email failure should never block the primary action:
   ```python
   # In auth.py register endpoint
   await db.commit()
   # Fire-and-forget — don't await, don't fail on error
   asyncio.create_task(send_registration_email(req.email, req.full_name))
   ```

4. Add `httpx` to `backend/pyproject.toml` dependencies if not already present.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENTMAIL_API_KEY` | API key from console.agentmail.to |
| `AGENTMAIL_FROM_INBOX` | Sender inbox address (create once via API or console) |

## Key Constraints

- Email sending is **fire-and-forget** — never block user-facing requests on email delivery
- Create the sender inbox once via the AgentMail console; don't recreate per request
- For high volume, use a dedicated inbox per email type (bookings, auth, tournaments)
- AgentMail is for **two-way** agent inboxes; for pure transactional sends, the REST API is simpler than the MCP
