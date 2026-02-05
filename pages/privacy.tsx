import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const LAST_UPDATED = 'February 5, 2026';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - Reddit Multi Poster</title>
        <meta name="description" content="Privacy policy for Reddit Multi Poster. Simple, friendly explanation of how we handle your data." />
        <meta name="robots" content="index, follow" />
      </Head>

      <div className="min-h-viewport bg-background flex flex-col">
        {/* Simple Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
          <div className="container mx-auto px-4 py-4 max-w-3xl">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to app
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
          <article className="prose prose-neutral dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline max-w-none">
            <h1 className="text-3xl sm:text-4xl mb-2">Privacy Policy</h1>
            <p className="text-muted-foreground text-sm mt-0 mb-8">
              Last updated: {LAST_UPDATED}
            </p>

            {/* TL;DR */}
            <div className="not-prose bg-card/50 border border-border/50 rounded-lg p-4 sm:p-6 mb-8">
              <h2 className="text-lg font-semibold mb-3">TL;DR</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>We use Reddit OAuth to post on your behalf - that&apos;s the core of what we do</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>We save your subreddit preferences so you don&apos;t have to re-select them every time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>We don&apos;t store your card details - payments are handled by Dodo Payments</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>No tracking cookies, no ads, no selling your data</span>
                </li>
              </ul>
            </div>

            <h2>What We Collect</h2>
            <p>
              When you log in with Reddit, we get access to some basic info about your account:
            </p>
            <ul>
              <li><strong>Your Reddit username</strong> - so we know who you are</li>
              <li><strong>Your karma and account age</strong> - displayed in the app to help you understand posting eligibility</li>
              <li><strong>Your subscribed subreddits</strong> - so you can easily pick where to post</li>
            </ul>
            <p>
              We also store:
            </p>
            <ul>
              <li><strong>Your saved subreddits and flair preferences</strong> - so your favorite communities are ready to go</li>
              <li><strong>Your subscription status</strong> - if you&apos;ve upgraded to Pro</li>
            </ul>
            <p>
              That&apos;s it. We don&apos;t read your DMs, we don&apos;t track your browsing, and we definitely don&apos;t sell anything to anyone.
            </p>

            <h2>How We Use Your Data</h2>
            <p>Pretty straightforward:</p>
            <ul>
              <li><strong>To post to Reddit</strong> - That&apos;s literally why you&apos;re here</li>
              <li><strong>To remember your preferences</strong> - So you don&apos;t start from scratch each time</li>
              <li><strong>To process payments</strong> - If you upgrade to Pro (handled by Dodo Payments)</li>
              <li><strong>To fix bugs</strong> - We use error tracking to catch and fix issues</li>
            </ul>

            <h2>Third-Party Services</h2>
            <p>We use a few services to make this app work:</p>
            <ul>
              <li>
                <strong>Reddit API</strong> - For authentication and posting. 
                Their <a href="https://www.reddit.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">privacy policy</a> applies when you use Reddit.
              </li>
              <li>
                <strong>Supabase</strong> - Our database provider. Stores your preferences securely.
              </li>
              <li>
                <strong>Sentry</strong> - Error tracking. Helps us fix bugs. Data is anonymized.
              </li>
              <li>
                <strong>Dodo Payments</strong> - Handles Pro subscriptions. We never see your card number.
              </li>
            </ul>

            <h2>Cookies</h2>
            <p>
              We use cookies, but only the essential ones:
            </p>
            <ul>
              <li><strong>Authentication cookies</strong> - Keep you logged in</li>
              <li><strong>Session cookies</strong> - Remember your preferences during your visit</li>
            </ul>
            <p>
              No tracking cookies. No advertising cookies. No &quot;we&apos;d like to personalize your experience&quot; nonsense.
            </p>

            <h2>Your Rights</h2>
            <p>You&apos;re in control of your data:</p>
            <ul>
              <li>
                <strong>Delete your data</strong> - Log out, then go to your{' '}
                <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer">
                  Reddit app permissions
                </a>{' '}
                and revoke access to Reddit Multi Poster. This removes our ability to access your Reddit account.
              </li>
              <li>
                <strong>Request your data</strong> - Email us and we&apos;ll send you everything we have on you (spoiler: it&apos;s not much).
              </li>
              <li>
                <strong>Ask questions</strong> - Confused about anything? Just reach out.
              </li>
            </ul>

            <h2>Data Security</h2>
            <p>
              We take reasonable measures to protect your data. All connections use HTTPS, 
              passwords are never stored (we use Reddit OAuth), and we follow industry 
              best practices for security.
            </p>
            <p>
              That said, no system is 100% secure. If you discover a security issue, 
              please let us know responsibly.
            </p>

            <h2>Changes to This Policy</h2>
            <p>
              If we make significant changes, we&apos;ll update the &quot;Last updated&quot; date at 
              the top. For major changes that affect how we handle your data, we&apos;ll 
              try to give you a heads up in the app.
            </p>

            <h2>Contact</h2>
            <p>
              Questions? Concerns? Just want to say hi?
            </p>
            <p>
              Email us at: <a href="mailto:privacy@redditposter.app">privacy@redditposter.app</a>
            </p>

            <hr className="my-8" />

            <p className="text-sm text-muted-foreground">
              This privacy policy is written in plain language because we believe you 
              shouldn&apos;t need a law degree to understand how your data is handled.
            </p>
          </article>
        </main>

      </div>
    </>
  );
}
