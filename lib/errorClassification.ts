/**
 * Error Classification Module
 * 
 * Provides enhanced error categorization for Reddit posting errors.
 * Categorizes errors as fixable_now, fixable_later, or unfixable,
 * with suggested actions for each error type.
 */

// ============================================================================
// Types
// ============================================================================

export type ErrorCategory = 'fixable_now' | 'fixable_later' | 'unfixable';

export type ErrorAction = 
  | 'edit_flair'
  | 'edit_title'
  | 'edit_content'
  | 'wait_retry'
  | 'reauth'
  | 'remove'
  | 'manual_retry'
  | 'change_media';

export type ErrorCode =
  | 'flair_required'
  | 'rate_limited'
  | 'karma_required'
  | 'user_banned'
  | 'duplicate_post'
  | 'auth_error'
  | 'title_invalid'
  | 'subreddit_private'
  | 'media_error'
  | 'nsfw_error'
  | 'network_error'
  | 'post_type_not_allowed'
  | 'videos_not_allowed'
  | 'content_too_long'
  | 'account_too_new'
  | 'unknown_error';

export interface ClassifiedError {
  /** Original error message from Reddit */
  originalMessage: string;
  /** Classified error code */
  code: ErrorCode;
  /** Error category for UI grouping */
  category: ErrorCategory;
  /** Suggested action for the user */
  action: ErrorAction;
  /** Human-friendly message to display */
  userMessage: string;
  /** Additional details/instructions */
  details?: string;
  /** Icon name for UI */
  icon: 'tag' | 'clock' | 'ban' | 'key' | 'text' | 'lock' | 'image' | 'video' | 'wifi' | 'alert';
}

