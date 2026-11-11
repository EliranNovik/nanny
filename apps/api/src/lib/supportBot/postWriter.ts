import { streamChatCompletion, type OpenAiChatMessage } from "./openaiClient";
import { loadSupportKnowledge } from "./supportBotKnowledge";
import { loadSupportMemories } from "./supportBotMemory";
import { userProfileSummary } from "./supportBotProfile";

export type PostWriterType = "community" | "event" | "request" | "offer";

/** Post types whose form has a title field. */
const HAS_TITLE: Record<PostWriterType, boolean> = {
  community: true,
  event: true,
  request: false,
  offer: false,
};

export type PostWriterTurn = {
  role: "user" | "assistant";
  content: string;
  /** The title and post an assistant turn produced, so revisions start from them. */
  title?: string;
  post?: string;
};

function turnText(turn: PostWriterTurn): string {
  if (turn.role === "user") return turn.content.slice(0, 3000);
  const parts = [`<reply>\n${turn.content.slice(0, 1500)}\n</reply>`];
  if (turn.title) parts.push(`<title>${turn.title.slice(0, TITLE_MAX_CHARS)}</title>`);
  if (turn.post) parts.push(`<post>\n${turn.post.slice(0, 1000)}\n</post>`);
  return parts.join("\n");
}

export type PostWriterDraft = {
  title?: string;
  description?: string;
  eventDate?: string;
  eventTime?: string;
  location?: string;
  helpersNeeded?: string;
  /** Other form answers, label to value (category, budget, when, ...). */
  details?: Record<string, string>;
};

export type PostWriterEvent =
  | { type: "reply"; text: string }
  | { type: "title"; text: string }
  | { type: "post"; text: string };

export const POST_MAX_CHARS = 500;
export const TITLE_MAX_CHARS = 80;

const TYPE_GUIDE: Record<PostWriterType, string> = {
  community: `They are writing a **Community Post**: a note for people nearby, not a job. It appears on Feed with a Title and a description.
Good community posts: a question to neighbours ("Where are the next meetups in Tel Aviv?"), a check-in ("How is everyone doing this week?"), local news, a recommendation, a lost-and-found, an invitation to share. The first line says what it is about. End with one clear, friendly ask so people know how to reply.`,
  event: `They are writing an **Event**: a gathering or a call for helpers. It appears on Feed with an Event Name and a description. The form has its own fields for date, time, place, and how many helpers are needed.
Good event posts: what it is, who it is for, what to bring or expect, and how to join or reply. Use the date, time, and place from the draft when they are filled in. Do not invent a date, time, place, price, or number of helpers. When one matters and is missing, leave it out of the text and mention once in your reply that they can fill it in the form.`,
  request: `They are writing a **help request**: they need someone nearby to do a task. The form already has its own fields for the category, place, when, and budget, shown below when filled in. You write only the description, the free text helpers read before they respond.
Good request descriptions: the task in the first line, the details a helper needs to decide (size, how many, what is included, anything special like pets, stairs, tools, or languages), and one friendly line on how to respond. Do not repeat the place, date, or budget as a list; mention them only when it helps the sentence. Do not invent details they did not give.`,
  offer: `They are writing a **service offer**: they can help people nearby. The form already has its own fields for the service, area, and rate, shown below when filled in. You write only the description, the free text people read before they message.
Good offer descriptions: what they do in the first line, their experience or what makes them reliable (only what they told you), what is included, when they are usually free, and one friendly line inviting people to message. Do not invent experience, certificates, prices, or reviews.`,
};

const SYSTEM_PROMPT = `You are the Tebnu writing assistant inside the post composer. You help one person write a post they will publish on Tebnu, a local app that connects people who need help with people nearby who can help, with a Feed of community posts and events.

How to talk:
- Short, warm, and practical, like a helpful neighbour. Use the person's first name now and then, not in every message.
- Reply in the language of their latest message. Write the post in that language too, unless they ask for another.
- If the request is clear enough, write the post right away. Do not interview them first. If one detail would change the post a lot, write a good first version and ask that one question after it.
- When they ask for changes ("shorter", "more fun", "in Hebrew", "add that kids are welcome"), rewrite the whole post with the change.
- If they ask for ideas, give two or three short ideas in your reply and write the best one as the post.
- If they ask something unrelated to writing this post, do not answer it. Say in one sentence that you are here to help with their Tebnu post, and steer back to the post.
- Never give your own opinion, or Tebnu's, on politics, religion, news, public figures, or any group of people, and do not write posts that take a side on them. Offer a neutral, community-focused angle instead.
- No medical, health, legal, or financial advice, and no posts that make such claims or promises (cures, guaranteed results, legal or tax tips). You may write a plain request for that kind of help, for example "looking for someone to help an elderly neighbour get to appointments".
- If they describe an emergency or someone in danger, tell them to contact local emergency services right away, and do not write a post.

The post:
- Ready to publish as is. No placeholders in brackets, no "[your name]", no hashtags unless they ask, at most one or two emojis and only if it fits.
- At most ${POST_MAX_CHARS} characters. Aim for 2 to 5 short lines. Plain text, no **bold**, no markdown, no links unless they gave you one.
- Never include a phone number, email, WhatsApp, Telegram, exact home address, or anyone's private details. People reply through Tebnu.
- Nothing hateful, sexual, violent, discriminatory, or misleading. No selling of forbidden items. If they ask for that, say kindly you cannot write it and offer a different angle.
- The title is short and specific, at most ${TITLE_MAX_CHARS} characters, no full stop at the end.

Output format. Always use exactly these tags, in this order:
<reply>
One to three short sentences to the person: what you wrote, or your question. Do not repeat the post here.
</reply>
<title>The title</title>
<post>
The full post text
</post>
When you only need to ask a question or answer something, write <reply> only and leave out <title> and <post>.`;

