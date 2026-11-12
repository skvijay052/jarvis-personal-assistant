import "dotenv/config";
import { createInMemoryTracer, systemClock } from "@wappy_ai/core";
import {
  createAgent,
  createKnowledge,
  createKnowledgeRag,
  createLibsqlMemory,
  createLibsqlSessionProfileStore,
  createLlmRouter,
  createVercelModel,
} from "@wappy_ai/harness";
import { createWhatsAppChannel } from "@wappy_ai/whatsapp";
import { createClient } from "@libsql/client";
import { google } from "@ai-sdk/google";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const phoneNumberId = required("WHATSAPP_PHONE_NUMBER_ID");
const accessToken = required("WHATSAPP_ACCESS_TOKEN");
required("WHATSAPP_VERIFY_TOKEN");
required("WHATSAPP_APP_SECRET");
required("GOOGLE_GENERATIVE_AI_API_KEY");

// Keep this personal assistant private. An empty allowlist is a startup error (fail closed).
const allowedSenders = new Set(
  required("WHATSAPP_ALLOWED_NUMBERS")
    .split(",")
    .map((value) => value.replace(/\D/g, ""))
    .filter(Boolean),
);
if (allowedSenders.size === 0) {
  throw new Error("WHATSAPP_ALLOWED_NUMBERS must contain at least one phone number.");
}

const model = createVercelModel({
  model: google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash"),
  timeoutMs: 45_000,
  maxRetries: 2,
});

const memory = createLibsqlMemory({
  url: process.env.MEMORY_DB_URL ?? "file:.wappy/memory.db",
});
const sessionProfileStore = createLibsqlSessionProfileStore({
  url: process.env.SESSION_PROFILE_DB_URL ?? "file:.wappy/session-profile.db",
});
const knowledgeClient = createClient({
  url: process.env.KNOWLEDGE_DB_URL ?? "file:.wappy/knowledge.db",
});
const knowledge = createKnowledge({ client: knowledgeClient });
const retrieveRag = createKnowledgeRag({ knowledge, memory });
const router = createLlmRouter({ model });
const tracer = createInMemoryTracer();

const whatsappChannel = createWhatsAppChannel({
  phoneNumberId,
  accessToken,
  graphApiBaseUrl: `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0"}`,
  ownNumberOnly: true,
  clock: systemClock,
});

// Filter unauthorized contacts before they enter the agent or its memory.
// Spread preserves WhatsApp's markReadAndTyping helper for the SDK webhook dispatcher.
export const channel = {
  ...whatsappChannel,
  async receive(rawWebhook: unknown) {
    const messages = await whatsappChannel.receive(rawWebhook);
    return messages.filter((message) =>
      allowedSenders.has(message.contactId.replace(/\D/g, "")),
    );
  },
};

export const agent = createAgent({
  channel,
  memory,
  router,
  model,
  tracer,
  clock: systemClock,
  sessionProfileStore,
  retrieveRag,
});
