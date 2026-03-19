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
const FLUX_SAFETY_TOLERANCE = 5;

type DesignMode = "sticker" | "playera";

type ChipId =
  | "circular"
  | "iconico"
  | "compacto"
  | "vintage"
  | "street"
  | "premium"
  | "colores_vivos"
  | "alto_contraste"
  | "minimal"
  | "divertido"
  | "feroz"
  | "elegante"
  | "composicion_frontal"
  | "impacto_visual"
  | "estilo_pecho"
  | "streetwear"
  | "tonos_oscuros";

type PromptPack = {
  option_a_label: string;
  option_a_prompt: string;
  option_b_label: string;
  option_b_prompt: string;
  option_c_label: string;
  option_c_prompt: string;
};

type DesignFamily =
  | "mascot_emblem"
  | "biker_badge"
  | "vintage_tattoo"
  | "retro_travel"
  | "samurai_warrior"
  | "cyberpunk_neon"
  | "sugar_skull_ornamental"
  | "typography_vintage"
  | "minimal_line_art"
  | "wildlife_nature"
  | "pinup_biker"
  | "graphic_poster";

type CompositionType =
  | "centered_chest"
  | "circular_badge"
  | "crest_emblem"
  | "stacked_poster"
  | "text_top_graphic_center_text_bottom"
  | "minimal_horizontal"
  | "ornamental_symmetry"
  | "compact_cutout";

type DesignBlueprint = {
  translated_intent: string;
  design_family: DesignFamily;
  composition: CompositionType;
  visual_style: string;
  support_elements: string[];
  palette_direction: string;
  detail_level: "low" | "medium" | "high";
  print_strategy: string;
  typography_strategy: string;
};

const STICKER_ALLOWED_CHIPS = new Set<ChipId>([
  "circular",
  "iconico",
  "compacto",
  "vintage",
  "street",
  "premium",
  "colores_vivos",
  "alto_contraste",
  "minimal",
  "divertido",
  "feroz",
  "elegante",
]);

const PLAYERA_ALLOWED_CHIPS = new Set<ChipId>([
  "composicion_frontal",
  "impacto_visual",
  "estilo_pecho",
  "streetwear",
  "vintage",
  "premium",
  "alto_contraste",
  "tonos_oscuros",
  "minimal",
  "divertido",
  "feroz",
  "elegante",
]);

function cleanInput(input: string) {
  return String(input || "").trim().replace(/\s+/g, " ");
}

function appendClause(base: string, addition: string) {
  const cleanBase = cleanInput(base);
  const cleanAddition = cleanInput(addition);

  if (!cleanAddition) return cleanBase;
  if (!cleanBase) return cleanAddition;

  if (cleanBase.toLowerCase().includes(cleanAddition.toLowerCase())) {
    return cleanBase;
  }

  return `${cleanBase}, ${cleanAddition}`;
}

function pushUnique(arr: string[], value: string) {
  const cleanValue = cleanInput(value);
  if (!cleanValue) return;

  const exists = arr.some(
    (item) => cleanInput(item).toLowerCase() === cleanValue.toLowerCase()
  );

  if (!exists) arr.push(cleanValue);
}

