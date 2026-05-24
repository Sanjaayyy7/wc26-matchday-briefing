import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  if (!client) client = new Anthropic();
  return client;
}

export type Msg = { role: "user" | "assistant"; content: string };

const MODEL = "claude-opus-4-7";

export function streamMessages(args: {
  system: string;
  messages: Msg[];
  maxTokens: number;
}): ReadableStream<Uint8Array> {
  const { system, messages, maxTokens } = args;
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Opus 4.7 deprecated `temperature` — must be omitted.
        const stream = getClient().messages.stream({
          model: MODEL,
          max_tokens: maxTokens,
          system,
          messages,
        });
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const status = (err as { status?: number | string })?.status ?? "unknown";
        controller.enqueue(
          encoder.encode(`\n\n__ERROR__:${status}:${message}`),
        );
        controller.close();
      }
    },
  });
}
