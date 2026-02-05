# Feature Enhancement Roadmap

Strategic feature recommendations to increase paid conversions, prioritized by impact and implementation effort.

**Constraint**: Zero additional infrastructure cost (use existing Supabase, Reddit API, Vercel)

---

## Current Product State

### Core Features (Shipped)
- Bulk posting to multiple subreddits
- Media support (images, videos, galleries)
- Smart scheduling (1-4 second delays)
- Auto flair detection and application
- Real-time posting progress
- Failed post management with retry
- Queue system with async processing
- Subreddit categories
- Title prefixes and suffixes
- Preflight validation
- PWA support
- Dark/light/system themes

### Current Limitations (Free vs Paid)
- Free: 5 saved subreddits, 5 per post
- Paid: Unlimited

---

## Tier 1: High-Impact Quick Wins

**Estimated effort**: 1-2 days each
**Priority**: Implement first

### 1. Personal Analytics Dashboard

**Why it converts**: Shows users the value they're getting, creates investment

**Implementation**:
- Expose existing `post_logs` data to users
- Stats: Total posts, success rate, top subreddits, posting streak
- Chart: Posts over time (last 30 days)

**Conversion hook**: 
- Free: Last 7 days only
- Paid: Full history + detailed breakdown

**Files to modify**:
- `pages/analytics.tsx` (currently admin-only, make user version)
- `pages/api/analytics.ts` (add user-specific endpoint)

### 2. Post Templates

**Why it converts**: Power users love templates - once they create several, they're invested

**Implementation**:
- Save: title format, body template, default subreddits
- Template variables: `{subreddit}`, `{date}`, `{count}`
- Quick-apply from post composer

**Conversion hook**:
- Free: 3 templates
- Paid: Unlimited

