# Analytics Documentation

This document describes all analytics events tracked in Reddit Multi Poster using PostHog.

## Overview

We use [PostHog](https://posthog.com) for product analytics to understand user behavior, measure conversion funnels, and identify areas for improvement.

### Configuration

| Environment Variable | Description | Example |
|---------------------|-------------|---------|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key | `phc_xxx...` |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog instance URL | `https://us.i.posthog.com` |

### Environment Detection

All events automatically include an `environment` property with one of these values:

| Value | Description |
|-------|-------------|
| `production` | Live production deployment |
| `preview` | Vercel preview deployments |
| `development` | Local development |

**Filtering in PostHog:**
- To see only production data: Add filter `environment = production`
- To exclude dev data: Add filter `environment != development`

This allows you to use a single PostHog project while keeping data separate.

### Privacy Settings

- **Autocapture**: Disabled (only explicit events are tracked)
- **Session Recording**: Disabled
- **Do Not Track**: Respected
- **Data Retention**: Follows PostHog defaults

---

## Event Reference

### Authentication Events

| Event | Description | Trigger Location | Properties |
|-------|-------------|------------------|------------|
| `login_clicked` | User clicks the login button | `pages/login.tsx` | `source` |
| `oauth_started` | OAuth flow initiated with Reddit | `pages/api/auth/login.ts` | `source` |
| `signup_completed` | New user completes registration | `pages/api/auth/callback.ts` | `reddit_username`, `is_new_user`, `utm_source`, `utm_medium`, `utm_campaign` |
| `login_completed` | Returning user logs in | `pages/api/auth/callback.ts` | `reddit_username`, `is_new_user`, `utm_source`, `utm_medium`, `utm_campaign` |
| `logout` | User logs out | `contexts/AuthContext.tsx` | `source` |

### Revenue & Conversion Events (Tier 1)

| Event | Description | Trigger Location | Properties |
|-------|-------------|------------------|------------|
| `free_limit_reached` | User hits free tier limit | `pages/index.tsx`, `pages/settings.tsx` | `source`, `subreddit_count` |
| `upgrade_modal_opened` | Upgrade modal is displayed | `components/UpgradeModal.tsx` | `source` |
| `upgrade_clicked` | User clicks "Get Pro" button | `components/UpgradeModal.tsx` | `source` |
| `checkout_started` | Checkout session created | `pages/api/checkout/create-session.ts` | `plan`, `amount`, `currency` |
| `checkout_completed` | Payment successful | `pages/api/webhooks/dodo.ts` | `plan`, `amount`, `currency` |

### Engagement Events (Tier 2)

| Event | Description | Trigger Location | Properties |
|-------|-------------|------------------|------------|
| `first_post_created` | User's first successful post (activation) | `pages/api/queue.ts` | `subreddit_count`, `post_kind` |
| `post_submitted` | Post batch submitted for processing | `pages/api/queue.ts` | `subreddit_count`, `post_kind` |
| `post_success` | Individual post succeeded | `pages/api/queue.ts` | `post_kind` |
| `post_failed` | Individual post failed | `pages/api/queue.ts` | `post_kind`, `error_category` |
| `media_uploaded` | Media files included with post | `pages/api/queue.ts` | `media_type`, `file_count` |

### Feature Discovery Events (Tier 3)

| Event | Description | Trigger Location | Properties |
|-------|-------------|------------------|------------|
| `settings_visited` | User visits settings page | `pages/settings.tsx` | `source` |
| `category_created` | User creates a new category | `pages/settings.tsx` | `category_name` |
| `subreddit_search_used` | User searches for subreddits | `pages/settings.tsx` | `search_query` |
| `customize_post_clicked` | User opens per-subreddit customization | `pages/index.tsx` | `source` |

---

## Event Properties Reference

### Common Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `environment` | `string` | Auto-added: deployment environment | `"production"`, `"preview"`, `"development"` |
| `source` | `string` | Where the action originated | `"login_page"`, `"settings"`, `"header"` |

### User Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `reddit_username` | `string` | User's Reddit username | `"cool_redditor"` |
| `is_new_user` | `boolean` | Whether this is a new signup | `true` |
| `created_at` | `string` | Account creation timestamp | `"2024-01-15T10:30:00Z"` |

### Post Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `subreddit_count` | `number` | Number of subreddits in batch | `5` |
| `post_kind` | `string` | Type of post | `"image"`, `"video"`, `"link"`, `"self"`, `"gallery"` |
| `success_count` | `number` | Number of successful posts | `4` |
| `failed_count` | `number` | Number of failed posts | `1` |
| `error_category` | `string` | Classified error type | `"rate_limit"`, `"banned"`, `"auth"` |

### Media Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `media_type` | `string` | Type of media uploaded | `"image"`, `"video"`, `"gallery"` |
| `file_count` | `number` | Number of files uploaded | `3` |

### Upgrade/Checkout Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `plan` | `string` | Plan being purchased | `"pro"` |
| `amount` | `number` | Price amount | `199` |
| `currency` | `string` | Currency code | `"INR"` |

### Feature Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `category_name` | `string` | Name of created category | `"Gaming"` |
| `search_query` | `string` | Subreddit search term | `"programming"` |

### Marketing Attribution Properties (UTM)

These are automatically attached to **all** client-side events as PostHog "super properties" when a user arrives via a UTM-tagged link. They are also explicitly included in server-side `signup_completed` and `login_completed` events.

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `utm_source` | `string` | Marketing channel | `"reddit"`, `"producthunt"`, `"cloud_msg"` |
| `utm_medium` | `string` | Traffic medium | `"social"`, `"push"`, `"listing"` |
| `utm_campaign` | `string` | Campaign name | `"launch_feb2026"` |
| `utm_content` | `string` | Content variant / placement | `"subreddit_name"`, `"hero_cta"` |
| `utm_term` | `string` | Paid search keyword | `"reddit multi poster"` |
| `initial_referrer` | `string` | Full referrer URL at landing | `"https://www.reddit.com/r/startups/..."` |
| `referring_domain` | `string` | Hostname of the referrer | `"reddit.com"` |

**How it works:**
1. User lands on any page with `?utm_source=...` params
2. Params are stored in `sessionStorage` and registered as PostHog super properties
3. Every subsequent event in that session automatically includes the UTM data
4. On login/signup, UTM params are also sent server-side via a short-lived cookie

---

## Funnels

### 1. New User Acquisition Funnel

Tracks the journey of new users from landing to signup.

```
$pageview (URL contains "/login")
    ↓
login_clicked
    ↓
oauth_started
    ↓
signup_completed
```

**Key Metrics:**
- Login page → Click rate
- Click → OAuth start rate
- OAuth → Signup completion rate

---

### 2. User Activation Funnel

Tracks new users reaching their "aha moment" (first post).

```
signup_completed
    ↓
first_post_created
```

**Key Metrics:**
- Time to first post
- Activation rate (% of signups who post)

---

### 3. Returning User Funnel

Tracks returning user login flow.

```
$pageview (URL contains "/login")
    ↓
login_clicked
    ↓
login_completed
```

**Key Metrics:**
- Return visit → Login rate

---

### 4. Revenue Funnel (Free → Paid)

Tracks the upgrade journey from hitting limits to payment.

```
free_limit_reached
    ↓
upgrade_modal_opened
    ↓
upgrade_clicked
    ↓
checkout_started
    ↓
checkout_completed
```

**Key Metrics:**
- Limit hit → Modal open rate
- Modal → Click rate
- Click → Checkout start rate
- Checkout → Completion rate (payment success)

---

### 5. Post Engagement Funnel

Tracks post submission success rate.

```
post_submitted
    ↓
post_success
```

**Key Metrics:**
- Overall post success rate
- Failure rate by error category

---

### 6. Feature Discovery Funnel

Tracks users exploring app features.

```
login_completed / signup_completed
    ↓
settings_visited
    ↓
category_created / subreddit_search_used
```

**Key Metrics:**
- Settings page visit rate
- Feature adoption rate

---

### 7. Marketing Attribution Funnel

Tracks the full journey from a UTM-tagged marketing link to activation, broken down by channel.

```
$pageview (where utm_source is set)
    ↓
login_clicked
    ↓
signup_completed (with utm_source)
    ↓
first_post_created
```

**Key Metrics:**
- Channel → Signup conversion rate (by `utm_source`)
- Channel → Activation rate
- Best-performing campaign (`utm_campaign`)

**PostHog Setup:** Create this funnel and add a breakdown by `utm_source` to compare channels.

---

## UTM Link Templates for Launch

Use these links when sharing on different marketing channels:

| Channel | URL |
|---------|-----|
| Reddit | `https://yourapp.com/login?utm_source=reddit&utm_medium=social&utm_campaign=launch_feb2026&utm_content=SUBREDDIT_NAME` |
| Cloud Messaging | `https://yourapp.com/login?utm_source=cloud_msg&utm_medium=push&utm_campaign=launch_feb2026` |
| Product Hunt | `https://yourapp.com/login?utm_source=producthunt&utm_medium=listing&utm_campaign=launch_feb2026` |
| Direct / DM | `https://yourapp.com/login?utm_source=direct_dm&utm_medium=message&utm_campaign=launch_feb2026` |
| Twitter / X | `https://yourapp.com/login?utm_source=twitter&utm_medium=social&utm_campaign=launch_feb2026` |
| Hacker News | `https://yourapp.com/login?utm_source=hackernews&utm_medium=social&utm_campaign=launch_feb2026` |

Replace `yourapp.com` with your actual production domain.

---

## Implementation Details

### Client-Side Tracking

Client-side events are tracked using `posthog-js`:

```typescript
import { trackEvent } from '@/lib/posthog';

// Track an event
trackEvent('login_clicked', { source: 'login_page' });

// Track page view
trackPageView('/settings');

// Identify user after login
identifyUser(userId, { reddit_username: 'user123' });
```

**File:** `lib/posthog.ts`

### Server-Side Tracking

Server-side events are tracked using `posthog-node`:

```typescript
import { trackServerEvent, identifyServerUser } from '@/lib/posthog-server';

// Track an event
trackServerEvent(userId, 'checkout_completed', { 
  plan: 'pro', 
  amount: 199 
});

// Identify user
identifyServerUser(userId, { reddit_username: 'user123' });
```

**File:** `lib/posthog-server.ts`

> **Important:** Never import `posthog-server.ts` in client-side code. It uses Node.js modules that don't work in the browser.

---

## PostHog Dashboard Setup

### Recommended Dashboards

1. **Acquisition Dashboard**
   - New User Acquisition Funnel
   - Daily signups trend
   - Signup source breakdown

2. **Activation Dashboard**
   - User Activation Funnel
   - Time to first post histogram
   - Activation rate by cohort

3. **Revenue Dashboard**
   - Revenue Funnel
   - Free limit reached events over time
   - Conversion rate trends

4. **Engagement Dashboard**
   - Post Engagement Funnel
   - Posts per user distribution
   - Error category breakdown

5. **Marketing Attribution Dashboard**
   - Signups by Source (`signup_completed` breakdown by `utm_source`)
   - Page Views by Campaign (`$pageview` breakdown by `utm_campaign`)
   - Channel Conversion Rate (funnel: `$pageview` → `signup_completed` → `first_post_created`, broken down by `utm_source`)
   - Revenue by Channel (`checkout_completed` breakdown by `utm_source`)

### Cohort Suggestions

| Cohort Name | Definition |
|-------------|------------|
| Activated Users | Users who have `first_post_created` event |
| Power Users | Users with 10+ `post_success` events |
| Churned Users | Users with no events in last 30 days |
| Upgrade Candidates | Free users with `free_limit_reached` event |

---

## Debugging

### Verify Events Are Firing

1. Open browser DevTools → Network tab
2. Filter by `posthog` or `i.posthog.com`
3. Perform an action and check the request payload

### PostHog Debugger

1. Go to PostHog → Activity → Live Events
2. Filter by your user or event name
3. Verify events appear in real-time

### Common Issues

| Issue | Solution |
|-------|----------|
| Events not appearing | Check `NEXT_PUBLIC_POSTHOG_KEY` is set |
| Server events missing | Ensure API routes import from `posthog-server.ts` |
| User not identified | Call `identifyUser()` after login callback |
| Duplicate events | Check for multiple `trackEvent` calls |

---

## Adding New Events

1. **Add event type** to `lib/posthog.ts`:
   ```typescript
   export type AnalyticsEvent = 
     | 'existing_event'
     | 'new_event_name';  // Add here
   ```

2. **Add properties** to `EventProperties` interface if needed:
   ```typescript
   export interface EventProperties {
     // ... existing
     new_property?: string;
   }
   ```

3. **Track the event** at the appropriate location:
   ```typescript
   // Client-side
   trackEvent('new_event_name', { property: 'value' });
   
   // Server-side
   trackServerEvent(userId, 'new_event_name', { property: 'value' });
   ```

4. **Update this documentation** with the new event details.

---

## Data Privacy

- No PII (Personally Identifiable Information) is stored in event properties
- Reddit usernames are pseudonymous identifiers
- Users can opt-out via browser's Do Not Track setting
- No session recordings are captured
- All data is processed through PostHog's privacy-compliant infrastructure

---

*Last updated: February 2026*
