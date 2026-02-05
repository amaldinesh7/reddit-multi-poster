# AI-Enhanced Posting Features - Product Requirements Document

**Version:** 1.0  
**Date:** February 2025  
**Status:** Draft  
**Target Users:** High-volume content creators posting to specialized/niche communities

---

## Executive Summary

This document outlines AI-powered features to reduce friction for content creators who post to multiple subreddits. The features are designed to be universally useful while optimizing for users who:
- Post same content to 10-50+ communities
- Navigate complex per-subreddit requirements (tags, flairs, formatting)
- Need to customize titles for different community cultures
- Post frequently (daily or multiple times per day)

**Public positioning:** General-purpose multi-Reddit posting tool  
**Optimized for:** High-volume creators in specialized communities

---

## Target User Profile

### Primary Persona: "The Volume Creator"

**Characteristics:**
- Posts 5-30 times per week
- Targets 10-50+ subreddits per content piece
- Content types: images, videos, galleries
- Needs compliance with diverse subreddit rules
- Values speed and automation over manual control

**Pain Points:**
1. Writing unique, engaging titles for each subreddit
2. Remembering which tags each subreddit requires
3. Selecting correct flairs across many communities
4. Avoiding duplicate/spam detection
5. Understanding unwritten community norms
6. Tracking which subreddits performed well

**Key Behaviors:**
- Often posts same visual content with different titles
- Has "favorite" subreddits that consistently perform
- Builds reputation through verification and consistent posting
- Sensitive to posting failures (wastes time, hurts reputation)

---

## Feature Requirements

### Feature 1: AI Caption Generator

**Priority:** P0 (Must Have)  
**Effort:** Medium (3-5 days)

#### Problem Statement
Users spend 30-60+ minutes crafting titles for 20+ subreddits. Each subreddit has different:
- Required tags: `(f)`, `(m)`, `(c)`, `[OC]`, `[Verified]`, age formats (`25F`)
- Tone expectations: casual vs. descriptive vs. provocative
- Length preferences: some prefer short, others detailed
- Banned words/phrases

#### Solution
AI-powered caption generator that creates subreddit-optimized titles from a single base description.

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| CAP-01 | User provides base description or keywords (e.g., "new outfit, mirror selfie") | P0 |
| CAP-02 | System generates 3-5 title variants per subreddit | P0 |
| CAP-03 | Auto-insert required tags in correct position (prefix/suffix) | P0 |
| CAP-04 | Respect subreddit character limits (min/max) | P0 |
| CAP-05 | Avoid blacklisted words per subreddit | P0 |
| CAP-06 | Match subreddit tone (casual, descriptive, engaging) | P1 |
| CAP-07 | One-click apply selected caption | P0 |
| CAP-08 | Learn from user's past successful titles | P2 |
| CAP-09 | Support multiple content tones (playful, confident, mysterious) | P1 |

#### AI Implementation

**Model Selection:**
- Primary: Groq API with Llama 3.1 8B Instant (free tier, permissive content policy)
- Fallback: Client-side template engine if AI unavailable
- Future: Self-hosted model for guaranteed availability

**Prompt Engineering:**

```
Context: Generate Reddit post titles for content creator
Subreddit: {subreddit_name}
Required tags: {tags_list}
Tag position: {prefix|suffix}
Character limits: {min}-{max}
Banned words: {blacklist}
Community tone: {casual|descriptive|engaging|provocative}

User's content description: {user_input}

Generate 5 unique titles that:
1. Include all required tags in correct position
2. Stay within character limits
3. Avoid banned words
4. Match the community's tone and style
5. Are engaging and likely to get positive engagement

Return as JSON array: ["title1", "title2", ...]
```

**Content Policy Considerations:**
- Groq/Llama is permissive for adult content generation
- No explicit content in prompts - focus on "engaging titles"
- User provides content description, AI enhances it
- Fallback to template-based generation if AI refuses

#### UI/UX Design