// ============================================================================
// Error Classification Logic
// ============================================================================

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  code: ErrorCode;
  category: ErrorCategory;
  action: ErrorAction;
  userMessage: string;
  details?: string;
  icon: ClassifiedError['icon'];
}> = [
  // Flair errors - fixable now
  {
    pattern: /flair|pick a flair|flair_required|flair is required/i,
    code: 'flair_required',
    category: 'fixable_now',
    action: 'edit_flair',
    userMessage: 'Flair required',
    details: 'Select a flair for this subreddit and retry.',
    icon: 'tag',
  },
  
  // Title errors - fixable now
  {
    pattern: /title.*(required|invalid|too long|too short|character|length)|must be under \d+ char/i,
    code: 'title_invalid',
    category: 'fixable_now',
    action: 'edit_title',
    userMessage: 'Title issue',
    details: 'Adjust your title to meet subreddit requirements.',
    icon: 'text',
  },
  
  // Content too long - fixable now
  {
    pattern: /content.*too long|body.*too long|text.*exceeds|character limit/i,
    code: 'content_too_long',
    category: 'fixable_now',
    action: 'edit_content',
    userMessage: 'Content too long',
    details: 'Shorten your post content.',
    icon: 'text',
  },
  
  // Rate limiting - fixable later (wait)
  {
    pattern: /rate limit|try again|too (much|many|fast)|wait|slow down|doing that too much/i,
    code: 'rate_limited',
    category: 'fixable_later',
    action: 'wait_retry',
    userMessage: 'Rate limited',
    details: 'Reddit is limiting posts. Wait a few minutes and retry.',
    icon: 'clock',
  },
  
  // Auth errors - fixable now (re-login)
  {
    pattern: /unauthorized|login|auth|token.*expired|session.*expired|not logged in/i,
    code: 'auth_error',
    category: 'fixable_now',
    action: 'reauth',
    userMessage: 'Login expired',
    details: 'Sign in again to continue posting.',
    icon: 'key',
  },
  
  // Network errors - fixable later (retry)
  {
    pattern: /network|timeout|connection|failed to fetch|ECONNREFUSED|ETIMEDOUT/i,
    code: 'network_error',
    category: 'fixable_later',
    action: 'manual_retry',
    userMessage: 'Connection issue',
    details: 'Check your internet and try again.',
    icon: 'wifi',
  },
  
  // Media errors - maybe fixable
  {
    pattern: /media|image|video|gif|upload|file.*type|unsupported.*format/i,
    code: 'media_error',
    category: 'fixable_now',
    action: 'change_media',
    userMessage: 'Media issue',
    details: 'This subreddit may not support this media type.',
    icon: 'image',
  },
  
  // Video not allowed in subreddit
  {
    pattern: /NO_VIDEOS|doesn't allow videos|videos are not allowed|community doesn't allow videos/i,
    code: 'videos_not_allowed',
    category: 'unfixable',
    action: 'remove',
    userMessage: 'Videos not allowed',
    details: 'This subreddit doesn\'t allow video posts. Try posting as a GIF or image instead.',
    icon: 'video',
  },

  // Post type not allowed - maybe fixable
  {
    pattern: /only allows.*(image|video|text|link)|post type|not allowed|submissions restricted/i,
    code: 'post_type_not_allowed',
    category: 'fixable_now',
    action: 'change_media',
    userMessage: 'Wrong post type',
    details: 'This subreddit only allows certain post types.',
    icon: 'image',
  },
  
  // Karma/age requirements - unfixable (for now)
  {
    pattern: /karma|account.*age|too new|not enough.*karma|minimum.*karma/i,
    code: 'karma_required',
    category: 'unfixable',
    action: 'remove',
    userMessage: 'Karma required',
    details: 'You need more karma or older account for this subreddit.',
    icon: 'ban',
  },
  
  // Account too new - unfixable (for now)
  {
    pattern: /account.*new|account.*created|days? old/i,
    code: 'account_too_new',
    category: 'unfixable',
    action: 'remove',
    userMessage: 'Account too new',
    details: 'Your account is too new for this subreddit.',
    icon: 'clock',
  },
  
  // Banned - unfixable
  {
    pattern: /banned|not allowed to post|suspended|prohibited/i,
    code: 'user_banned',
    category: 'unfixable',
    action: 'remove',
    userMessage: 'Cannot post here',
    details: 'You may be banned from this subreddit.',
    icon: 'ban',
  },
  
  // Private/restricted subreddit - unfixable
  {
    pattern: /private|restricted|approved.*only|members? only/i,
    code: 'subreddit_private',
    category: 'unfixable',
    action: 'remove',
    userMessage: 'Private subreddit',
    details: 'This subreddit is private or restricted.',
    icon: 'lock',
  },
  
  // Duplicate post - consider success
  {
    pattern: /duplicate|already posted|already submitted|this link|repost/i,
    code: 'duplicate_post',
    category: 'unfixable',
    action: 'remove',
    userMessage: 'Already posted',
    details: 'This content was already posted here.',
    icon: 'alert',
  },
  
  // NSFW errors
  {
    pattern: /nsfw|over 18|adult|mature|18\+/i,
    code: 'nsfw_error',
    category: 'unfixable',
    action: 'remove',
    userMessage: 'NSFW restriction',
    details: 'Content or subreddit has NSFW restrictions.',
    icon: 'ban',
  },
];

/**
 * Classify a Reddit error message into a structured error object.
 */
export function classifyError(errorMessage: string): ClassifiedError {
  const msg = errorMessage.toLowerCase();
  
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(msg)) {
      return {
        originalMessage: errorMessage,
        code: pattern.code,
        category: pattern.category,
        action: pattern.action,
        userMessage: pattern.userMessage,
        details: pattern.details,
        icon: pattern.icon,
      };
    }
  }
  
  // Default to unknown error
  return {
    originalMessage: errorMessage,
    code: 'unknown_error',
    category: 'fixable_later',
    action: 'manual_retry',
    userMessage: 'Posting failed',
    details: errorMessage,
    icon: 'alert',
  };
}

/**
 * Check if an error should be treated as a pseudo-success.
 * For example, "duplicate post" means the post already exists.
 */
export function isPseudoSuccess(error: ClassifiedError): boolean {
  return error.code === 'duplicate_post';
}

/**
 * Check if an error is likely to succeed on retry without changes.
 */
