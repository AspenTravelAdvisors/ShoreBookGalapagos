/* Shore Book · Galápagos — the one server-side piece.

   The book itself needs no server: the guide, the field key, the log and the
   journal all live on the phone and work with no signal. This function is
   what the phone calls when it does have signal and wants a second opinion:
   who is in this photograph, what was that behaviour, what did tonight's
   briefing change, write up today.

   It exists for one reason — to keep the API key off the phone. It only runs
   the four jobs below, with prompts written here, so it cannot be borrowed as
   a general-purpose Claude endpoint by whoever finds the URL.

   Environment (Vercel → Settings → Environment Variables):
     ANTHROPIC_API_KEY   the key
     BOOK_CODE           a short shared code; the phone sends it on every call */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const client = new Anthropic();

const MAX_IMAGE_B64 = 3_000_000;   /* ~2.2 MB of JPEG — the phone sends ~1568 px, far under */
const MAX_TEXT = 6000;
const MAX_REF = 80000;             /* the species catalogue the phone sends as context: the route in full, the rest of the islands in brief */

/* ------------------------------------------------------------------ prompts */

const NATURALIST = `You are the naturalist voice of Shore Book · Galápagos, an offline field guide used by two guests aboard a small expedition ship on a Western & Northern Galápagos route in late November and early December.

How you speak: plain, exact, a little dry. Short sentences. No exclamation marks, no "amazing", no emoji. Write like a good field guide written by someone who has stood on the lava.

What you never do:
- Never invent certainty. A photograph of a dark finch on a rock is "a ground finch", not a named species. Say what would settle it.
- Never present an interpretation of behaviour as fact. Keep what is visible apart from what it might mean.
- Never encourage approaching, touching, feeding, flash photography, leaving the trail or going ashore without a naturalist. Galápagos National Park rules: 2 m from wildlife, stay on the marked trail, guided groups only.
- Never give precise locations for sensitive species beyond the named visitor site.

The species catalogue below is the book's own list, with ids: first the species of this route, then the rest of the islands, which this voyage does not expect to show. Prefer those ids, and treat an off-route species as an unusual answer that the photograph must earn. If the animal or plant is genuinely not in the catalogue, use the id "other" and give its common name, so the guest can log it.`;

const TASKS = {
  identify: {
    effort: "high",
    max_tokens: 6000,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["verdict", "subject", "seen", "candidates", "behaviour", "tip"],
      properties: {
        verdict: { type: "string", enum: ["confident", "possible", "cannot_tell", "no_wildlife"] },
        subject: { type: "string", description: "One line: what the photo shows, in plain words." },
        seen: { type: "array", items: { type: "string" }, description: "Field marks actually visible in this photo." },
        candidates: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "name", "group", "confidence", "why", "against"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              group: { type: "string", enum: ["bird", "reptile", "mammal", "fish", "sea", "bug", "plant", "other"], description: "bird, reptile, mammal, fish (incl. sharks and rays), sea (shore and reef invertebrates), bug (insects, spiders, centipedes), plant." },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              why: { type: "string", description: "Which visible marks point here." },
              against: { type: "string", description: "What argues against it, or what is not visible. Empty if nothing." }
            }
          }
        },
        behaviour: {
          type: "object",
          additionalProperties: false,
          required: ["seen", "meaning"],
          properties: {
            seen: { type: "string", description: "What the animal is visibly doing. Empty if nothing notable." },
            meaning: { type: "string", description: "What that behaviour usually means, framed as interpretation. Empty if nothing notable." }
          }
        },
        tip: { type: "string", description: "What photo or feature would settle it, if not confident. Empty if confident." }
      }
    },
    build(b) {
      const c = b.ctx || {};
      return [
        image(b.image),
        { type: "text", text:
`Identify the main subject of this photograph.

Where and when: ${clip(c.site, 200)}${c.island ? ", " + clip(c.island, 80) : ""} — ${clip(c.when, 80)}${c.act ? " — during " + clip(c.act, 120) : ""}.
Species this book records at that visitor site: ${clip((c.likely || []).join(", "), 2000) || "not known"}.
${c.hint ? "The guest adds: " + clip(c.hint, 400) : ""}

Use the site list to rank plausible candidates, but let the photograph decide: a species not expected here can still be the answer if the marks say so. Give at most three candidates, best first. "confident" only when one candidate is high and the others are not close.` }
      ];
    }
  },

  ask: {
    effort: "medium",
    max_tokens: 4000,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["answer", "seen", "inferred"],
      properties: {
        answer: { type: "string", description: "The answer, 2–6 sentences." },
        seen: { type: "string", description: "If a photo was sent: what in it bears on the question. Otherwise empty." },
        inferred: { type: "string", description: "Anything in the answer that is interpretation rather than observation. Empty if none." }
      }
    },
    build(b) {
      const c = b.ctx || {};
      const out = [];
      if (b.image) out.push(image(b.image));
      out.push({ type: "text", text:
`Context: ${clip(c.site, 200) || "aboard"}${c.when ? " — " + clip(c.when, 80) : ""}${c.species ? " — about: " + clip(c.species, 200) : ""}.

Question: ${clip(b.question, 1200)}` });
      return out;
    }
  },

  briefing: {
    effort: "medium",
    max_tokens: 6000,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "changes", "learned"],
      properties: {
        summary: { type: "string", description: "One or two sentences: what tomorrow now looks like." },
        changes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action", "site", "site_name", "replaces", "start", "end", "how", "note"],
            properties: {
              action: { type: "string", enum: ["replace", "add", "remove", "retime", "note"] },
              site: { type: "string", description: "Site id from the list, or 'other'." },
              site_name: { type: "string" },
              replaces: { type: "string", description: "For replace: the site id it replaces. Otherwise empty." },
              start: { type: "string", description: "HH:MM 24h, or empty if not said." },
              end: { type: "string", description: "HH:MM 24h, or empty if not said." },
              how: { type: "string", enum: ["dry", "wet", "panga", "snorkel", "kayak", "walk", "coach", "ship", "other", ""] },
              note: { type: "string", description: "Anything practical said about it: wake-up call, what to bring, difficulty." }
            }
          }
        },
        learned: { type: "array", items: { type: "string" }, description: "Natural-history facts or stories the speaker told, one per item, worth keeping in a journal." }
      }
    },
    build(b) {
      const c = b.ctx || {};
      return [{ type: "text", text:
`Below is what a guest typed or dictated during the ship's evening briefing for ${clip(c.day, 80)}. Dictation garbles names — "Punta Espinosa", "Puna Spinoza" and "Fernandina point" are the same place.

The book's current plan for that day:
${clip(c.plan, 1500)}

Visitor sites the book knows, as id: name:
${clip(c.sites, 3000)}

Work out what changed against the plan. Only report changes the text actually supports; if it merely repeats the plan, say so in the summary and return no changes. Times only if they were said.

The briefing:
"""
${clip(b.text, MAX_TEXT)}
"""` }];
    }
  },

  journal: {
    effort: "medium",
    max_tokens: 4000,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "text"],
      properties: {
        title: { type: "string", description: "A short title for the day, 2–6 words." },
        text: { type: "string", description: "The journal entry, 120–220 words, first person plural, past tense." }
      }
    },
    build(b) {
      const c = b.ctx || {};
      return [{ type: "text", text:
`Write today's entry for a couple's expedition journal, in their voice ("we"). Use only what is below — do not add animals, weather or events that are not listed. Where their own notes say something, keep their words and their opinion. Make it read like a well-kept travel diary, not a brochure.

${clip(c.day, 120)}
Visitor sites: ${clip(c.sites, 600)}
Species logged today: ${clip(c.species, 1200) || "none logged"}
First time on this trip: ${clip(c.firsts, 600) || "none"}
Their notes: ${clip(c.notes, 2500) || "none"}
What the naturalists told them: ${clip(c.learned, 2000) || "nothing recorded"}` }];
    }
  }
};

