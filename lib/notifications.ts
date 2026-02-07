/**
 * Notification service for alerting on important events.
 * Supports Slack and Email notifications.
 *
 * Environment variables:
 * - SLACK_WEBHOOK_URL: Slack incoming webhook URL for notifications
 * - RESEND_API_KEY: Resend API key for email notifications
 * - ALERT_EMAIL_TO: Email address to receive alerts
 * - ALERT_EMAIL_FROM: Sender email address (must be verified in Resend)
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
// Email Notifications (using Resend)
// ============================================================================

/**
 * Send an email using Resend API.
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML email body
 */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM || 'alerts@yourdomain.com';

  if (!apiKey) {
    console.log('Resend API key not configured, skipping email notification');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Email notification failed:', error);
    }
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
}

/**
 * Send a new user signup alert via email.
 */
export async function sendEmailNewUserAlert(user: NewUserData): Promise<void> {
  const to = process.env.ALERT_EMAIL_TO;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || !to) {
    console.log('Email notifications not configured, skipping');
    return;
  }

  const redditProfileUrl = `https://reddit.com/user/${user.reddit_username}`;
  const timestamp = new Date(user.created_at).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'long',
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff4500, #ff6b35); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .avatar { width: 64px; height: 64px; border-radius: 50%; margin-right: 15px; vertical-align: middle; }
          .user-info { display: inline-block; vertical-align: middle; }
          .label { color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
          .value { font-size: 16px; font-weight: 500; }
          .detail-row { margin: 15px 0; padding: 10px; background: white; border-radius: 4px; }
          .button { display: inline-block; background: #ff4500; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🎉 New User Signup!</h1>
          </div>
          <div class="content">
            <div style="margin-bottom: 20px;">
              ${user.reddit_avatar_url ? `<img src="${user.reddit_avatar_url}" alt="${user.reddit_username}" class="avatar">` : ''}
              <div class="user-info">
                <div class="label">Reddit Username</div>
                <div class="value">u/${user.reddit_username}</div>
              </div>
            </div>
            
            <div class="detail-row">
              <div class="label">User ID</div>
              <div class="value" style="font-family: monospace;">${user.id}</div>
            </div>
            
            <div class="detail-row">
              <div class="label">Signed Up</div>
              <div class="value">${timestamp}</div>
            </div>
            
            <a href="${redditProfileUrl}" class="button">View Reddit Profile →</a>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail(to, `New User: u/${user.reddit_username}`, html);
}

// ============================================================================
// Combined Alert Function
// ============================================================================

/**
 * Send new user signup alerts to all configured channels.
 * Runs notifications in parallel and doesn't throw on failure.
 */
export async function notifyNewUserSignup(user: NewUserData): Promise<void> {
  // Run notifications in parallel - don't let one failure block others
  await Promise.allSettled([
    sendSlackNewUserAlert(user),
    sendEmailNewUserAlert(user),
  ]);
}