**Database changes**:
```sql
CREATE TABLE post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  title_template TEXT,
  body_template TEXT,
  default_subreddits TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Drafts System

**Why it converts**: Creates stickiness - users come back to finish drafts

**Implementation**:
- Auto-save draft every 30 seconds
- localStorage for immediate saves
- Optional Supabase sync for cross-device
- Resume incomplete posts

**Conversion hook**:
- Free: 1 draft
- Paid: Unlimited drafts

### 4. Post History View

**Why it converts**: Users can see their journey, track what worked

**Implementation**:
- Show posts from `post_logs` with Reddit links
- Filter by subreddit, status, date
- Quick "repost to different subreddits" action
- Copy successful post details

**Files to modify**:
- Create `pages/history.tsx`
- Add API endpoint `pages/api/history.ts`

---

## Tier 2: Differentiation Features

**Estimated effort**: 3-5 days each
**Priority**: Implement after Tier 1

### 5. Scheduled Posting (KILLER FEATURE)

**Why it converts**: Most free tools don't offer this - clear differentiator

**Implementation**:
- Add datetime picker to post composer
- Store `scheduled_for` in `queue_jobs` table
- Vercel cron job (free tier) to check and process scheduled posts
- Show scheduled posts in a queue view

**Flow**:
```
Current:  Post Now → Queue → Process immediately
New:      Post Now OR Schedule → Queue (scheduled_for) → Cron → Process
```

**Conversion hook**:
- Free: 1 scheduled post at a time
- Paid: Unlimited scheduled queue

**Database changes**:
```sql
ALTER TABLE queue_jobs ADD COLUMN scheduled_for TIMESTAMPTZ;
ALTER TABLE queue_jobs ADD COLUMN is_scheduled BOOLEAN DEFAULT FALSE;
```

**Cron setup** (vercel.json):
```json
{
  "crons": [{
    "path": "/api/cron/process-scheduled",
    "schedule": "*/5 * * * *"
  }]
}
```

### 6. Smart Title Analyzer (Client-Side)

**Why it converts**: Makes users feel like they're using a "pro" tool

**Implementation** (all browser-side, zero cost):
- Character count with Reddit limit (300 chars)
- Formatting warnings (ALL CAPS, excessive punctuation!!!)
- Readability score (simple algorithm)
- Duplicate word detection
- Common spam trigger warnings

**UI**: Real-time feedback below title input

### 7. Subreddit Intelligence Cards

**Why it converts**: Reduces posting failures, builds trust

**Implementation**:
- Expanded info on hover/click:
  - Subscriber count (from `subreddit_cache`)
  - Rules summary
  - Posting requirements
  - User's success rate in that subreddit
  - NSFW indicator
  - Last posted date

**Files to modify**:
- `components/subreddit-picker/SubredditRow.tsx`
- Add tooltip or expandable card

### 8. Best Time to Post Hints

**Why it converts**: Data-driven feature = perceived premium value

**Implementation**:
- Aggregate posting patterns from `post_logs` (anonymized)
- Simple indicators per subreddit: "High activity" / "Moderate" / "Low"
- Based on time of day and day of week
- Even a basic heuristic adds perceived value

**Note**: Start simple, improve over time with more data

---

## Tier 3: Engagement & Stickiness Features

**Estimated effort**: 1-2 days each
**Priority**: Implement for retention

### 9. Subreddit Notes & Tags

**Why it converts**: Personalization creates investment

**Implementation**:
- Add personal notes to subreddits ("strict mods", "use memes only")
- Custom color tags for visual organization
- Notes visible in subreddit picker

**Database changes**:
```sql
ALTER TABLE user_subreddits ADD COLUMN notes TEXT;
ALTER TABLE user_subreddits ADD COLUMN tags TEXT[];
ALTER TABLE user_subreddits ADD COLUMN color TEXT;
```

### 10. Import/Export Subreddit Lists

**Why it converts**: Removes friction for users switching from other tools

**Implementation**:
- Export as CSV/JSON
- Import from CSV or paste list of subreddit names
- "Import from Reddit subscriptions" (via Reddit API - free)

### 11. Keyboard Shortcuts

**Why it converts**: Power users = paying users

**Shortcuts**:
- `Ctrl/Cmd + Enter`: Submit post
- `Ctrl/Cmd + S`: Save draft
- `Ctrl/Cmd + K`: Quick search subreddits
- `Escape`: Close modals
- `?`: Show shortcuts help

**Implementation**: Global keyboard listener + help modal

### 12. Quick Duplicate Post

**Why it converts**: Saves time = perceived value

**Implementation**:
- After successful post: "Post again with different subreddits"
- From history: "Repost this" button
- One-click to clone all post details

---

## Tier 4: Social Proof & Growth

**Estimated effort**: 0.5-1 day each
**Priority**: Implement for marketing

### 13. Public Success Counter

**Why it converts**: Social proof drives trust

**Implementation**:
- Aggregate from `post_logs` (anonymized)
- Display on login/landing page:
  > "Join 1,234+ creators who've sent 45,000+ posts"

**API endpoint**: `pages/api/stats/public.ts`

### 14. Referral System

**Why it converts**: Free marketing + user investment

**Implementation**:
- Unique referral link per user
- Reward: +2 free subreddit slots per successful referral
- Track in users table

**Database changes**:
```sql
ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN referred_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN referral_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN bonus_subreddits INT DEFAULT 0;
```

### 15. Achievement Badges

**Why it converts**: Gamification creates emotional attachment

**Badges**:
- "First Post" - Complete first post
- "10 Posts" - 10 successful posts
- "100 Posts" - 100 successful posts
- "Perfect Week" - 7 days posting streak
- "Multi-Category Master" - 5+ categories
- "Speed Demon" - 20+ subreddits in one post

**Implementation**: Check conditions on post completion, store in user profile

---

## Tier 5: "AI-Like" Features (No AI Cost)

**Estimated effort**: 2-3 days each
**Priority**: Nice to have

### 16. Smart Subreddit Suggestions

**Why it converts**: Feels like AI, but is pattern matching

**Implementation**:
- When user adds a subreddit, suggest related ones
- Based on common pairings from other users (anonymized)
- "Users who post to r/gaming also post to: r/pcgaming, r/games"

**Query**:
```sql
SELECT us2.subreddit_name, COUNT(*) as co_occurrence
FROM user_subreddits us1
JOIN user_subreddits us2 ON us1.user_id = us2.user_id
WHERE us1.subreddit_name = 'gaming' AND us2.subreddit_name != 'gaming'
GROUP BY us2.subreddit_name
ORDER BY co_occurrence DESC
LIMIT 5;
```

### 17. Title Templates Library

**Why it converts**: Removes creative friction

**Implementation**:
- Pre-built title formats by category
- Examples:
  - Question: "What's the best way to {topic}?"
  - Discussion: "[Discussion] {topic}"
  - Sharing: "[OC] {title} - {suffix}"
- Curated by you, possibly community-contributed later

### 18. Post Success Predictions (Heuristic)

**Why it converts**: Data-driven feeling without AI

**Implementation**:
- Score based on:
  - User's historical success rate in subreddit
  - Subreddit strictness (from failure rate data)
  - Flair selected (required vs optional)
- Display: "High/Medium/Low chance of success"

---

## Implementation Roadmap

### Phase 1: Quick Conversion Boosters (Week 1)
- [ ] Personal Analytics Dashboard
- [ ] Post Templates (with free limit)
- [ ] Post History View

### Phase 2: Differentiation (Week 2)
- [ ] Scheduled Posting
- [ ] Smart Title Analyzer

### Phase 3: Stickiness (Week 3)
- [ ] Drafts System
- [ ] Subreddit Notes
- [ ] Keyboard Shortcuts

### Phase 4: Growth (Week 4)
- [ ] Public Success Counter
- [ ] Import/Export
- [ ] Achievement Badges

### Phase 5: Polish (Ongoing)
- [ ] Smart Subreddit Suggestions
- [ ] Title Templates Library
- [ ] Best Time to Post

---

## Database Migration Summary

```sql
-- Post Templates
CREATE TABLE post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title_template TEXT,
  body_template TEXT,
  default_subreddits TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drafts
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT,
  link_url TEXT,
  subreddits JSONB,
  media_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled posting
