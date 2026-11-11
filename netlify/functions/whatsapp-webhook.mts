import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

type WhatsAppMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
};

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
};

const env = (key: string): string => process.env[key]?.trim() ?? "";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function isAllowed(sender: string): boolean {
  const allowed = env("WHATSAPP_ALLOWED_NUMBERS")
    .split(",")
    .map((n) => n.replace(/\D/g, ""))
    .filter(Boolean);
  return allowed.length > 0 && allowed.includes(sender.replace(/\D/g, ""));
}

function validSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = env("WHATSAPP_APP_SECRET");
  if (!appSecret || !signature?.startsWith("sha256=")) return false;

  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex"),
  );
  const received = Buffer.from(signature);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = env("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID");
  const version = env("WHATSAPP_GRAPH_API_VERSION");

  if (!token || !phoneNumberId || !version) {
    throw new Error("WhatsApp Cloud API credentials are not configured.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${detail}`);
  }
}

async function claimMessage(message: WhatsAppMessage): Promise<boolean> {
  const url = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

  // Fail closed: deduplication must be available before sending a reply.
  if (!url || !serviceKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("whatsapp_webhook_events")
    .upsert(
      {
        message_id: message.id,
        sender: message.from,
        message_type: message.type,
      },
      { onConflict: "message_id", ignoreDuplicates: true },
    )
    .select("message_id");

  if (error) throw new Error(`Webhook event persistence failed: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

function extractMessages(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
  return (payload.entry ?? []).flatMap((entry) =>
    (entry.changes ?? []).flatMap((change) => change.value?.messages ?? []),
  );
}

export default async (request: Request): Promise<Response> => {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      token &&
      challenge &&
      env("WHATSAPP_VERIFY_TOKEN") &&
      token === env("WHATSAPP_VERIFY_TOKEN")
    ) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new Response("Forbidden", { status: 403 });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const rawBody = await request.text();

  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return json({ error: "Invalid webhook signature" }, 401);
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return json({ error: "Invalid JSON payload" }, 400);
  }

  // Meta sends status callbacks as well as inbound messages.
  const messages = extractMessages(payload);

  for (const message of messages) {
    if (!message.id || !message.from || !isAllowed(message.from)) continue;

    try {
      const firstDelivery = await claimMessage(message);
      if (!firstDelivery) continue;

      let reply: string;
      if (message.type === "text" && message.text?.body) {
        reply =
          "Vanakkam! I'm JARVIS, your personal assistant. I received your message. " +
          "I'm currently in setup mode; booking, payment and calling actions are disabled until the approval system is configured.";
      } else {
        reply =
          "I received your message. For this first version, please send a text message. Voice-note support will be added in a later stage.";
      }

      await sendWhatsAppText(message.from, reply);
    } catch (error) {
      // Do not log access tokens, message contents, or full request headers.
      console.error("JARVIS webhook processing failed:", error instanceof Error ? error.message : "Unknown error");
    }
  }

  return json({ received: true });
};

export const config = {
  path: "/api/whatsapp/webhook",
};
