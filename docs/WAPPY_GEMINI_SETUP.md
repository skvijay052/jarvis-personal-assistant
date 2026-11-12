# JARVIS + Wappy + Gemini setup

## Architecture

- The existing Netlify site and its current signed webhook remain intact.
- `agent/` is a separate, persistent Node.js 22 service using Wappy's `@wappy_ai/*` packages.
- Google Gemini powers the agent through `@ai-sdk/google`.
- LibSQL stores chat history, session profiles and retrieved knowledge on a persistent disk.
- The Wappy webhook verifies Meta's signature and handles WhatsApp Cloud API replies.
- A required sender allowlist filters contacts before they reach the agent or memory.

## Local run

See [agent/README.md](../agent/README.md). Run `npm install` and `npm run dev` from `agent/`.

## Render production deployment

1. Open Render and choose **New → Blueprint**.
2. Connect `skvijay052/jarvis-personal-assistant` and select its `render.yaml`.
3. Supply the six secret values: Gemini API key, WhatsApp Phone Number ID, access token, verify token, App Secret, and your own allowed WhatsApp number.
4. Wait for the service to become live. Render's generated service hostname is the webhook host.
5. In Meta → WhatsApp → Configuration, set callback URL to `https://YOUR-SERVICE.onrender.com/webhook`, enter the exact verify token, verify, and subscribe to `messages`.
6. Send a text message from the allowlisted number to the WhatsApp Business number.

Do not switch Meta's webhook from the existing Netlify URL until the Render endpoint is live and the verification handshake succeeds.

## Notes

- Render's persistent disk is intentional: the default local database files must survive deploys and restarts.
- This blueprint uses a paid Starter service because persistent disks are not available on Render's free web-service tier.
- The initial agent is chat-only. No purchase, payment, booking, or calling tools are exposed.
- Never commit credentials. Configure them only in Render's environment settings or local ignored `.env`.