ALTER TABLE queue_jobs ADD COLUMN scheduled_for TIMESTAMPTZ;
ALTER TABLE queue_jobs ADD COLUMN is_scheduled BOOLEAN DEFAULT FALSE;

-- Subreddit enhancements
ALTER TABLE user_subreddits ADD COLUMN notes TEXT;
ALTER TABLE user_subreddits ADD COLUMN tags TEXT[];
ALTER TABLE user_subreddits ADD COLUMN color TEXT;

-- Referral system
ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN referred_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN referral_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN bonus_subreddits INT DEFAULT 0;

-- Achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_key)
);

-- Indexes
CREATE INDEX idx_post_templates_user ON post_templates(user_id);
CREATE INDEX idx_drafts_user ON drafts(user_id);
CREATE INDEX idx_queue_jobs_scheduled ON queue_jobs(scheduled_for) WHERE is_scheduled = TRUE;
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
```

---

## Success Metrics

### Conversion Metrics
- Feature → Upgrade conversion rate
- Time from signup to paid
- Which feature limit triggers most upgrades

### Engagement Metrics
- Daily/Weekly active users
- Posts per user per week
- Feature adoption rate
- Draft → Published rate

### Growth Metrics
- Referral conversion rate
- Organic signups (from public counter/social proof)
- User retention (7-day, 30-day)

---

## Technical Notes

All features use existing infrastructure:
- **Supabase**: New tables within free tier limits
- **Reddit API**: Already integrated, no new scopes needed
- **Vercel Cron**: Free tier supports scheduled posting
- **Client-side**: Title analyzer, shortcuts run in browser

No new services or API costs required.