function normalizeRequestedChips(raw: unknown, mode: DesignMode): ChipId[] {
  if (!Array.isArray(raw)) return [];

  const allowed =
    mode === "sticker" ? STICKER_ALLOWED_CHIPS : PLAYERA_ALLOWED_CHIPS;

  const out: ChipId[] = [];
  const seen = new Set<ChipId>();

  for (const item of raw) {
    const chip = String(item || "").trim().toLowerCase() as ChipId;

    if (allowed.has(chip) && !seen.has(chip)) {
      seen.add(chip);
      out.push(chip);
    }
  }

  return out;
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

function safeBlueprintParse(text: string): DesignBlueprint | null {
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

function normalizeBlueprint(input: any): DesignBlueprint | null {
  if (!input) return null;

  const blueprint: DesignBlueprint = {
    translated_intent: String(input.translated_intent || "").trim(),
    design_family: String(input.design_family || "").trim() as DesignFamily,
    composition: String(input.composition || "").trim() as CompositionType,
    visual_style: String(input.visual_style || "").trim(),
    support_elements: Array.isArray(input.support_elements)
      ? input.support_elements.map((x: any) => String(x).trim()).filter(Boolean)
      : [],
    palette_direction: String(input.palette_direction || "").trim(),
    detail_level:
      input.detail_level === "low" ||
      input.detail_level === "medium" ||
      input.detail_level === "high"
        ? input.detail_level
        : "medium",
    print_strategy: String(input.print_strategy || "").trim(),
    typography_strategy: String(input.typography_strategy || "").trim(),
  };

  if (
    !blueprint.translated_intent ||
    !blueprint.design_family ||
    !blueprint.composition ||
    !blueprint.visual_style ||
    !blueprint.palette_direction ||
    !blueprint.print_strategy ||
    !blueprint.typography_strategy
  ) {
    return null;
  }

  return blueprint;
}

function fallbackBlueprint(userPrompt: string, mode: DesignMode): DesignBlueprint {
  return {
    translated_intent: userPrompt,
    design_family: mode === "playera" ? "graphic_poster" : "mascot_emblem",
    composition: mode === "playera" ? "centered_chest" : "compact_cutout",
    visual_style:
      mode === "playera"
        ? "clean vector-inspired apparel graphic, bold outlines, controlled shading, strong commercial merch look"
        : "clean vector-inspired sticker graphic, bold outlines, compact die-cut silhouette, strong merch readability",
    support_elements:
      mode === "playera"
        ? ["strong focal point", "clean contour", "balanced support accents"]
        : [
            "compact support accents attached to the subject",
            "clean contour",
            "cutout-friendly silhouette",
          ],
    palette_direction:
      mode === "playera"
        ? "high-contrast apparel-friendly palette with controlled accent colors"
        : "bold sticker-friendly palette with strong separation and clean readability",
    detail_level: "medium",
    print_strategy:
      mode === "playera"
        ? "apparel-ready composition with readable forms, controlled detail density, and clean printable shapes"
        : "die-cut sticker composition with one compact silhouette, no detached background elements, and strong cutout readability",
    typography_strategy:
      "only include text if clearly requested by the user; keep it short, bold, readable, and intentionally integrated",
  };
}

function familyLabel(family: DesignFamily) {
  const map: Record<DesignFamily, string> = {
    mascot_emblem: "Mascot Emblem",
    biker_badge: "Biker Badge",
    vintage_tattoo: "Vintage Tattoo",
    retro_travel: "Retro Travel",
    samurai_warrior: "Samurai Warrior",
    cyberpunk_neon: "Cyberpunk Neon",
    sugar_skull_ornamental: "Sugar Skull",
    typography_vintage: "Vintage Typography",
    minimal_line_art: "Minimal Line Art",
    wildlife_nature: "Wildlife Nature",
    pinup_biker: "Pin-Up Biker",
    graphic_poster: "Graphic Poster",
  };
  return map[family] || "Graphic Concept";
}

function getModeSystemRules(mode: DesignMode) {
  if (mode === "sticker") {
    return `
Product type: PREMIUM STICKER.

Design requirements for stickers:
- Compact die-cut sticker composition.
- Prefer a single dominant silhouette.
- Highly readable at small sizes.
- Clean cutout-friendly outer shape.
- Use a PURE SOLID WHITE BACKGROUND for generation.
- DO NOT attempt transparency.
- DO NOT create checkerboard transparency patterns.
- DO NOT create a thick white border around the art.
- DO NOT generate detached background scenery, skylines, landscapes, roads, horizons, ground, sky, or floating environmental elements.
- Support elements MUST touch, wrap around, or integrate tightly with the main subject.
- Prefer compact_cutout, circular_badge, or crest_emblem logic.
- Prefer headshot, bust, object-first, mascot, or icon-based sticker solutions when appropriate.
- If the user describes a scene, condense it into a recortable symbolic composition instead of a mini environment.
- If an element does not improve silhouette, readability, or the visual joke/concept, it should not be included.
- Favor clean vector-inspired rendering, bold outlines, controlled shading, and print-friendly color separation.
- Avoid giant empty compositions.
- Avoid too much micro-detail.
- If text is included, keep it short, bold, and easy to read.
    `.trim();
  }

  return `
Product type: PREMIUM T-SHIRT GRAPHIC.

Design requirements for t-shirts:
- Composition should feel wearable on a shirt.
- Strong focal point.
- Better hierarchy and breathing room than sticker art.
- Use a PURE SOLID WHITE BACKGROUND for generation.
- DO NOT attempt transparency.
- DO NOT create checkerboard transparency patterns.
- Favor premium apparel graphics, bold center chest graphics, statement graphics, mascot art, badge style, or poster-like compositions when appropriate.
- Prefer clean vector-inspired rendering, bold outlines, controlled shading, and print-friendly color separation.
- If text is included, integrate it elegantly and intentionally.
- Avoid cluttered backgrounds.
- Avoid mockups or product photos.
    `.trim();
}

function getChipDirective(chip: ChipId): { blueprint: string; prompt: string } {
  switch (chip) {
    case "circular":
      return {
        blueprint:
          "The composition MUST be built as a circular badge. The subject must stay centered and all meaningful elements should remain contained within a round perimeter.",
        prompt:
          "Strong circular badge composition, centered subject, balanced radial layout, all meaningful elements contained inside the round frame.",
      };

    case "iconico":
      return {
        blueprint:
          "Prioritize iconic silhouette, simplified memorable forms, and instant recognizability.",
        prompt:
          "Iconic graphic treatment, memorable silhouette, simplified commercial forms, high recognizability.",
      };

    case "compacto":
      return {
        blueprint:
          "Keep the design tightly grouped and condensed. Avoid spread-out or airy layouts.",
        prompt:
          "Compact composition, tight visual grouping, condensed layout, no unnecessary empty spread.",
      };

    case "vintage":
      return {
        blueprint:
          "Use retro-inspired commercial graphic logic, classic illustration sensibility, timeless design language, and any aged feeling only inside the art, never on the background.",
        prompt:
          "Retro-inspired commercial illustration, classic old-school graphic language, subtle distressed character inside the art only, timeless vintage merch appeal.",
      };

    case "street":
      return {
        blueprint:
          "Lean into modern urban sticker culture, graphic edge, bold attitude, and merch-forward visual language.",
        prompt:
          "Urban sticker energy, modern graphic edge, bold attitude, merch-forward execution.",
      };

    case "premium":
      return {
        blueprint:
          "Favor a refined premium merch aesthetic, polished composition, elevated taste, and cleaner execution.",
        prompt:
          "Refined premium merch aesthetic, polished composition, elevated taste, clean commercial execution.",
      };

    case "colores_vivos":
      return {
        blueprint:
          "Use a vivid, saturated, energetic palette while keeping print separation clean.",
        prompt:
          "Vivid saturated colors, energetic but controlled palette, clean commercial chroma.",
      };

    case "alto_contraste":
      return {
        blueprint:
          "Maximize separation between primary shapes for strong readability and print impact.",
        prompt:
          "High-contrast palette, bold value separation, strong readability, strong print impact.",
      };

    case "minimal":
      return {
        blueprint:
          "Reduce detail, simplify shapes, avoid clutter, and keep the design restrained.",
        prompt:
          "Minimal visual language, simplified forms, fewer elements, restrained detail.",
      };

    case "divertido":
      return {
        blueprint:
          "Favor playful energy, charming attitude, approachable expression, and upbeat forms.",
        prompt:
          "Playful energy, charming attitude, approachable expression, upbeat graphic language.",
      };

    case "feroz":
      return {
        blueprint:
          "Favor aggressive energy, intense expression, dominant stance, and sharper presence.",
        prompt:
          "Aggressive energy, intense expression, dominant presence, sharper visual language.",
      };

    case "elegante":
      return {
        blueprint:
          "Favor refined sophistication, graceful forms, tasteful restraint, and a more elevated feel.",
        prompt:
          "Refined sophistication, graceful forms, tasteful restraint, elegant visual finish.",
      };

    case "composicion_frontal":
      return {
        blueprint:
          "The graphic should be built as a centered front-of-shirt design with strong wearable balance.",
        prompt:
          "Centered front-of-shirt composition, wearable hierarchy, strong frontal graphic balance.",
      };

    case "impacto_visual":
      return {
        blueprint:
          "Increase the dramatic focal point, hierarchy, and statement energy without losing print clarity.",
        prompt:
          "Statement graphic energy, stronger focal point, bolder hierarchy, more visual punch.",
      };

    case "estilo_pecho":
      return {
        blueprint:
          "Keep the composition more compact and chest-placement friendly, with tighter central hierarchy.",
        prompt:
          "Compact chest-placement composition, tighter central hierarchy, wearable front placement.",
      };

    case "streetwear":
      return {
        blueprint:
          "Lean into premium streetwear graphics, fashion-tee energy, and bold but wearable design language.",
        prompt:
          "Premium streetwear energy, fashion-tee graphic logic, bold yet wearable execution.",
      };

    case "tonos_oscuros":
      return {
        blueprint:
          "Use a darker palette with controlled accents, premium depth, and strong readable separation.",
        prompt:
          "Dark premium palette, controlled highlights, richer shadows, readable accent colors.",
      };

    default:
      return {
        blueprint: "",
        prompt: "",
      };
  }
}

function buildChipGuidance(
  chips: ChipId[],
  kind: "blueprint" | "prompt"
): string {
  if (!chips.length) return "- No additional chip direction selected.";

  const lines: string[] = [];

  for (const chip of chips) {
    const directive = getChipDirective(chip)[kind];
    if (directive) lines.push(`- ${directive}`);
  }

  return lines.join("\n");
}

function applyChipConstraints(
  blueprint: DesignBlueprint,
  chips: ChipId[],
  mode: DesignMode
): DesignBlueprint {
  const next: DesignBlueprint = {
    ...blueprint,
    support_elements: [...blueprint.support_elements],
  };

  const has = (chip: ChipId) => chips.includes(chip);

  if (mode === "sticker") {
    if (has("circular")) {
      next.composition = "circular_badge";
      next.visual_style = appendClause(
        next.visual_style,
        "round badge logic, centered contained subject, balanced radial composition"
      );
      next.print_strategy = appendClause(
        next.print_strategy,
        "round sticker-friendly layout with all meaningful elements contained inside a circular perimeter"
      );
      pushUnique(
        next.support_elements,
        "tightly integrated radial accents contained inside the circle"
      );
    }

    if (has("compacto") && !has("circular")) {
      next.composition = "compact_cutout";
      next.visual_style = appendClause(
        next.visual_style,
        "tighter grouped silhouette with less empty spread"
      );
      next.print_strategy = appendClause(
        next.print_strategy,
        "condensed sticker layout with tighter grouping and one strong cutout read"
      );
    }

    if (has("iconico")) {
      next.visual_style = appendClause(
        next.visual_style,
        "iconic merch silhouette and memorable emblem logic"
      );
      next.print_strategy = appendClause(
        next.print_strategy,
        "instant recognizability from a distance"
      );
    }

    if (has("street")) {
      next.visual_style = appendClause(
        next.visual_style,
        "modern urban sticker attitude and graphic edge"
      );
      next.print_strategy = appendClause(
        next.print_strategy,
        "bold merch-forward sticker execution"
      );
    }
  }

  if (mode === "playera") {
    if (has("composicion_frontal")) {
      next.composition = "centered_chest";
      next.visual_style = appendClause(
        next.visual_style,
        "front-of-shirt centered graphic logic"
      );
      next.print_strategy = appendClause(
        next.print_strategy,
        "wearable front placement and balanced chest hierarchy"
      );
    }

    if (has("estilo_pecho")) {
      next.composition = "centered_chest";
      next.visual_style = appendClause(
        next.visual_style,
        "more compact chest-placement friendly composition"
      );
      next.print_strategy = appendClause(
        next.print_strategy,
        "tighter front placement suitable for chest print size"
      );
    }

    if (has("impacto_visual")) {
      if (next.composition === "minimal_horizontal") {
        next.composition = "stacked_poster";
      }

      next.visual_style = appendClause(
        next.visual_style,
        "stronger focal punch and statement graphic energy"
      );
      next.print_strategy = appendClause(
        next.print_strategy,
        "bolder hierarchy with stronger visual punch"
      );
      pushUnique(next.support_elements, "controlled high-impact accents");
    }

    if (has("streetwear")) {
      next.visual_style = appendClause(
        next.visual_style,
        "premium streetwear graphic language"
      );
      next.print_strategy = appendClause(
        next.print_strategy,
        "fashion-tee friendly execution with bold but wearable balance"
      );
    }
  }

  if (has("vintage")) {
    next.visual_style = appendClause(
      next.visual_style,
      "retro-inspired old-school illustration sensibility"
    );
    next.print_strategy = appendClause(
      next.print_strategy,
      "any distressed or aged feeling must live inside the art only, never on the background"
    );

    if (!has("colores_vivos") && !has("tonos_oscuros")) {
      next.palette_direction =
        "retro-inspired palette with slightly muted but still readable commercial colors";
    }
  }

  if (has("premium")) {
    next.visual_style = appendClause(
      next.visual_style,
      "refined premium merch finish"
    );
    next.print_strategy = appendClause(
      next.print_strategy,
      "polished premium commercial execution"
    );
  }

  if (has("colores_vivos")) {
    next.palette_direction = has("vintage")
      ? "retro-inspired palette with vivid but controlled colors and clean commercial separation"
      : "vivid saturated commercial palette with clean separation and strong print readability";
  }

  if (has("tonos_oscuros")) {
    next.palette_direction =
      "dark premium palette with rich shadows, restrained highlights, and readable accent colors";
  }

  if (has("alto_contraste")) {
    next.palette_direction = appendClause(
      next.palette_direction,
      "high contrast separation between main shapes"
    );
    next.print_strategy = appendClause(
      next.print_strategy,
      "strong readability through contrast and clear value separation"
    );
  }

  if (has("minimal")) {
    next.detail_level = "low";
    next.visual_style = appendClause(
      next.visual_style,
      "simplified forms, restrained detail, minimal clutter"
    );
    next.support_elements = next.support_elements.slice(0, 2);
  }

  if (has("divertido")) {
    next.visual_style = appendClause(
      next.visual_style,
      "playful and approachable visual energy"
    );
    next.print_strategy = appendClause(
      next.print_strategy,
      "friendly commercial appeal"
    );
  }

  if (has("feroz")) {
    next.visual_style = appendClause(
      next.visual_style,
      "intense aggressive expression and dominant energy"
    );
    next.print_strategy = appendClause(
      next.print_strategy,
      "stronger visual bite and more assertive presence"
    );
  }

  if (has("elegante")) {
    next.visual_style = appendClause(
      next.visual_style,
      "refined sophisticated forms and tasteful restraint"
    );
    next.print_strategy = appendClause(
      next.print_strategy,
      "elevated refined finish"
    );
  }

  return next;
}

async function buildDesignBlueprint(
  userPrompt: string,
  mode: DesignMode,
  chips: ChipId[]
): Promise<DesignBlueprint> {
  const chipBlueprintGuidance = buildChipGuidance(chips, "blueprint");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
You are a senior apparel creative director and merchandising strategist.

Your job is NOT to write final image prompts yet.
Your first job is to classify the user's idea into the best possible t-shirt or sticker design blueprint.

Rules:
- Translate the user's request into English internally.
- Preserve the real intent.
- Think like a world-class custom apparel platform.
- Choose the best visual family for merchandising.
- Choose the most commercially effective composition.
- Add smart support elements that elevate the concept without bloating it.
- Think in terms of wearable graphic design, not generic image generation.
- Prefer design categories that work well for POD and printed apparel.
- If the request is minimal, respect minimalism.
- If text is not explicitly requested, do not force heavy typography.
- Keep the design print-friendly, high-impact, and commercially attractive.
- Prefer clean vector-inspired visual logic, bold outlines, controlled shading, and readable printable forms.
- Generated images should be planned for a PURE SOLID WHITE BACKGROUND, not transparency.

- TEXTURE RULE: NEVER suggest 'textured backgrounds', 'grunge backgrounds', or 'splatters' on the background. If texture is needed for a vintage look, explicitly state that the texture must be INSIDE the graphic elements only, while keeping the background completely solid, pure white and empty.

- CHARACTER RECOGNITION & DETAILED DESCRIPTION RULE: If the user requests a specific copyrighted character, cartoon, or celebrity (e.g., Pucca, Plim Plim, Bely y Beto, Superman, Spider-Man), DO NOT pass the trademarked name directly to Flux in the final prompt options. Instead, replace the name with an EXTREMELY DETAILED VISUAL DESCRIPTION of their iconic features, costume, colors, and accessories based on your internal knowledge. The goal is to describe them so accurately that they are instantly recognizable without using the restricted name, thus avoiding API blocking while preserving likeness.

Selected chip direction to obey:
${chipBlueprintGuidance}

Treat selected chips as deliberate art direction from the user. They are NOT optional fluff.

${
  mode === "sticker"
    ? `
STICKER MODE CONSTRAINTS:
- The user wants a DIE-CUT sticker.
- The final concept must read as one compact sticker, not as a scene.
- If the user describes a scene, convert it into a compact sticker symbol instead of drawing the full environment.
- Prefer mascot, icon, bust, headshot, object-first, compact emblem, or compact_cutout solutions.
- For sticker mode, do not choose centered_chest composition. Prefer compact_cutout, circular_badge, or crest_emblem.
- Never suggest skyline hints, city hints, forest hints, mountain hints, background hints, or environment hints.
- Never suggest detached scenery, landscape, road, horizon, sky, ground, or environmental background elements.
- Support elements must touch, wrap around, or integrate tightly with the main subject.
- Never suggest action lines, speed lines, motion lines, radiating lines, comic bursts, spark bursts, or floating accent marks outside the main silhouette.
- Do not include support elements that float outside the sticker shape.
- Every support element must remain attached to the main silhouette and help the final sticker read as one compact cutout.
- support_elements are allowed ONLY if they improve silhouette, readability, or the visual joke/concept.
- Prefer a single dominant subject with minimal tightly attached accents.
- Avoid mini posters, postcards, landscape illustrations, or narrative mini-scenes.

Allowed design_family values (STICKER ONLY):
mascot_emblem
biker_badge
vintage_tattoo
samurai_warrior
cyberpunk_neon
sugar_skull_ornamental
typography_vintage
minimal_line_art
wildlife_nature
pinup_biker

Allowed composition values (STICKER ONLY):
compact_cutout
circular_badge
crest_emblem
minimal_horizontal
`
    : `
T-SHIRT MODE CONSTRAINTS:
- The user wants a wearable apparel graphic.
- Scenic support can be allowed if it remains printable and visually controlled.
- Prioritize strong chest-graphic logic, visual hierarchy, and breathing room.
- Poster-like or statement compositions are allowed when commercially appropriate.

Allowed design_family values (T-SHIRT ONLY):
mascot_emblem
biker_badge
vintage_tattoo
retro_travel
samurai_warrior
cyberpunk_neon
sugar_skull_ornamental
typography_vintage
minimal_line_art
wildlife_nature
pinup_biker
graphic_poster

Allowed composition values (T-SHIRT ONLY):
centered_chest
circular_badge
crest_emblem
stacked_poster
text_top_graphic_center_text_bottom
minimal_horizontal
ornamental_symmetry
`
}

Return JSON only with:
{
  "translated_intent": "...",
  "design_family": "...",
  "composition": "...",
  "visual_style": "...",
  "support_elements": ["...", "...", "..."],
  "palette_direction": "...",
  "detail_level": "low|medium|high",
  "print_strategy": "...",
  "typography_strategy": "..."
}
        `.trim(),
      },
      {
        role: "user",
        content: `Mode: ${mode}\nSelected chips: ${
          chips.length ? chips.join(", ") : "none"
        }\nUser idea: ${userPrompt}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() || "";
  const parsed = normalizeBlueprint(safeBlueprintParse(raw));
  const baseBlueprint = parsed || fallbackBlueprint(userPrompt, mode);

  return applyChipConstraints(baseBlueprint, chips, mode);
}

async function buildArtDirections(
  userPrompt: string,
  mode: DesignMode,
  chips: ChipId[]
): Promise<PromptPack> {
  const blueprint = await buildDesignBlueprint(userPrompt, mode, chips);
  const chipPromptGuidance = buildChipGuidance(chips, "prompt");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
You are an elite prompt architect for a premium custom print brand.

Your mission:
Write THREE DISTINCT, HIGH-CONVERTING AI IMAGE PROMPTS in English for a ${
          mode === "playera" ? "t-shirt" : "sticker"
        } design.

You are NOT starting from scratch.
You must use the blueprint provided by the creative director.

Global rules:
- Output valid JSON only.
- Preserve the translated intent.
- Use a PURE SOLID WHITE BACKGROUND.
- DO NOT ask for transparent background.
- DO NOT ask for checkerboard transparency.
- No mockups.
- No product photos.
- No real shirt photos.
- Make each option meaningfully different, not minor wording changes.
- Preserve short requested text exactly when present.
- If no text was requested, do not force text.

- CHARACTER RECOGNITION & DETAILED DESCRIPTION RULE: If the user requests a specific copyrighted character, cartoon, or celebrity (e.g., Pucca, Plim Plim, Bely y Beto, Superman, Spider-Man), DO NOT pass the trademarked name directly to Flux in the final prompt options. Instead, use your internal knowledge to replace the name with an EXTREMELY DETAILED VISUAL DESCRIPTION of their iconic features, costume, colors, and accessories. Describe them so accurately that they are instantly recognizable without mentioning their restricted name, thus avoiding API moderation while preserving visual likeness.

Selected chip direction to obey:
${chipPromptGuidance}

Treat selected chips as real art-direction constraints, not as optional adjectives.

${
  mode === "sticker"
    ? `
STICKER PROMPT WRITING RULES:
- Write prompts in a more direct and visual way, not like a long human briefing.
- Prioritize shape, silhouette, subject, expression, accessories, composition, and cutout-readability.
- Do not describe a background scene behind the subject.
- Do not write prompts like a poster, postcard, or narrative illustration.
- Keep the concept compact, recortable, and sticker-oriented.
- Prefer a single dominant subject with only minimal tightly attached support accents.
- Do not write action lines, speed lines, motion lines, radiating lines, comic bursts, spark bursts, or floating accent marks around the subject.
- Do not place any detached visual accents outside the main sticker silhouette.
- Keep all visual energy inside the subject shape or tightly integrated into the sticker cutout.
- If the idea started as a scene, write the final prompt as a symbolic die-cut sticker concept.
- Emblem solutions are allowed only if they stay clean, compact, and non-scenic.
- Avoid unnecessary decorative extras.
`
    : `
T-SHIRT PROMPT WRITING RULES:
- Write prompts as premium standalone apparel graphics, not as sticker concepts.
- Prioritize stronger chest-graphic hierarchy, broader composition, and more breathing room around the main subject.
- Scenic or symbolic support is allowed if it remains printable, visually controlled, and helps the shirt graphic feel more complete.
- Do not over-compress the composition into a compact cutout unless the user explicitly wants that style.
- Favor premium graphic-tee energy, statement composition, and apparel-first visual balance.
- The result must be the artwork only, not a shirt mockup or garment presentation.
`
}

Design blueprint to obey:
- translated_intent: ${blueprint.translated_intent}
- design_family: ${blueprint.design_family}
- composition: ${blueprint.composition}
- visual_style: ${blueprint.visual_style}
- support_elements: ${blueprint.support_elements.join(", ")}
- palette_direction: ${blueprint.palette_direction}
- detail_level: ${blueprint.detail_level}
- print_strategy: ${blueprint.print_strategy}
- typography_strategy: ${blueprint.typography_strategy}

Mode requirements:
${getModeSystemRules(mode)}

Variation logic:
- Option A = most commercially attractive, clearest, safest, most instantly lovable version within the chosen family.
- Option B = more energetic, more expressive, more dramatic or visually powerful, still highly wearable.
- Option C = more design-driven, more iconic, more badge/poster/emblem oriented, with stronger graphic identity.

Each prompt should explicitly include:
- the best t-shirt/sticker composition
- the selected visual family
- print-friendly detail control
- apparel/sticker-ready commercial execution
- clean vector-inspired rendering
- pure solid white background
- the right palette direction
- the intended support elements when useful
${
  mode === "sticker"
    ? `
STICKER OUTPUT RESTRICTIONS:
- Do not invent extra decorative elements unless they are necessary for silhouette, readability, or the core visual joke.
- Do not add stars, badges, emblems, rings, halos, frames, or background symbols unless the blueprint clearly requires them.
- Do not place subtle elements in the background behind the subject.
- Keep the final sticker prompt focused on the main subject and the primary attached accessory or accent only.
- Minimize ornamental extras.
`
    : ``
}
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
        content: `User original idea: ${userPrompt}\nSelected chips: ${
          chips.length ? chips.join(", ") : "none"
        }`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() || "";
  const parsed = normalizePack(safeJsonParse(raw));

  if (parsed) {
    if (DEBUG_PROMPTS) {
      console.log("BLUEPRINT:", blueprint);
      console.log("CHIPS:", chips);
    }
    return parsed;
  }

  const family = familyLabel(blueprint.design_family);
  const support = blueprint.support_elements.join(", ");

  return {
    option_a_label: `${family} A`,
    option_a_prompt: `
${blueprint.translated_intent},
${mode === "playera" ? "premium t-shirt graphic design" : "premium sticker design"},
${blueprint.design_family.replace(/_/g, " ")},
${blueprint.composition.replace(/_/g, " ")},
${blueprint.visual_style},
support elements: ${support},
palette direction: ${blueprint.palette_direction},
detail level: ${blueprint.detail_level},
${blueprint.print_strategy},
${
  mode === "sticker"
    ? `clean vector-inspired rendering,
bold outlines,
controlled shading,
print-friendly color separation,`
    : `premium apparel graphic rendering,
strong visual hierarchy,
broader chest-graphic composition,
controlled shading with more breathing room,`
}
most commercially attractive version,
clear focal point,
high readability,
pure solid white background,
no fake transparency,
no checkerboard pattern,
${mode === "sticker" ? "no scenery," : ""}
no mockup
    `.trim(),

    option_b_label: `${family} B`,
    option_b_prompt: `
${blueprint.translated_intent},
${mode === "playera" ? "premium t-shirt graphic design" : "premium sticker design"},
more energetic and expressive version,
${blueprint.design_family.replace(/_/g, " ")},
${blueprint.composition.replace(/_/g, " ")},
${blueprint.visual_style},
support elements: ${support},
palette direction: ${blueprint.palette_direction},
detail level: ${blueprint.detail_level},
${
  mode === "sticker"
    ? `clean vector-inspired rendering,
bold outlines,
controlled shading,
print-friendly color separation,`
    : `premium apparel graphic rendering,
strong visual hierarchy,
broader chest-graphic composition,
controlled shading with more breathing room,`
}
stronger movement,
more visual impact,
premium commercial execution,
pure solid white background,
no fake transparency,
no checkerboard pattern,
${mode === "sticker" ? "no scenery," : ""}
no mockup
    `.trim(),

    option_c_label: `${family} C`,
    option_c_prompt: `
${blueprint.translated_intent},
${mode === "playera" ? "premium t-shirt graphic design" : "premium sticker design"},
more iconic graphic-design driven version,
${blueprint.design_family.replace(/_/g, " ")},
stronger emblem or poster identity,
${blueprint.composition.replace(/_/g, " ")},
${blueprint.visual_style},
support elements: ${support},
palette direction: ${blueprint.palette_direction},
detail level: ${blueprint.detail_level},
${
  mode === "sticker"
    ? `clean vector-inspired rendering,
bold outlines,
controlled shading,
print-friendly color separation,`
    : `premium apparel graphic rendering,
strong visual hierarchy,
broader chest-graphic composition,
controlled shading with more breathing room,`
}
bold hierarchy,
stronger merch identity,
premium apparel graphic aesthetic,
pure solid white background,
no fake transparency,
no checkerboard pattern,
${mode === "sticker" ? "no scenery," : ""}
no mockup
    `.trim(),
  };
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
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userPrompt = cleanInput(body?.prompt);
    const mode: DesignMode =
      body?.mode === "playera" || body?.mode === "shirt" ? "playera" : "sticker";
    const chips = normalizeRequestedChips(body?.chips, mode);

    if (!userPrompt) {
      return NextResponse.json(
        { error: "Escribe una idea para tu diseño." },
        { status: 400 }
      );
    }

    const compiled = await buildArtDirections(userPrompt, mode, chips);

    if (DEBUG_PROMPTS) {
      console.log("USER PROMPT:", userPrompt);
      console.log("MODE:", mode);
      console.log("CHIPS:", chips);
      console.log("A:", compiled.option_a_label, compiled.option_a_prompt);
      console.log("B:", compiled.option_b_label, compiled.option_b_prompt);
      console.log("C:", compiled.option_c_label, compiled.option_c_prompt);
    }

    const [imageA, imageB, imageC] = await Promise.all([
      generateOneImage(compiled.option_a_prompt),
      generateOneImage(compiled.option_b_prompt),
      generateOneImage(compiled.option_c_prompt),
    ]);

    const finalImages: string[] = [];
    const finalLabels: string[] = [];

    if (imageA) {
      finalImages.push(imageA);
      finalLabels.push(compiled.option_a_label);
    }
    if (imageB) {
      finalImages.push(imageB);
      finalLabels.push(compiled.option_b_label);
    }
    if (imageC) {
      finalImages.push(imageC);
      finalLabels.push(compiled.option_c_label);
    }

    if (!finalImages.length) {
      return NextResponse.json(
        {
          error:
            "El filtro de seguridad bloqueó la idea por completo. Intenta describirla de otra forma.",
        },
        { status: 400 }
      );
    }

    const debugPayload = DEBUG_PROMPTS
      ? {
          chips,
          prompts: [
            compiled.option_a_prompt,
            compiled.option_b_prompt,
            compiled.option_c_prompt,
          ],
        }
      : {};

    return NextResponse.json({
      images: finalImages,
      labels: finalLabels,
      ...debugPayload,
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