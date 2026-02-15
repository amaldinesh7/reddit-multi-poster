export type CopyKind = 'title' | 'description';
export type CopyTone = 'straightforward' | 'viral' | 'discussion' | 'excited' | 'personal' | 'humor' | 'professional';
export type CopyProvider = 'gemini' | 'groq' | 'fallback';

export type PreferredProvider = 'auto' | 'gemini' | 'groq';

export interface GenerateCopyInput {
  kind: CopyKind;
  count: number;
  baseText: string;
  globalTitle?: string;
  globalBody?: string;
  selectedSubreddits?: string[];
  subreddit?: string;
  mediaType?: 'self' | 'link' | 'image' | 'video' | 'gallery';
  userBrief?: string;
  tone?: CopyTone;
  preferredProvider?: PreferredProvider;
  previousTitles?: string[];
}

export interface GenerateCopyResult {
  options: string[];
  provider: CopyProvider;
  fallbackUsed: boolean;
}

const TITLE_LIMIT = 300;
const DESCRIPTION_LIMIT = 40000;
const MAX_CONTEXT_LENGTH = 2000;
const MAX_COUNT = 3;

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const toCleanSingleLine = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/^[-*\d.)\s]+/, '')
    .replace(/^"+|"+$/g, '')
    .trim();

const toCleanParagraph = (value: string): string =>
  value
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const cleanCandidate = (value: string, kind: CopyKind): string => {
  const cleaned = kind === 'title' ? toCleanSingleLine(value) : toCleanParagraph(value);
  const limit = kind === 'title' ? TITLE_LIMIT : DESCRIPTION_LIMIT;
  return cleaned.slice(0, limit).trim();
};

const dedupeAndNormalize = (values: string[], kind: CopyKind, desiredCount: number): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of values) {
    const cleaned = cleanCandidate(raw, kind);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(cleaned);
    if (normalized.length >= desiredCount) {
      break;
    }
  }

  return normalized;
};

const parseArrayFromText = (content: string): string[] => {
  const trimmed = content.trim();

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
  } catch {
    // fall through
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      // fall through
    }
  }

  return trimmed
    .split('\n')
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);
};

const buildUserPrompt = (input: GenerateCopyInput, count: number): string => {
  const context: Record<string, unknown> = {
    kind: input.kind,
    count,
    tone: input.tone || 'straightforward',
    userBrief: (input.userBrief || '').slice(0, MAX_CONTEXT_LENGTH),
    baseText: (input.baseText || '').slice(0, MAX_CONTEXT_LENGTH),
    globalTitle: (input.globalTitle || '').slice(0, MAX_CONTEXT_LENGTH),
    globalBody: (input.globalBody || '').slice(0, MAX_CONTEXT_LENGTH),
    selectedSubreddits: (input.selectedSubreddits || []).slice(0, 10),
    subreddit: input.subreddit || '',
    mediaType: input.mediaType || 'self',
  };

  if (input.previousTitles && input.previousTitles.length > 0) {
    context.previousTitles = input.previousTitles.slice(0, 15);
  }

  return JSON.stringify(context);
};

const TONE_GUIDANCE: Record<CopyTone, string> = {
  straightforward: 'clear, direct, and informative - gets to the point without fluff or emotional hooks',
  viral: 'shareable and scroll-stopping - uses curiosity gaps, relatable angles, or surprising takes that make people want to engage',
  discussion: 'invites conversation - poses questions, seeks opinions, or presents something debatable to encourage comments',
  excited: 'enthusiastic and energetic - shows genuine excitement without being cringy or salesy, uses natural hype language',
  personal: 'authentic first-person perspective - tells a story, shares an experience, or gives a behind-the-scenes feel',
  humor: 'witty and playful - matches Reddit humor culture with self-awareness, wordplay, or relatable observations',
  professional: 'polished and credible - suitable for career, business, or serious topics while still being approachable',
};

const buildSystemPrompt = (kind: CopyKind, count: number, tone: CopyTone, mediaType?: string, hasPreviousTitles?: boolean): string => {
  const limit = kind === 'title' ? TITLE_LIMIT : DESCRIPTION_LIMIT;
  const contentType = kind === 'title' ? 'Reddit post titles' : 'Reddit post descriptions';
  const toneDescription = TONE_GUIDANCE[tone] || TONE_GUIDANCE.straightforward;

  const mediaContext = mediaType && mediaType !== 'self'
    ? `\n- This is a ${mediaType} post, so reference the visual content naturally`
    : '';

  const previousTitlesContext = hasPreviousTitles
    ? '\n- previousTitles shows the user\'s recent posts - match their writing style, vocabulary, and vibe'
    : '';

  return [
    `You are an expert Reddit content strategist specializing in ${contentType}.`,
    `Generate exactly ${count} unique, high-engagement options.`,
    '',
    `TONE: ${tone}`,
    `Style: ${toneDescription}`,
    '',
    'RULES:',
    `- Each option must be <= ${limit} characters`,
    '- Use sentence case ONLY (capitalize first word and proper nouns) - do NOT Title Case every word',
    '- Write like a real Reddit user, not a headline writer',
    '- Avoid generic phrases like "Check this out", "Amazing", or "You won\'t believe"',
    '- Match the subreddit culture and audience if subreddit context is provided',
    '- Incorporate the user\'s brief naturally without copying it verbatim',
    '- Make each option distinctly different in approach, not just word variations',
    '- Do NOT use markdown, bullets, numbering, or quotes around values',
    mediaContext,
    previousTitlesContext,
    '',
    'Return ONLY a valid JSON array of strings. No explanations, preamble, or other text.',
  ].filter(Boolean).join('\n');
};

