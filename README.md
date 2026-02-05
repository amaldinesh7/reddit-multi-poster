<p align="center">
  <img src="public/logo.png" alt="Reddit Multi Poster Logo" width="120" height="120" />
</p>

<h1 align="center">Reddit Multi Poster</h1>

<p align="center">
  <strong>Share once. Reach everywhere.</strong>
</p>

<p align="center">
  <a href="https://reddit-multi-poster.vercel.app">
    <img src="https://img.shields.io/badge/Try%20It-Live%20Demo-FF4500?style=for-the-badge&logo=reddit&logoColor=white" alt="Live Demo" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome" />
</p>

---

## The Problem We Solve

**We've all been there.**

You create something amazing - a photo, an article, a meme, a piece of art. You want to share it with the Reddit communities that would appreciate it most.

But then reality hits:

- You open r/pics and post... then r/photography... then r/art...
- Copy. Paste. Select flair. Submit. Repeat.
- 20 minutes later, you've posted to maybe 5 subreddits
- You forgot which ones you already posted to
- Reddit's spam filter flags you for posting too quickly
- Your motivation is gone, and half your audience never sees your content

**Sound familiar?**

We built Reddit Multi Poster because we were tired of this exact frustration. Content creators deserve better. **Your time should be spent creating, not copying and pasting.**

---

## The Solution

Reddit Multi Poster handles the tedious work so you can focus on what matters.

**One upload. One click. 30+ communities.**

- Upload your image or paste a URL once
- Select all the communities you want to reach
- Hit "Start Posting" and watch it happen
- Smart 15-minute delays keep you safe from spam filters
- Automatic flair detection means no more "Post removed: Missing flair" messages

---

## Who This Is For

**Content Creators** - Artists, photographers, and makers who want their work seen by the right audiences without spending hours on distribution.

**Community Members** - Redditors who participate in multiple related communities and want to share relevant content efficiently.

**Anyone Tired of Repetition** - If you've ever thought "there has to be a better way," this is it.

---

## Features That Actually Matter

| Feature | What It Means For You |
|---------|----------------------|
| **Bulk Posting** | Post to up to 30 subreddits with a single click |
| **Smart Scheduling** | Automatic 15-minute delays prevent spam flags |
| **Auto Flair Detection** | No more "post removed" surprises |
| **Real-Time Progress** | Watch each post succeed (or see exactly why it didn't) |
| **Secure OAuth** | We never see your Reddit password |
| **Free Tier** | Get started without paying a dime |

---

## Getting Started

### Option 1: Use the Live App (Recommended)

1. Visit [reddit-multi-poster.vercel.app](https://reddit-multi-poster.vercel.app)
2. Click "Continue with Reddit" to connect your account
3. Upload your content and select your communities
4. Hit "Start Posting" and you're done!

### Option 2: Run It Yourself

```bash
# Clone the repository
git clone https://github.com/yourusername/reddit-multi-poster.git
cd reddit-multi-poster

# Install dependencies
npm install

# Set up your environment (see SETUP.md for Reddit API credentials)
cp .env.example .env.local

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start posting!

---

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Upload Once   │ ──▶ │  Select Subs    │ ──▶ │  Start Posting  │
│   Image or URL  │     │  Up to 30+      │     │  One Click      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                        ┌───────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Smart Queue System                           │
│  • 15-min delays between posts (configurable)                   │
│  • Auto-selects appropriate flairs                              │
│  • Handles errors gracefully                                    │
│  • Shows real-time progress for each subreddit                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

Built with modern, reliable technologies:

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Reddit OAuth 2.0
- **Hosting**: Vercel

---

<details>
<summary><strong>Developer Setup</strong></summary>

### Prerequisites

- Node.js 18+
- Docker (for local Supabase)
- Reddit API credentials ([Get them here](https://www.reddit.com/prefs/apps))

### Local Development with Supabase

1. **Start Supabase locally**:
   ```bash
   npx supabase start
   ```

2. **Configure environment**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_SERVICE_ROLE_KEY=<from-supabase-start-output>
   REDDIT_CLIENT_ID=your_client_id
   REDDIT_CLIENT_SECRET=your_client_secret
   REDDIT_REDIRECT_URI=http://localhost:3000/api/auth/callback
   ```

3. **Apply migrations**:
   ```bash
   npx supabase db reset
   ```

4. **Run the app**:
   ```bash
   npm run dev
   ```

### Useful Commands

```bash
npx supabase status          # Check local Supabase status
npx supabase stop            # Stop local Supabase
npm run db:types             # Generate TypeScript types
npm run db:studio            # Open Supabase Studio
```

### Deployment

Migrations auto-deploy via GitHub Actions on push to `main`. See `.github/workflows/deploy-supabase.yml`.

For Vercel deployment, see [VERCEL_SETUP.md](./VERCEL_SETUP.md).

</details>

---

## Respecting Reddit's Rules

We take Reddit's guidelines seriously:

- **Built-in rate limiting** prevents spam detection
- **Respects individual subreddit rules** and requirements
- **Uses official Reddit OAuth** for secure authentication
- **Never stores your Reddit password**

Please always follow individual subreddit rules and Reddit's content policy when using this tool.

---

## Contributing

We welcome contributions! Whether it's:

- Reporting bugs
- Suggesting features
- Submitting pull requests
- Improving documentation

Feel free to [open an issue](https://github.com/yourusername/reddit-multi-poster/issues) or submit a PR.

---

## License

MIT License - feel free to use this for your own projects.

---

<p align="center">
  <strong>Stop copy-pasting. Start creating.</strong>
</p>

<p align="center">
  <a href="https://reddit-multi-poster.vercel.app">
    <img src="https://img.shields.io/badge/Try%20Reddit%20Multi%20Poster-FF4500?style=for-the-badge&logo=reddit&logoColor=white" alt="Try It Now" />
  </a>
</p>

<p align="center">
  Made with ❤️ for the Reddit community
</p>
