# JARVIS – Personal WhatsApp Assistant (starter)

This first milestone implements the Meta WhatsApp Cloud API webhook on Netlify:
- GET webhook verification (`hub.challenge`)
- POST webhook signature verification (`X-Hub-Signature-256`)
- sender allowlisting (fail-closed)
- inbound text-message handling
- Supabase-backed message idempotency
- basic WhatsApp text reply

**This is a webhook foundation, not the finished AI assistant.** Payments, bookings,
phone calls, AI tool execution and approval actions are intentionally not implemented
or enabled in this milestone.

## 1. Prerequisites

- A Meta developer app with WhatsApp product enabled
- A WhatsApp Business Platform phone number and Phone Number ID
- A Meta app secret
- A WhatsApp Cloud API access token
- A Supabase project
- A Netlify site connected to this repository

## 2. Install and run

```bash
npm install
cp .env.example .env
# Fill the variables in .env
npm run build
npm run dev
```

Netlify CLI serves the function locally at:
`http://localhost:8888/api/whatsapp/webhook`

## 3. Supabase setup

Run `supabase/migrations/202611110001_whatsapp_webhook_events.sql` in the Supabase SQL editor.

## 4. Configure environment variables in Netlify

Set these in Site configuration → Environment variables, with Functions/runtime scope:

- `WHATSAPP_VERIFY_TOKEN`: a long random secret you create
- `WHATSAPP_APP_SECRET`: Meta app secret
- `WHATSAPP_ACCESS_TOKEN`: WhatsApp Cloud API access token
- `WHATSAPP_PHONE_NUMBER_ID`: Meta phone number ID
- `WHATSAPP_GRAPH_API_VERSION`: a currently supported Graph API version
- `WHATSAPP_ALLOWED_NUMBERS`: your verified personal number in digits-only international format
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Redeploy after changing environment variables. Never commit `.env` or expose the Supabase service-role key in browser code.

## 5. Configure Meta webhook

Callback URL:
`https://YOUR-NETLIFY-SITE.netlify.app/api/whatsapp/webhook`

Verify token:
the exact value of `WHATSAPP_VERIFY_TOKEN`

Subscribe to the `messages` webhook field. Meta sends a GET verification request first, then POST event notifications.

## 6. Test

1. Confirm the Netlify function is deployed.
2. Configure the callback URL and verify token in Meta.
3. Add your own number to `WHATSAPP_ALLOWED_NUMBERS`.
4. Send a text message to the new WhatsApp Business number.
5. Confirm that JARVIS replies once. Duplicate delivery of the same WhatsApp message ID is ignored.

## 7. Safety boundary

The webhook only acknowledges inbound messages and sends a fixed setup-mode reply. It cannot make purchases,
book tickets, transfer money, or place calls. Those features must be added behind server-side,
single-use, expiring approvals tied to an immutable action payload, with a fresh confirmation
if price, recipient, date, passenger, or other material details change.
