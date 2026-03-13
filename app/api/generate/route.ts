import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BFL_API_KEY = process.env.BFL_API_KEY;
const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === "1";

const FLUX_ENDPOINT = "https://api.bfl.ai/v1/flux-2-pro-preview";
const FLUX_WIDTH = 1024;
const FLUX_HEIGHT = 1024;
const FLUX_OUTPUT_FORMAT = "png";
// Ajustado a 5, el máximo permitido actualmente por la API de BFL
const FLUX_SAFETY_TOLERANCE = 5; 

type DesignMode = "sticker" | "playera";

type PromptPack = {
  option_a_label: string;
  option_a_prompt: string;
  option_b_label: string;
  option_b_prompt: string;
  option_c_label: string;
  option_c_prompt: string;
};

function cleanInput(input: string) {
  return String(input || "").trim().replace(/\s+/g, " ");
}

function safeJsonParse(text: string): PromptPack | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizePack(pack: PromptPack | null): PromptPack | null {
  if (!pack) return null;

  const normalized: PromptPack = {
    option_a_label: String(pack.option_a_label || "").trim(),
    option_a_prompt: String(pack.option_a_prompt || "").trim(),
    option_b_label: String(pack.option_b_label || "").trim(),
    option_b_prompt: String(pack.option_b_prompt || "").trim(),
    option_c_label: String(pack.option_c_label || "").trim(),
    option_c_prompt: String(pack.option_c_prompt || "").trim(),
  };

  if (
    !normalized.option_a_label ||
    !normalized.option_a_prompt ||
    !normalized.option_b_label ||
    !normalized.option_b_prompt ||
    !normalized.option_c_label ||
    !normalized.option_c_prompt
  ) {
    return null;
  }

  return normalized;
}

function buildFallbackDirections(userPrompt: string, mode: DesignMode): PromptPack {
  const base =
    mode === "sticker"
      ? "premium sticker artwork, transparent background, strong silhouette, compact composition, clean edges, highly appealing merch aesthetic"
      : "premium t-shirt graphic artwork, transparent background, strong focal point, wearable composition, visually balanced layout, clean commercial design";

  return {
    option_a_label: "Iconic Concept",
    option_a_prompt: `${base}, safe and lovable concept, centered composition, polished 2D illustration, commercially attractive, based on: ${userPrompt}`.trim(),
    option_b_label: "Dynamic Concept",
    option_b_prompt: `${base}, more energetic and expressive concept, stronger movement, more impact, polished 2D illustration, based on: ${userPrompt}`.trim(),
    option_c_label: "Graphic Concept",
    option_c_prompt: `${base}, stronger graphic-design direction, more badge/poster composition, premium hierarchy, polished 2D illustration, based on: ${userPrompt}`.trim(),
  };
}

function getModeSystemRules(mode: DesignMode) {
  if (mode === "sticker") {
    return `
Product type: PREMIUM STICKER.

Design requirements for stickers:
- Compact composition.
- Strong silhouette.
- Highly readable at small sizes.
- Clean cutout-friendly shape.
- Transparent background.
- Great as a single sticker on a laptop, bottle, notebook, or packaging.
- Favor cute, bold, iconic, mascot, badge, or dynamic sticker art styles.
- Avoid giant empty compositions and avoid too much micro-detail.
- If text is included, keep it short, bold, and easy to read.
    `.trim();
  }

  return `
Product type: PREMIUM T-SHIRT GRAPHIC.

Design requirements for t-shirts:
- Composition should feel wearable on a shirt.
- Strong focal point.
- Better hierarchy and breathing room than sticker art.
- Transparent background.
- Favor premium apparel graphics, bold center chest graphics, statement graphics, mascot art, badge style, or poster-like compositions when appropriate.
- If text is included, integrate it elegantly and intentionally.
- Avoid cluttered backgrounds and avoid mockups.
    `.trim();
}

async function buildArtDirections(userPrompt: string, mode: DesignMode): Promise<PromptPack> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Modelo actualizado
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
You are an elite art director and premium prompt architect for a high-end custom print store.

Your mission:
Transform a user's rough request, often written in Spanish, into THREE DISTINCT, HIGH-QUALITY, ENGLISH prompts for AI image generation.

Main objective:
Create artwork so attractive, premium, and commercially exciting that the customer immediately wants to use it.

Global rules:
- Translate the user's request into English internally.
- Preserve the true intent of the user.
- Output ONLY valid JSON.
- Do NOT explain anything.
- Ask for isolated artwork on a transparent background.
- Avoid mockups, product photos, random backgrounds, clutter, and muddy visuals.
- Favor strong composition, clean readability, good silhouette, and premium commercial appeal.
- If the request includes a name, age, or short phrase, preserve spelling exactly.
- Create 3 genuinely different concepts, not tiny variations.
- CRITICAL SAFETY & COPYRIGHT RULE: You MUST completely sanitize the prompt. NEVER output trademarked names, copyrighted characters, brands, or celebrities. If a user asks for "Batman" or "SpongeBob", describe them generically (e.g., "a bat-themed dark vigilante" or "a cheerful yellow sea sponge in square pants"). REMOVE all real names of IPs.