**Location:** Below title input in PostComposer

**Flow:**
1. User enters base description in new "Caption Helper" input
2. User clicks "Generate Captions" button
3. Loading state while AI generates
4. Modal/dropdown shows generated options per subreddit
5. User clicks to select, or bulk-apply across all
6. Selected caption populates title field (respecting per-subreddit titles)

**Mockup:**
```
┌─────────────────────────────────────────────────────┐
│ Caption Helper                                    ○ │
│ ┌─────────────────────────────────────────────────┐│
│ │ Describe your content briefly...               ││
│ │ e.g., "new outfit, feeling confident today"    ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ Tone: [Playful ▼]  [✨ Generate Captions]          │
│                                                     │
│ ┌─ Generated for r/subreddit1 ──────────────────┐  │
│ │ ○ "Feeling myself in this new fit (f)"        │  │
│ │ ○ "New outfit appreciation post [OC] (f)"     │  │
│ │ ● "Can't stop wearing this (f) 💕"            │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ [Apply to All] [Apply Selected]                    │
└─────────────────────────────────────────────────────┘
```

#### Acceptance Criteria
- [ ] Generated titles include all required tags
- [ ] Titles respect character limits
- [ ] Titles avoid blacklisted words
- [ ] Generation completes in <5 seconds
- [ ] Fallback works when AI unavailable
- [ ] User can edit generated titles before applying

---

### Feature 2: Smart Subreddit Suggestions

**Priority:** P0 (Must Have)  
**Effort:** Medium (3-5 days)

#### Problem Statement
Users don't know all relevant subreddits for their content. They miss potential reach by only posting to familiar communities.

#### Solution
Suggest related subreddits based on:
1. Content keywords/description
2. Co-posting patterns (anonymized from other users)
3. Subreddit category similarity

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SUG-01 | Suggest 5-10 subreddits based on user's content description | P0 |
| SUG-02 | Show subreddit subscriber count and activity level | P0 |
| SUG-03 | Indicate if subreddit requires verification | P1 |
| SUG-04 | One-click add to post targets | P0 |
| SUG-05 | Learn from user's posting patterns over time | P2 |
| SUG-06 | Filter by content type compatibility (image/video/gallery) | P1 |
| SUG-07 | Show user's past success rate in suggested subreddit | P2 |

#### Implementation Approach

**Method 1: Keyword Matching (No AI cost)**
- Extract keywords from user's title/description
- Match against cached subreddit descriptions and rules
- Rank by relevance score

**Method 2: Co-occurrence Analysis (No AI cost)**
```sql
-- Find subreddits commonly posted together
SELECT us2.subreddit_name, COUNT(*) as co_occurrence
FROM user_subreddits us1
JOIN user_subreddits us2 ON us1.user_id = us2.user_id
WHERE us1.subreddit_name = '{current_subreddit}'
  AND us2.subreddit_name != '{current_subreddit}'
GROUP BY us2.subreddit_name
ORDER BY co_occurrence DESC
LIMIT 10;
```

**Method 3: AI-Powered (Optional, higher accuracy)**
- Use embedding similarity between content description and subreddit descriptions
- Can run client-side with lightweight model

#### UI/UX Design

**Location:** Subreddit picker, "Suggestions" tab or section

```
┌─ Suggested Communities ─────────────────────────────┐
│ Based on "new outfit photo"                         │
│                                                     │
│ ┌───────────────────────────────────────────────┐  │
│ │ r/outfits          245K members    [+ Add]    │  │
│ │ Photos of outfits and fashion                 │  │
│ │ ✓ Your success rate: 92%                      │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ ┌───────────────────────────────────────────────┐  │
│ │ r/selfies          180K members    [+ Add]    │  │
│ │ Share your selfies                            │  │
│ │ ⚠️ Requires: [OC] tag                         │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ [Show 5 more...]                                   │
└─────────────────────────────────────────────────────┘
```

