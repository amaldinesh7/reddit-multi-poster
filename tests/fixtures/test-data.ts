/**
 * Test data constants for E2E tests.
 * These mock objects represent various application states and API responses.
 */

export const testData = {
  /**
   * Mock user data for authentication tests
   */
  users: {
    standard: {
      name: 'TestUser',
      id: 'test-reddit-id-123',
      icon_img: 'https://www.redditstatic.com/avatars/defaults/v2/avatar_default_1.png',
    },
    withCustomAvatar: {
      name: 'CustomAvatarUser',
      id: 'test-reddit-id-456',
      icon_img: 'https://styles.redditmedia.com/t5_example/styles/profileIcon.jpg',
    },
  },

  /**
   * Mock Supabase user IDs
   */
  supabaseUsers: {
    standard: 'test-supabase-uuid-12345',
    secondary: 'test-supabase-uuid-67890',
  },

  /**
   * Mock category configurations
   */
  categories: {
    default: [
      {
        id: 'cat-general-001',
        name: 'General',
        position: 0,
        collapsed: false,
        user_subreddits: [
          { id: 'sub-001', subreddit_name: 'pics', position: 0, category_id: 'cat-general-001' },
          { id: 'sub-002', subreddit_name: 'images', position: 1, category_id: 'cat-general-001' },
          { id: 'sub-003', subreddit_name: 'gifs', position: 2, category_id: 'cat-general-001' },
        ],
      },
      {
        id: 'cat-tech-002',
        name: 'Technology',
        position: 1,
        collapsed: false,
        user_subreddits: [
          { id: 'sub-004', subreddit_name: 'technology', position: 0, category_id: 'cat-tech-002' },
          { id: 'sub-005', subreddit_name: 'programming', position: 1, category_id: 'cat-tech-002' },
        ],
      },
    ],
    empty: [],
    withManySubreddits: [
      {
        id: 'cat-large-001',
        name: 'Large Category',
        position: 0,
        collapsed: false,
        user_subreddits: Array.from({ length: 30 }, (_, i) => ({
          id: `sub-large-${i}`,
          subreddit_name: `testsubreddit${i}`,
          position: i,
          category_id: 'cat-large-001',
        })),
      },
    ],
  },

  /**
   * Mock subreddit data with flair configurations
   */
  subreddits: {
    withRequiredFlair: {
      name: 'askreddit',
      flairs: [
        { id: 'flair-ask-1', text: 'Discussion', text_editable: false },
        { id: 'flair-ask-2', text: 'Question', text_editable: false },
        { id: 'flair-ask-3', text: 'Serious Replies Only', text_editable: false },
      ],
      required: true,
    },
    withOptionalFlair: {
      name: 'pics',
      flairs: [
        { id: 'flair-pics-1', text: '[OC]', text_editable: false },
        { id: 'flair-pics-2', text: 'Photography', text_editable: false },
      ],
      required: false,
    },
    withoutFlair: {
      name: 'images',
      flairs: [],
      required: false,
    },
    withEditableFlair: {
      name: 'technology',
      flairs: [
        { id: 'flair-tech-1', text: 'News', text_editable: true },
        { id: 'flair-tech-2', text: 'Discussion', text_editable: true },
      ],
      required: false,
    },
  },

  /**
   * Mock search results
   */
  searchResults: {
    programming: [
      { name: 'programming', subscribers: 5000000, over18: false, url: '/r/programming/' },
      { name: 'learnprogramming', subscribers: 3000000, over18: false, url: '/r/learnprogramming/' },
      { name: 'programminghumor', subscribers: 1500000, over18: false, url: '/r/programminghumor/' },
    ],
    empty: [],
    singleResult: [
      { name: 'uniquesubreddit', subscribers: 50000, over18: false, url: '/r/uniquesubreddit/' },
    ],
  },

  /**
   * Mock posting queue responses
   */
  queueResponses: {
    successfulPost: {
      status: 'success',
      url: 'https://www.reddit.com/r/test/comments/abc123/',
      id: 'abc123',
    },
    failedPost: {
      status: 'error',
      error: 'SUBREDDIT_NOEXIST',
    },
    rateLimited: {
      status: 'error',
      error: 'RATELIMIT',
    },
  },

  /**
   * Test post content
   */
  posts: {
    simple: {
      title: 'Test Post Title',
      url: 'https://example.com/image.jpg',
    },
    withSpecialChars: {
      title: 'Test "Title" with <special> & characters [2024]',
      url: 'https://example.com/image.jpg',
    },
    maxLength: {
      title: 'A'.repeat(300), // Max Reddit title length
      url: 'https://example.com/image.jpg',
    },
    empty: {
      title: '',
      url: '',
    },
  },
};

/**
 * Helper to generate streaming queue response
 */
export const generateQueueStreamResponse = (
  subreddits: string[],
  outcomes: ('success' | 'error')[] = []
): string => {
  const lines: string[] = [
    JSON.stringify({ status: 'started', total: subreddits.length }),
  ];

  subreddits.forEach((subreddit, index) => {
    lines.push(JSON.stringify({ index, status: 'posting', subreddit }));

    const outcome = outcomes[index] || 'success';
    if (outcome === 'success') {
      lines.push(
        JSON.stringify({
          index,
          status: 'success',
          subreddit,
          url: `https://reddit.com/r/${subreddit}/comments/test${index}`,
          id: `test${index}`,
        })
      );
    } else {
      lines.push(
        JSON.stringify({
          index,
          status: 'error',
          subreddit,
          error: 'Post failed',
        })
      );
    }

    // Add waiting status between posts (except for the last one)
    if (index < subreddits.length - 1) {
      lines.push(JSON.stringify({ index, status: 'waiting', delaySeconds: 2 }));
    }
  });

  lines.push(JSON.stringify({ status: 'completed' }));

  return lines.join('\n');
};