const generateFallbackOptions = (input: GenerateCopyInput, count: number): string[] => {
  const base = (input.baseText || input.globalTitle || '').trim();
  const brief = (input.userBrief || '').trim();
  const subredditSuffix = input.subreddit ? ` for r/${input.subreddit}` : '';

  if (input.kind === 'title') {
    const seed = base || brief || 'Post update';
    return [
      `${seed}${subredditSuffix}`,
      `${seed} - quick take${subredditSuffix}`,
      `${seed}: what do you think?`,
    ].slice(0, count);
  }

  const descriptionSeed = (input.baseText || input.globalBody || brief || '').trim();
  const firstSentence = descriptionSeed || `Sharing this update${subredditSuffix}.`;

  return [
    `${firstSentence}\n\nWould love your thoughts.`,
    `${firstSentence}\n\nContext: ${brief || 'Posting for feedback and discussion.'}`,
    `${firstSentence}\n\nOpen to suggestions and different opinions.`,
  ].slice(0, count);
};

const generateWithGroq = async (input: GenerateCopyInput, count: number): Promise<string[] | null> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const tone = input.tone || 'straightforward';
  const hasPreviousTitles = Boolean(input.previousTitles && input.previousTitles.length > 0);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_GROQ_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(input.kind, count, tone, input.mediaType, hasPreviousTitles) },
        { role: 'user', content: buildUserPrompt(input, count) },
      ],
      temperature: 0.5,
      max_tokens: 900,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`Groq request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  return parseArrayFromText(content);
};

const generateWithGemini = async (input: GenerateCopyInput, count: number): Promise<string[] | null> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const tone = input.tone || 'straightforward';
  const hasPreviousTitles = Boolean(input.previousTitles && input.previousTitles.length > 0);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 900,
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildSystemPrompt(input.kind, count, tone, input.mediaType, hasPreviousTitles) },
            { text: buildUserPrompt(input, count) },
          ],
        },
      ],
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim();
  if (!content) return null;
  return parseArrayFromText(content);
};

export async function generateCopyOptions(input: GenerateCopyInput): Promise<GenerateCopyResult> {
  const desiredCount = clamp(input.count || MAX_COUNT, 1, MAX_COUNT);
  const preferredProvider = input.preferredProvider || 'auto';

  // Determine the order of providers to try based on preference
  const providerOrder: Array<'gemini' | 'groq'> = preferredProvider === 'groq'
    ? ['groq', 'gemini']
    : ['gemini', 'groq']; // Default: gemini first, or if explicitly set to gemini

  for (const providerName of providerOrder) {
    // Skip if user explicitly chose a different provider (not auto)
    if (preferredProvider !== 'auto' && preferredProvider !== providerName) {
      continue;
    }

    try {
      const generateFn = providerName === 'gemini' ? generateWithGemini : generateWithGroq;
      const rawOptions = await generateFn(input, desiredCount);
      const normalizedOptions = dedupeAndNormalize(rawOptions || [], input.kind, desiredCount);

      if (normalizedOptions.length === desiredCount) {
        return {
          options: normalizedOptions,
          provider: providerName,
          fallbackUsed: false,
        };
      }
    } catch {
      // Continue to next provider or fallback
    }
  }

  // If preferred provider failed and it's not auto, try the other provider
  if (preferredProvider !== 'auto') {
    const otherProvider = preferredProvider === 'gemini' ? 'groq' : 'gemini';
    try {
      const generateFn = otherProvider === 'gemini' ? generateWithGemini : generateWithGroq;
      const rawOptions = await generateFn(input, desiredCount);
      const normalizedOptions = dedupeAndNormalize(rawOptions || [], input.kind, desiredCount);

      if (normalizedOptions.length === desiredCount) {
        return {
          options: normalizedOptions,
          provider: otherProvider,
          fallbackUsed: false,
        };
      }
    } catch {
      // Continue to local fallback
    }
  }

  const fallbackOptions = dedupeAndNormalize(generateFallbackOptions(input, desiredCount), input.kind, desiredCount);

  // Ensure we always return the requested count.
  while (fallbackOptions.length < desiredCount) {
    fallbackOptions.push(
      cleanCandidate(
        `${input.kind === 'title' ? 'Draft title' : 'Draft description'} ${fallbackOptions.length + 1}`,
        input.kind,
      ),
    );
  }

  return {
    options: fallbackOptions.slice(0, desiredCount),
    provider: 'fallback',
    fallbackUsed: true,
  };
}