#### Conversion Hook
- Free: See top 3 suggestions
- Paid: See all suggestions + success rate + verification status

---

### Feature 3: Intelligent Flair Auto-Selection

**Priority:** P1 (Should Have)  
**Effort:** Low (1-2 days)

#### Problem Statement
Selecting correct flairs for 20+ subreddits is tedious. Users often guess wrong, leading to post removal.

#### Solution
Auto-suggest most appropriate flair based on content analysis.

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FLR-01 | Analyze title/content to suggest matching flair | P0 |
| FLR-02 | Pre-select suggested flair (user can override) | P0 |
| FLR-03 | Show confidence indicator for suggestion | P1 |
| FLR-04 | Learn from user's flair choices over time | P2 |

#### Implementation Logic

```typescript
function suggestFlair(title: string, body: string, mediaType: string, flairs: Flair[]): Flair | null {
  const text = `${title} ${body}`.toLowerCase();
  
  // Keyword-based matching
  const keywords = {
    'question': ['question', 'help', 'how', 'what', 'why', '?'],
    'original content': ['oc', 'original', 'mine', 'i made', 'my '],
    'video': ['video', 'clip'],
    'photo': ['photo', 'pic', 'image', 'selfie'],
    'verified': ['verified', 'verification'],
    'discussion': ['discuss', 'thoughts', 'opinion'],
  };
  
  // Match keywords to flair text
  for (const flair of flairs) {
    const flairLower = flair.text.toLowerCase();
    for (const [category, words] of Object.entries(keywords)) {
      if (flairLower.includes(category) && words.some(w => text.includes(w))) {
        return flair;
      }
    }
  }
  
  // Media type fallback
  if (mediaType === 'video') return flairs.find(f => /video|media/i.test(f.text));
  if (mediaType === 'image') return flairs.find(f => /photo|image|pic/i.test(f.text));
  
  return null;
}
```

---

### Feature 4: Subreddit Culture Guide

**Priority:** P1 (Should Have)  
**Effort:** Medium (3-5 days)

#### Problem Statement
Each subreddit has unwritten rules. Posts get removed for not matching community expectations even when technically compliant.

#### Solution
Analyze top posts to generate a "culture guide" with posting tips.

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| CUL-01 | Fetch and analyze top 25 posts from subreddit | P0 |
| CUL-02 | Identify common title patterns and lengths | P0 |
| CUL-03 | Detect preferred content types | P0 |
| CUL-04 | Generate human-readable tips | P0 |
| CUL-05 | Cache analysis (refresh weekly) | P0 |
| CUL-06 | Show posting success factors | P1 |

#### Analysis Output

```json
{
  "subreddit": "r/example",
  "analysis": {
    "avgTitleLength": 45,
    "commonPatterns": ["question format", "uses emojis", "includes age"],
    "preferredContentTypes": ["image", "gallery"],
    "postingTips": [
      "Titles averaging 40-60 characters perform best",
      "Questions in titles get 2x more engagement",
      "90% of top posts include age in title",
      "Avoid all-caps - 0% of top posts use them"
    ],
    "avoidList": [
      "Promotional language",
      "External links",
      "Reposted content"
    ]
  }
}
```

#### UI Display

```
┌─ r/subreddit Culture Guide ─────────────────────────┐
│                                                      │
│ 📊 What works here:                                  │
│ • Question-style titles perform 2x better            │
│ • Include your age in title (e.g., "25F")            │
│ • Average successful title: 45 characters            │
│                                                      │
│ ⚠️ Avoid:                                            │
│ • All caps or excessive punctuation                  │
│ • Promotional language                               │
│                                                      │
│ Last updated: 2 days ago                             │
└──────────────────────────────────────────────────────┘
```

---

### Feature 5: Cross-Subreddit Title Variants

**Priority:** P1 (Should Have)  
**Effort:** Medium (3-5 days)

