# JARVIS Wappy Agent (Gemini)

This is the persistent WhatsApp AI agent service for the JARVIS repository. It uses the Wappy SDK packages and Google Gemini. The existing Netlify site and its current webhook remain available while this separate service is prepared.

## Local development

Requirements: Node.js 22+.

```sh
cd agent
cp .env.sample .env
# Fill in Gemini and Meta WhatsApp credentials in .env
npm install
npm run dev
```

The Wappy development command prints a temporary public webhook URL ending in `/webhook`. Keep the process running and configure that URL in Meta. For a production host, use `npm start`; it disables Wappy's temporary tunnel and listens on the host-provided `PORT`.

## Gemini

Create an API key at https://aistudio.google.com/apikey and set `GOOGLE_GENERATIVE_AI_API_KEY`. The default model is `gemini-2.5-flash`; override it with `GEMINI_MODEL` if needed.

## WhatsApp credentials

In Meta for Developers, open your app's WhatsApp API Setup and copy the Phone Number ID and access token. Copy the App Secret from App Settings → Basic. Choose a strong random verify token and use the same value in Meta's webhook configuration.

Subscribe the WhatsApp webhook to the `messages` field. The production callback URL is:

`https://YOUR-RENDER-SERVICE.onrender.com/webhook`

The Wappy server handles the GET verification handshake and verifies POST signatures using the Meta App Secret.

## Privacy and safety

- The sender allowlist is required. The service refuses to start if `WHATSAPP_ALLOWED_NUMBERS` is empty.
- Only allowlisted senders enter the AI agent and conversation memory.
- Memory, session profile and knowledge databases use the persistent disk at `/var/data` in Render.
- No payments, ticket purchases, outbound calls, or external write-actions are registered. This initial integration is conversational only.
- Do not commit `.env` or paste API keys into chat or GitHub issues.

## Deploy on Render

The repository root contains `render.yaml`. In Render, choose **New → Blueprint**, connect this repository, and select the blueprint. Add the six secret environment values when prompted. The blueprint uses a small paid web service and a persistent disk so local SQLite/LibSQL memory survives restarts.

After Render deploys, update Meta's webhook callback URL to the Render URL above and verify it with the same `WHATSAPP_VERIFY_TOKEN`. Keep the existing Netlify webhook configured until the new endpoint is verified; then switch Meta to the Render URL. Netlify's old webhook remains in the repository as a rollback path.