Creative logic:
- Option A = safest, most iconic, most instantly lovable.
- Option B = more dynamic, more energetic, more expressive.
- Option C = more graphic-design driven, more badge/poster/emblem inspired.

${getModeSystemRules(mode)}

Return exactly:
{
  "option_a_label": "...",
  "option_a_prompt": "...",
  "option_b_label": "...",
  "option_b_prompt": "...",
  "option_c_label": "...",
  "option_c_prompt": "..."
}
        `.trim(),
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() || "";
  const parsed = normalizePack(safeJsonParse(raw));

  if (parsed) return parsed;
  return buildFallbackDirections(userPrompt, mode);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submitFluxJob(prompt: string) {
  if (!BFL_API_KEY) {
    throw new Error("Falta BFL_API_KEY en .env.local");
  }

  const response = await fetch(FLUX_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "x-key": BFL_API_KEY,
    },
    body: JSON.stringify({
      prompt,
      width: FLUX_WIDTH,
      height: FLUX_HEIGHT,
      output_format: FLUX_OUTPUT_FORMAT,
      safety_tolerance: FLUX_SAFETY_TOLERANCE,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FLUX submit error: ${text}`);
  }

  return response.json() as Promise<{
    id: string;
    polling_url: string;
    cost?: number;
    input_mp?: number;
    output_mp?: number;
  }>;
}

async function pollFluxResult(pollingUrl: string) {
  if (!BFL_API_KEY) {
    throw new Error("Falta BFL_API_KEY en .env.local");
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(1000);

    const response = await fetch(pollingUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-key": BFL_API_KEY,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`FLUX poll error: ${text}`);
    }

    const data = await response.json();

    if (data.status === "Ready" && data.result?.sample) {
      return String(data.result.sample);
    }

    if (
      data.status === "Error" ||
      data.status === "Request Moderated" ||
      data.status === "Content Moderated"
    ) {
      throw new Error(`FLUX result status: ${data.status}`);
    }
  }

  throw new Error("FLUX tardó demasiado en responder.");
}

async function signedUrlToDataUrl(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("No se pudo descargar la imagen desde FLUX.");
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return `data:image/png;base64,${base64}`;
}

async function generateOneImage(prompt: string): Promise<string | null> {
  if (DEBUG_PROMPTS) {
    console.log("FLUX PROMPT:");
    console.log(prompt);
  }

  try {
    const submitted = await submitFluxJob(prompt);
    const signedUrl = await pollFluxResult(submitted.polling_url);
    const dataUrl = await signedUrlToDataUrl(signedUrl);
    return dataUrl;
  } catch (error: any) {
    console.warn(`FLUX bloqueó o falló esta imagen: ${error.message}`);
    // En lugar de romper todo el servidor, devolvemos null
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userPrompt = cleanInput(body?.prompt);
    const mode: DesignMode = body?.mode === "playera" ? "playera" : "sticker";

    if (!userPrompt) {
      return NextResponse.json(
        { error: "Escribe una idea para tu diseño." },
        { status: 400 }
      );
    }

    const compiled = await buildArtDirections(userPrompt, mode);

    if (DEBUG_PROMPTS) {
      console.log("MODE:", mode);
      console.log("A:", compiled.option_a_label, compiled.option_a_prompt);
      console.log("B:", compiled.option_b_label, compiled.option_b_prompt);
      console.log("C:", compiled.option_c_label, compiled.option_c_prompt);
    }

    // Generamos las 3 imágenes al mismo tiempo
    const [imageA, imageB, imageC] = await Promise.all([
      generateOneImage(compiled.option_a_prompt),
      generateOneImage(compiled.option_b_prompt),
      generateOneImage(compiled.option_c_prompt),
    ]);

    // Emparejamos correctamente las imágenes que SÍ funcionaron con sus títulos
    const finalImages: string[] = [];
    const finalLabels: string[] = [];

    if (imageA) { finalImages.push(imageA); finalLabels.push(compiled.option_a_label); }
    if (imageB) { finalImages.push(imageB); finalLabels.push(compiled.option_b_label); }
    if (imageC) { finalImages.push(imageC); finalLabels.push(compiled.option_c_label); }

    if (!finalImages.length) {
      return NextResponse.json(
        { error: "El filtro de seguridad bloqueó la idea por completo. Intenta describirla de otra forma." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      images: finalImages,
      labels: finalLabels,
    });
  } catch (error: any) {
    const rawMessage = String(error?.message || "");

    return NextResponse.json(
      {
        error: rawMessage || "Ocurrió un error al generar imágenes.",
      },
      { status: 500 }
    );
  }
}