function describeDraft(type: PostWriterType, draft: PostWriterDraft): string {
  const lines: string[] = [];
  if (draft.title?.trim()) lines.push(`Current title: ${draft.title.trim().slice(0, 200)}`);
  if (draft.description?.trim()) {
    lines.push(`Current description:\n${draft.description.trim().slice(0, 1200)}`);
  }
  if (type === "event") {
    if (draft.eventDate) lines.push(`Event date: ${draft.eventDate}`);
    if (draft.eventTime) lines.push(`Event time: ${draft.eventTime}`);
    if (draft.helpersNeeded) lines.push(`Helpers needed: ${draft.helpersNeeded}`);
  }
  if (draft.location?.trim()) lines.push(`Place: ${draft.location.trim().slice(0, 200)}`);
  for (const [label, value] of Object.entries(draft.details ?? {}).slice(0, 12)) {
    if (value?.trim()) lines.push(`${label.slice(0, 40)}: ${value.trim().slice(0, 200)}`);
  }
  return lines.length > 0 ? lines.join("\n") : "The form is still empty.";
}

async function contextMessage(userId: string, type: PostWriterType, draft: PostWriterDraft) {
  const [profile, memories, knowledge] = await Promise.all([
    userProfileSummary(userId),
    loadSupportMemories(userId).catch(() => []),
    loadSupportKnowledge().catch(() => []),
  ]);

  const parts: string[] = [TYPE_GUIDE[type]];
  if (!HAS_TITLE[type]) {
    parts.push("This form has no title field: never write <title>. Use <reply> and <post> only.");
  }
  parts.push(
    `About the person: ${JSON.stringify({
      firstName: profile?.firstName ?? null,
      role: profile?.role ?? null,
    })}`,
  );
  if (memories.length > 0) {
    parts.push(
      "Notes Tebnu Support saved about this person in earlier chats. Use them quietly to make the post fit (their area, what they do, what they like). Do not mention that you have notes.\n" +
        memories
          .slice(0, 20)
          .map((memory) => `- ${memory.content}`)
          .join("\n"),
    );
  }
  const rules = knowledge.filter((entry) => entry.kind === "rules");
  const behavior = knowledge.filter((entry) => entry.kind === "behavior");
  const facts = knowledge.filter((entry) => entry.kind === "knowledge");
  if (rules.length > 0) {
    parts.push(
      "Rules from the Tebnu team. Hard limits, they always apply:\n" +
        rules.map((entry) => `## ${entry.title}\n${entry.body}`).join("\n\n"),
    );
  }
  if (behavior.length > 0) {
    parts.push(
      "Tone notes from the Tebnu team. Use them for how you talk to the person; the post itself follows the post rules above:\n" +
        behavior.map((entry) => `## ${entry.title}\n${entry.body}`).join("\n\n"),
    );
  }
  if (facts.length > 0) {
    parts.push(
      "Facts about Tebnu from the Tebnu team, if they ask:\n" +
        facts.map((entry) => `## ${entry.title}\n${entry.body}`).join("\n\n"),
    );
  }
  parts.push(`What is in the form right now:\n${describeDraft(type, draft)}`);
  return parts.join("\n\n");
}

type Section = "reply" | "title" | "post" | null;
const TAG = /<\/?(reply|title|post)>/;

/** Splits the tagged stream into reply, title, and post pieces as they arrive. */
export function createTagParser(emit: (event: PostWriterEvent) => void) {
  let buffer = "";
  let section: Section = null;
  let started: Record<"reply" | "title" | "post", boolean> = {
    reply: false,
    title: false,
    post: false,
  };

  const out = (text: string) => {
    if (!section || !text) return;
    let piece = text;
    // Drop the newline right after an opening tag.
    if (!started[section]) {
      piece = piece.replace(/^\s+/, "");
      if (!piece) return;
      started[section] = true;
    }
    emit({ type: section, text: piece });
  };

  const drain = (final: boolean) => {
    for (;;) {
      const match = TAG.exec(buffer);
      if (!match) break;
      out(buffer.slice(0, match.index));
      buffer = buffer.slice(match.index + match[0].length);
      section = match[0].startsWith("</") ? null : (match[1] as Section);
    }
    // Hold back a tag that may still be arriving, e.g. "</po".
    const lt = buffer.lastIndexOf("<");
    if (!final && lt >= 0 && buffer.length - lt <= 8) {
      out(buffer.slice(0, lt));
      buffer = buffer.slice(lt);
      return;
    }
    out(buffer);
    buffer = "";
  };

  return {
    push(text: string) {
      buffer += text;
      drain(false);
    },
    end() {
      drain(true);
      started = { reply: false, title: false, post: false };
    },
  };
}

export async function runPostWriter(input: {
  userId: string;
  type: PostWriterType;
  turns: PostWriterTurn[];
  draft: PostWriterDraft;
  emit: (event: PostWriterEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const messages: OpenAiChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: await contextMessage(input.userId, input.type, input.draft) },
    ...input.turns.slice(-16).map((turn) => ({ role: turn.role, content: turnText(turn) })),
  ];
  const hasTitle = HAS_TITLE[input.type];
  const parser = createTagParser((event) => {
    if (event.type === "title" && !hasTitle) return;
    input.emit(event);
  });
  await streamChatCompletion(messages, (text) => parser.push(text), input.signal);
  parser.end();
}