/* ------------------------------------------------------------------ helpers */

function clip(s, n) {
  if (s == null) return "";
  s = String(s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function image(b64) {
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } };
}

function fail(res, status, error) {
  res.status(status).json({ ok: false, error });
}

/* ------------------------------------------------------------------ handler */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return fail(res, 405, "POST only.");

  if (!process.env.ANTHROPIC_API_KEY || !process.env.BOOK_CODE) {
    return fail(res, 503, "The book's AI is not switched on yet: ANTHROPIC_API_KEY and BOOK_CODE are not both set on the server.");
  }
  if (req.headers["x-book-code"] !== process.env.BOOK_CODE) {
    return fail(res, 401, "That trip code is not right. Check it under Know → Settings.");
  }

  const b = req.body || {};
  const task = TASKS[b.task];
  if (!task) return fail(res, 400, "Unknown task.");
  if (b.image != null && (typeof b.image !== "string" || b.image.length > MAX_IMAGE_B64)) {
    return fail(res, 413, "Photo too large.");
  }
  if (b.task === "identify" && !b.image) return fail(res, 400, "No photo.");
  if (b.task === "ask" && !b.question) return fail(res, 400, "No question.");
  if (b.task === "briefing" && !b.text) return fail(res, 400, "No briefing text.");

  try {
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: task.max_tokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: task.effort, format: { type: "json_schema", schema: task.schema } },
      system: [
        { type: "text", text: NATURALIST },
        /* the catalogue is the same on every call from the same book, so it caches */
        { type: "text", text: "Species catalogue:\n" + clip(b.ref, MAX_REF), cache_control: { type: "ephemeral" } }
      ],
      messages: [{ role: "user", content: task.build(b) }]
    });

    if (msg.stop_reason === "refusal") {
      return fail(res, 422, "The model declined this one. Try a different photo or question.");
    }
    if (msg.stop_reason === "max_tokens") {
      return fail(res, 502, "The answer ran long and was cut off. Try again.");
    }
    const text = msg.content.filter(x => x.type === "text").map(x => x.text).join("");
    let data;
    try { data = JSON.parse(text); }
    catch (e) { return fail(res, 502, "The answer came back garbled. Try again."); }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return fail(res, 503, "The server's API key was refused.");
    if (err instanceof Anthropic.RateLimitError) return fail(res, 429, "Too many requests just now. It will retry.");
    if (err instanceof Anthropic.BadRequestError) return fail(res, 400, "The request was refused: " + err.message);
    /* a connection error is also an APIError, so it has to be asked first */
    if (err instanceof Anthropic.APIConnectionError) return fail(res, 504, "Could not reach the AI service. It will retry.");
    if (err instanceof Anthropic.APIError) return fail(res, 502, "The AI service had a problem (" + err.status + "). It will retry.");
    return fail(res, 500, "Something went wrong on the server.");
  }
}
