/**
 * Notification service for alerting on important events.
 * Currently supports Slack notifications only.
 *
 * Environment variables:
 * - SLACK_WEBHOOK_URL: Slack incoming webhook URL for notifications
 */

// ============================================================================
// Types
// ============================================================================

export interface NewUserData {
  id: string;
  reddit_username: string;
  reddit_avatar_url?: string | null;
  created_at: string;
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  accessory?: {
    type: string;
    image_url: string;
    alt_text: string;
  };
  elements?: Array<{
    type: string;
    text?: string;
    url?: string;
  }>;
}

// ============================================================================
// Slack Notifications
// ============================================================================

/**
 * Send a Slack notification via webhook.
 * @param webhookUrl - Slack incoming webhook URL
 * @param payload - Slack message payload
 */
async function sendSlackMessage(
  webhookUrl: string,
  payload: { text: string; blocks?: SlackBlock[] }
): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Slack notification failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
}

/**
 * Send a new user signup alert to Slack.
 */
export async function sendSlackNewUserAlert(user: NewUserData): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('Slack webhook not configured, skipping notification');
    return;
  }

  const redditProfileUrl = `https://reddit.com/user/${user.reddit_username}`;
  const timestamp = new Date(user.created_at).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🎉 New User Signup!',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Reddit Username:* <${redditProfileUrl}|u/${user.reddit_username}>`,
      },
      ...(user.reddit_avatar_url && {
        accessory: {
          type: 'image',
          image_url: user.reddit_avatar_url,
          alt_text: user.reddit_username,
        },
      }),
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*User ID:* \`${user.id}\`\n*Signed up:* ${timestamp}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `View on Reddit: ${redditProfileUrl}`,
        },
      ],
    },
  ];

  await sendSlackMessage(webhookUrl, {
    text: `New user signup: u/${user.reddit_username}`,
    blocks,
  });
}

// ============================================================================
// Combined Alert Function
// ============================================================================

/**
 * Send new user signup alerts to all configured channels.
 * Currently only Slack is supported.
 * Doesn't throw on failure to avoid breaking the webhook response.
 */
export async function notifyNewUserSignup(user: NewUserData): Promise<void> {
  await sendSlackNewUserAlert(user);
}
