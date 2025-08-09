# Reddit Multi-Poster MVP Setup

## 1. Get Reddit API Credentials (5 minutes)

1. Go to https://www.reddit.com/prefs/apps
2. Click "Create App" or "Create Another App"
3. Fill out the form:
   - **Name**: Reddit Multi-Poster (or any name you want)
   - **App type**: Select "web app"
   - **Description**: Optional
   - **About URL**: Optional
   - **Redirect URI**: `http://localhost:3000/api/auth/callback`
4. Click "Create app"
5. Copy your credentials:
   - **Client ID**: The string under the app name (looks like: `abc123def456`)
   - **Client Secret**: The "secret" field

## 2. Create Environment File

Create a file named `.env.local` in the project root with these variables:

```bash
REDDIT_CLIENT_ID=your_client_id_here
REDDIT_CLIENT_SECRET=your_client_secret_here
REDDIT_REDIRECT_URI=http://localhost:3000/api/auth/callback
REDDIT_USER_AGENT=MultiPoster/1.0
SESSION_SECRET=change_me_to_a_long_random_string_for_production
```

Replace `your_client_id_here` and `your_client_secret_here` with the actual values from step 1.

## 3. Run the Application

```bash
npm run dev
```

Then open http://localhost:3000

## 4. Test the MVP

1. Click "Login with Reddit"
2. Authorize the app
3. Upload an image or paste a URL
4. Select subreddits (up to 30)
5. Write your caption
6. Configure flairs (optional)
7. Click "Start Posting" to begin the queue

Posts will be submitted with 15-minute delays between each subreddit.

## Environment Variables Explained

- `REDDIT_CLIENT_ID`: Your Reddit app's client ID
- `REDDIT_CLIENT_SECRET`: Your Reddit app's secret key
- `REDDIT_REDIRECT_URI`: Where Reddit sends users after OAuth (must match Reddit app settings)
- `REDDIT_USER_AGENT`: Identifies your app to Reddit's API
- `SESSION_SECRET`: Used for secure session handling (change for production)

## Troubleshooting

- **"Invalid client_id"**: Check your Reddit app credentials
- **"Redirect URI mismatch"**: Ensure the redirect URI matches exactly in both Reddit app settings and `.env.local`
- **"Unauthorized"**: Make sure you're logged in and tokens haven't expired 