#### Problem Statement
Posting identical titles across subreddits looks spammy and may trigger duplicate detection. Different communities respond to different styles.

#### Solution
Generate unique title variants for each target subreddit from one base title.

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| VAR-01 | Generate unique title variant per subreddit | P0 |
| VAR-02 | Adapt tone to match subreddit culture | P0 |
| VAR-03 | Maintain core message across variants | P0 |
| VAR-04 | Ensure all required tags included | P0 |
| VAR-05 | Preview all variants before posting | P0 |
| VAR-06 | Allow manual editing of any variant | P0 |

#### Example Output

**User's base title:** "New dress, feeling great"

| Subreddit | Generated Title |
|-----------|----------------|
| r/dresses | "Finally found the perfect dress! [OC]" |
| r/fashion | "New addition to my wardrobe - thoughts?" |
| r/selfies | "Feeling myself in this new fit (25F)" |
| r/outfits | "OOTD: New dress day (f)" |

---

### Feature 6: Optimal Posting Time

**Priority:** P2 (Nice to Have)  
**Effort:** Low (1-2 days)

#### Problem Statement
Users don't know when their target audience is most active.

#### Solution
Show optimal posting times based on historical data.

#### Data Sources
1. User's own `post_logs` success rates by time
2. Aggregated success patterns (anonymized)
3. General Reddit activity patterns

#### UI Display
```
Best time to post to selected subreddits:
🟢 Now is good (80% of your audience active)
📊 Peak hours: 6-9 PM EST
```

---

## Database Schema Changes

```sql
-- Caption generation history (for learning)
CREATE TABLE caption_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subreddit_name TEXT NOT NULL,
  input_description TEXT,
  generated_captions JSONB,
  selected_caption TEXT,
  post_success BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subreddit culture analysis cache
ALTER TABLE subreddit_cache ADD COLUMN culture_analysis JSONB;
ALTER TABLE subreddit_cache ADD COLUMN culture_analyzed_at TIMESTAMPTZ;

-- User posting patterns (for suggestions)
CREATE TABLE posting_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subreddit_name TEXT NOT NULL,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  last_posted_at TIMESTAMPTZ,
  avg_post_hour INT, -- 0-23
  UNIQUE(user_id, subreddit_name)
);

-- Indexes
CREATE INDEX idx_caption_history_user ON caption_history(user_id);
CREATE INDEX idx_posting_patterns_user ON posting_patterns(user_id);
CREATE INDEX idx_posting_patterns_subreddit ON posting_patterns(subreddit_name);
```

---

## API Endpoints

### POST /api/ai/generate-captions

**Request:**
```json
{
  "description": "new outfit, mirror selfie",
  "tone": "playful",
  "subreddits": ["selfies", "outfits", "fashion"]
}
```

**Response:**
```json
{
  "captions": {
    "selfies": [
      "Mirror mirror on the wall (25F)",
      "New outfit appreciation post (f)",
      "Feeling myself today ✨ (f)"
    ],
    "outfits": [
      "OOTD: New fit [OC]",
      "Finally found the perfect outfit",
      "New wardrobe addition (f)"
    ]
  }
}
```

### GET /api/ai/suggest-subreddits

**Request:**
```
GET /api/ai/suggest-subreddits?description=outfit+photo&current=selfies,fashion
```

**Response:**
```json
{
  "suggestions": [
    {
      "name": "outfits",
      "subscribers": 245000,
      "matchScore": 0.92,
      "userSuccessRate": 0.88,
      "requiresVerification": false,
      "requiredTags": ["[OC]"]
    }
  ]
}
```

### GET /api/subreddit/[name]/culture

**Response:**
```json
{
  "subreddit": "outfits",
  "tips": [...],
  "avgTitleLength": 45,
  "preferredFormats": ["question", "statement"],
  "analyzedAt": "2025-02-03T12:00:00Z"
}
```

---

## Technical Considerations

### AI Model Selection