export function isRetryable(error: ClassifiedError): boolean {
  return error.category === 'fixable_later' || error.action === 'manual_retry';
}

/**
 * Check if the user can fix this error by editing the post.
 */
export function isEditable(error: ClassifiedError): boolean {
  return ['edit_flair', 'edit_title', 'edit_content', 'change_media'].includes(error.action);
}

/**
 * Get the primary edit field for an error.
 */
export function getEditField(error: ClassifiedError): 'flair' | 'title' | 'content' | 'media' | null {
  switch (error.action) {
    case 'edit_flair':
      return 'flair';
    case 'edit_title':
      return 'title';
    case 'edit_content':
      return 'content';
    case 'change_media':
      return 'media';
    default:
      return null;
  }
}

/**
 * Group errors by category for UI display.
 */
export function groupErrorsByCategory<T extends { error?: ClassifiedError }>(
  items: T[]
): Record<ErrorCategory, T[]> {
  const groups: Record<ErrorCategory, T[]> = {
    fixable_now: [],
    fixable_later: [],
    unfixable: [],
  };
  
  for (const item of items) {
    if (item.error) {
      groups[item.error.category].push(item);
    }
  }
  
  return groups;
}

/**
 * Group errors by action for bulk operations.
 */
export function groupErrorsByAction<T extends { error?: ClassifiedError }>(
  items: T[]
): Partial<Record<ErrorAction, T[]>> {
  const groups: Partial<Record<ErrorAction, T[]>> = {};
  
  for (const item of items) {
    if (item.error) {
      const action = item.error.action;
      if (!groups[action]) {
        groups[action] = [];
      }
      groups[action]!.push(item);
    }
  }
  
  return groups;
}

/**
 * Get a summary message for a group of errors.
 */
export function getErrorGroupSummary(category: ErrorCategory, count: number): string {
  switch (category) {
    case 'fixable_now':
      return `${count} ${count === 1 ? 'post' : 'posts'} can be fixed now`;
    case 'fixable_later':
      return `${count} ${count === 1 ? 'post' : 'posts'} can be retried`;
    case 'unfixable':
      return `${count} ${count === 1 ? 'post' : 'posts'} cannot be posted`;
  }
}

/**
 * Get an action label for UI buttons.
 */
export function getActionLabel(action: ErrorAction): string {
  switch (action) {
    case 'edit_flair':
      return 'Fix Flair';
    case 'edit_title':
      return 'Fix Title';
    case 'edit_content':
      return 'Fix Content';
    case 'wait_retry':
      return 'Retry Later';
    case 'reauth':
      return 'Sign In';
    case 'remove':
      return 'Remove';
    case 'manual_retry':
      return 'Retry';
    case 'change_media':
      return 'Fix Media';
  }
}

export function getErrorGuidance(error: ClassifiedError): { reason: string; steps: string[] } {
  switch (error.action) {
    case 'edit_flair':
      return {
        reason: 'This community requires a flair.',
        steps: ['Pick a flair that matches your post.', 'Retry your post.'],
      };
    case 'edit_title':
      return {
        reason: 'The title does not meet this community\'s rules.',
        steps: ['Adjust the title to fit their requirements.', 'Retry your post.'],
      };
    case 'edit_content':
      return {
        reason: 'The post body is too long or has restricted content.',
        steps: ['Shorten or edit the body to comply.', 'Retry your post.'],
      };
    case 'change_media':
      return {
        reason: 'This community does not allow this media type.',
        steps: ['Try a different post type (link, self, or image).', 'Retry your post.'],
      };
    case 'wait_retry':
      return {
        reason: 'Reddit is rate-limiting your account.',
        steps: ['Wait a few minutes.', 'Retry your post.'],
      };
    case 'reauth':
      return {
        reason: 'Your login session expired.',
        steps: ['Sign in again, then retry.'],
      };
    case 'remove':
      return {
        reason: 'This community won’t accept this post from your account.',
        steps: ['Remove it or try a different community.'],
      };
    case 'manual_retry':
    default:
      return {
        reason: 'This looks like a temporary failure.',
        steps: ['Retry your post.'],
      };
  }
}
