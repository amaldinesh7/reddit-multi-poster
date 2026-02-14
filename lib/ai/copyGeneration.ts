export type CopyKind = 'title' | 'description';
export type CopyTone = 'neutral' | 'catchy' | 'question' | 'urgent' | 'story';
export type CopyProvider = 'gemini' | 'groq' | 'fallback';

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
  const context = {
    kind: input.kind,
    count,
    tone: input.tone || 'neutral',
    userBrief: (input.userBrief || '').slice(0, MAX_CONTEXT_LENGTH),
    baseText: (input.baseText || '').slice(0, MAX_CONTEXT_LENGTH),
    globalTitle: (input.globalTitle || '').slice(0, MAX_CONTEXT_LENGTH),
    globalBody: (input.globalBody || '').slice(0, MAX_CONTEXT_LENGTH),
    selectedSubreddits: (input.selectedSubreddits || []).slice(0, 10),
    subreddit: input.subreddit || '',
    mediaType: input.mediaType || 'self',
  };

  return JSON.stringify(context);
};

const buildSystemPrompt = (kind: CopyKind, count: number): string => {
  const limit = kind === 'title' ? TITLE_LIMIT : DESCRIPTION_LIMIT;
  const contentType = kind === 'title' ? 'Reddit post titles' : 'Reddit post descriptions';

  return [
    `You generate ${contentType}.`,
    `Return a valid JSON array containing exactly ${count} unique strings.`,
    `Each string must be <= ${limit} characters.`,
    'Avoid markdown bullets, numbering, and quotes around the entire value.',
    'Use subreddit context and user brief if present.',
    'Do not include explanations, only the JSON array.',
  ].join(' ');
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

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_GROQ_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(input.kind, count) },
        { role: 'user', content: buildUserPrompt(input, count) },
      ],
      temperature: 0.4,
      max_tokens: 900,
    }),
  });

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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 900,
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildSystemPrompt(input.kind, count) },
            { text: buildUserPrompt(input, count) },
          ],
        },
      ],
    }),
  });

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

  try {
    const geminiRaw = await generateWithGemini(input, desiredCount);
    const geminiOptions = dedupeAndNormalize(geminiRaw || [], input.kind, desiredCount);

    if (geminiOptions.length === desiredCount) {
      return {
        options: geminiOptions,
        provider: 'gemini',
        fallbackUsed: false,
      };
    }
  } catch {
    // continue to Groq fallback
  }

  try {
    const groqRaw = await generateWithGroq(input, desiredCount);
    const groqOptions = dedupeAndNormalize(groqRaw || [], input.kind, desiredCount);

    if (groqOptions.length === desiredCount) {
      return {
        options: groqOptions,
        provider: 'groq',
        fallbackUsed: false,
      };
    }
  } catch {
    // continue to local fallback
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