| Provider | Model | Cost | Content Policy | Latency |
|----------|-------|------|----------------|---------|
| Groq | Llama 3.1 8B | Free tier | Permissive | ~1s |
| OpenAI | GPT-4 | $$$$ | Restrictive | ~2s |
| Anthropic | Claude | $$$ | Moderate | ~2s |
| Local | Ollama | Free | No limits | Variable |

**Recommendation:** Groq (Llama) as primary, with client-side templates as fallback.

### Content Policy Handling

The AI features should:
1. Focus on "engagement optimization" not explicit content
2. User provides content theme, AI enhances style/format
3. Never generate explicit text, only title structures
4. Fallback to template-based generation if AI refuses

### Rate Limiting

- AI caption generation: 10 requests/minute per user
- Subreddit suggestions: 20 requests/minute per user
- Culture analysis: Cached, refresh on-demand (max 1/day per subreddit)

### Caching Strategy

| Data | TTL | Storage |
|------|-----|---------|
| Generated captions | None (ephemeral) | Client |
| Subreddit suggestions | 24 hours | Supabase |
| Culture analysis | 7 days | Supabase |
| User patterns | Updated on each post | Supabase |

---

## Conversion Strategy

### Free Tier Limits

| Feature | Free | Paid |
|---------|------|------|
| Caption generation | 5/day | Unlimited |
| Subreddit suggestions | Top 3 | All + success rates |
| Culture guide | Basic tips | Full analysis |
| Title variants | 1 per subreddit | 5 per subreddit |

### Upgrade Triggers

1. "Generate 3 more captions - Upgrade to Pro"
2. "See 7 more suggested subreddits - Upgrade"
3. "View detailed culture analysis - Pro feature"

---

## Success Metrics

### Feature Adoption
- % of posts using AI captions
- % of suggested subreddits added
- Flair auto-selection acceptance rate

### User Value
- Time saved per posting session
- Post success rate improvement
- User-reported satisfaction

### Business Impact
- Conversion rate from AI feature limits
- Retention of AI feature users vs. non-users

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] AI caption generation endpoint
- [ ] Basic subreddit suggestions (keyword matching)
- [ ] Flair auto-selection logic
- [ ] Database schema changes

### Phase 2: UI Integration (Week 2-3)
- [ ] Caption helper UI in PostComposer
- [ ] Suggestions section in subreddit picker
- [ ] Flair auto-selection indicators
- [ ] Culture guide tooltips

### Phase 3: Enhancement (Week 3-4)
- [ ] Cross-subreddit title variants
- [ ] Full culture analysis
- [ ] Learning from user patterns
- [ ] Optimal posting time display

### Phase 4: Monetization (Week 4+)
- [ ] Free tier limits implementation
- [ ] Upgrade prompts and flows
- [ ] Usage tracking and analytics

---

## Appendix: NSFW Subreddit Patterns

### Common Required Tags
| Tag | Usage | Example |
|-----|-------|---------|
| `(f)` | Female poster | "Title here (f)" |
| `(m)` | Male poster | "Title here (m)" |
| `(c)` | Couple | "Title here (c)" |
| `(t)` | Trans | "Title here (t)" |
| `25F` | Age + Gender | "Title here 25F" |
| `[OC]` | Original content | "[OC] Title here" |
| `[Verified]` | Verified poster | "[Verified] Title" |

### Title Pattern Examples
```
Playful: "Felt cute, might delete later (f)"
Confident: "Showing off my new [content] (25F)"
Question: "What do you think of [content]? (f)"
Statement: "First post here! (f) [OC]"
Descriptive: "[Color] [item] for [occasion] (f)"
```

### Subreddit Categories (Internal Reference)
- Selfie/photo communities (require gender tag)
- Verification communities (require [Verified])
- Age-specific communities (require age in title)
- Content-type specific (require content descriptor)
- SFW-adjacent (general purpose, optional tags)

---

*Document maintained by Product Team. Last updated: February 2025*
