# Reddit Multi-Poster

A web application that lets you post the same content to multiple Reddit communities at once, with automatic scheduling to respect Reddit's posting limits.

## What It Does

- **Upload Once, Post Everywhere**: Upload an image or paste a URL and post it to up to 30 different subreddits with a single click
- **Smart Scheduling**: Automatically spaces out your posts with 15-minute delays between each subreddit to avoid spam detection
- **Flair Management**: Automatically selects appropriate flairs for each subreddit, or lets you customize them
- **Queue System**: Shows you the status of all your posts in real-time as they're being submitted
- **Reddit OAuth**: Securely connects to your Reddit account - no password storage required

## How To Use

1. **Login**: Click "Login with Reddit" and authorize the app
2. **Upload Content**: Either upload an image file or paste a URL to content you want to share
3. **Choose Subreddits**: Select which communities you want to post to (the app comes pre-configured with popular subreddits)
4. **Write Your Post**: Add a title/caption for your post (100 character limit)
5. **Configure Options**: 
   - Set custom flairs for specific subreddits
6. **Start Posting**: Hit "Start Posting" and watch as your content gets submitted to each subreddit automatically

## Features

- **Bulk Posting**: Post to multiple subreddits simultaneously
- **Rate Limiting**: Built-in delays prevent you from hitting Reddit's spam filters
- **Flair Detection**: Automatically finds and applies appropriate flairs for each subreddit
- **Progress Tracking**: Real-time status updates for each post in your queue
- **Error Handling**: Shows you which posts succeeded and which failed, with reasons

## Quick Setup

1. Get Reddit API credentials (takes 2 minutes - see SETUP.md for details)
2. Create a `.env.local` file with your credentials
3. Run `npm install` and `npm run dev`
4. Open http://localhost:3000 and start posting!

## Perfect For

- Content creators who want to share across multiple communities
- Anyone tired of manually posting the same content to different subreddits
- Users who want to maximize their content's reach while respecting Reddit's rules

---

**Note**: This tool respects Reddit's API terms of service and includes built-in rate limiting to prevent spam. Always follow individual subreddit rules and Reddit's content policy.
