import type { NextApiRequest, NextApiResponse } from 'next';
import { TitleTag } from '../../utils/subredditCache';

interface ParseRequest {
  submitText: string;
  subreddit: string;
}

interface ParseResponse {
  titleTags: TitleTag[];
  error?: string;
}

// Fallback regex-based parsing when AI is unavailable
function parseWithRegex(text: string): TitleTag[] {
  const tags: TitleTag[] = [];
  const lowerText = text.toLowerCase();
  
  // Common patterns for title requirements
  const patterns = [
    // Gender tags
    { regex: /\(f\)|\[f\]/gi, tag: '(f)', label: 'Female', required: /must|required|mandatory/i.test(lowerText) },
    { regex: /\(m\)|\[m\]/gi, tag: '(m)', label: 'Male', required: /must|required|mandatory/i.test(lowerText) },
    { regex: /\(c\)|\[c\]/gi, tag: '(c)', label: 'Couple', required: false },
    { regex: /\(t\)|\[t\]/gi, tag: '(t)', label: 'Trans', required: false },
    { regex: /\(mf\)|\[mf\]/gi, tag: '(mf)', label: 'Male/Female', required: false },
    { regex: /\(fm\)|\[fm\]/gi, tag: '(fm)', label: 'Female/Male', required: false },
    
    // Content tags
    { regex: /\(oc\)|\[oc\]/gi, tag: '[OC]', label: 'Original Content', required: /oc.*required|must.*oc/i.test(lowerText) },
    { regex: /\(self\)|\[self\]/gi, tag: '[Self]', label: 'Self Post', required: false },
    { regex: /\(album\)|\[album\]/gi, tag: '[Album]', label: 'Album', required: false },
    { regex: /\(gif\)|\[gif\]/gi, tag: '[GIF]', label: 'GIF Content', required: false },
    { regex: /\(video\)|\[video\]/gi, tag: '[Video]', label: 'Video', required: false },
    
    // Age patterns
    { regex: /\d{2}[fmFM]/g, tag: '[Age][Gender]', label: 'Age + Gender (e.g., 25F)', required: /age.*required|must.*age/i.test(lowerText) },
    
    // Verification
    { regex: /\(verified\)|\[verified\]/gi, tag: '[Verified]', label: 'Verified', required: /verified.*required|must.*verified/i.test(lowerText) },
  ];
  
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      // Avoid duplicates
      if (!tags.find(t => t.tag === pattern.tag)) {
        tags.push({
          tag: pattern.tag,
          label: pattern.label,
          required: pattern.required
        });
      }
    }
  }
  
  return tags;
}

// Parse using Groq API (free tier)
async function parseWithAI(submitText: string, subreddit: string): Promise<TitleTag[]> {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    console.log('GROQ_API_KEY not set, falling back to regex parsing');
    return parseWithRegex(submitText);
  }
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that extracts title tag requirements from subreddit posting guidelines.
Extract any tags that users should/must include in their post titles.
Return ONLY a JSON array of objects with this format:
[{"tag": "(f)", "label": "Female", "required": true}]

Common tags include:
- Gender: (f), (m), (c), (t), [F], [M], etc.
- Content type: [OC], [Self], [Album], [GIF], [Video]
- Age+Gender: patterns like "25F", "30M"
- Verification: [Verified]

If no specific tags are mentioned, return an empty array [].
Only return the JSON array, nothing else.`
          },
          {
            role: 'user',
            content: `Subreddit: r/${subreddit}\n\nPosting Guidelines:\n${submitText.substring(0, 2000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      console.error('Groq API error:', response.status);
      return parseWithRegex(submitText);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Parse the JSON response
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as TitleTag[];
        return parsed.filter(tag => tag.tag && tag.label);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
    }
    
    return parseWithRegex(submitText);
  } catch (error) {
    console.error('AI parsing failed:', error);
    return parseWithRegex(submitText);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ParseResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ titleTags: [], error: 'Method not allowed' });
  }
  
  const { submitText, subreddit } = req.body as ParseRequest;
  
  if (!submitText || !subreddit) {
    // Return empty tags if no submit text
    return res.status(200).json({ titleTags: [] });
  }
  
  try {
    const titleTags = await parseWithAI(submitText, subreddit);
    return res.status(200).json({ titleTags });
  } catch (error) {
    console.error('Parse error:', error);
    // Fallback to regex
    const titleTags = parseWithRegex(submitText);
    return res.status(200).json({ titleTags });
  }
}
