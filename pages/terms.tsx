import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AppFooter } from '@/components/layout';

const LAST_UPDATED = 'February 5, 2026';

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service - Reddit Multi Poster</title>
        <meta name="description" content="Terms of service for Reddit Multi Poster. Plain-language terms for using our cross-posting tool." />
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
            <h1 className="text-3xl sm:text-4xl mb-2">Terms of Service</h1>
            <p className="text-muted-foreground text-sm mt-0 mb-8">
              Last updated: {LAST_UPDATED}
            </p>

            {/* The Basics */}
            <div className="not-prose bg-card/50 border border-border/50 rounded-lg p-4 sm:p-6 mb-8">
              <h2 className="text-lg font-semibold mb-3">The Basics</h2>
              <p className="text-sm text-muted-foreground">
                Reddit Multi Poster helps you post to multiple subreddits at once. 
                By using this app, you agree to these terms. They&apos;re pretty reasonable - 
                mostly &quot;don&apos;t spam&quot; and &quot;follow Reddit&apos;s rules.&quot;
              </p>
            </div>

            <h2>What This Tool Does</h2>
            <p>
              Let&apos;s be clear about what we do:
            </p>
            <ul>
              <li>We help you post your content to multiple subreddits</li>
              <li>We remember your favorite subreddits and flair preferences</li>
              <li>We let you queue posts and schedule them (with Pro)</li>
            </ul>
            <p>
              What we don&apos;t do:
            </p>
            <ul>
              <li>We don&apos;t guarantee your posts won&apos;t get removed by subreddit mods</li>
              <li>We don&apos;t control Reddit&apos;s API or uptime</li>
              <li>We don&apos;t bypass any subreddit restrictions</li>
            </ul>

            <h2>Your Responsibilities</h2>
            <p>
              When you use Reddit Multi Poster, you agree to:
            </p>
            <ul>
              <li>
                <strong>Follow Reddit&apos;s rules</strong> - This includes their{' '}
                <a href="https://www.redditinc.com/policies/content-policy" target="_blank" rel="noopener noreferrer">
                  Content Policy
                </a>{' '}
                and{' '}
                <a href="https://www.redditinc.com/policies/user-agreement" target="_blank" rel="noopener noreferrer">
                  User Agreement
                </a>
              </li>
              <li>
                <strong>Follow subreddit rules</strong> - Each community has its own guidelines. Check them before posting.
              </li>
              <li>
                <strong>Don&apos;t spam</strong> - Posting the same thing everywhere isn&apos;t cool. Cross-posting is fine when it&apos;s relevant.
              </li>
              <li>
                <strong>Don&apos;t abuse the service</strong> - No bots, no automation beyond what we provide, no attempts to break things.
              </li>
              <li>
                <strong>Keep your account secure</strong> - Your Reddit credentials are your responsibility.
              </li>
            </ul>

            <h2>Pro Subscription</h2>
            <p>
              We offer a paid Pro tier with extra features. Here&apos;s how that works:
            </p>
            <ul>
              <li>
                <strong>Billing</strong> - Payments are processed by{' '}
                <a href="https://dodopayments.com" target="_blank" rel="noopener noreferrer">
                  Dodo Payments
                </a>. 
                We never see your card number.
              </li>
              <li>
                <strong>Cancellation</strong> - You can cancel anytime. You&apos;ll keep Pro features until the end of your billing period.
              </li>
              <li>
                <strong>Refunds</strong> - We generally don&apos;t offer refunds since you can cancel anytime. 
                If something went genuinely wrong, reach out and we&apos;ll work it out.
              </li>
              <li>
                <strong>Price changes</strong> - If we change prices, existing subscribers keep their current rate until they cancel.
              </li>
            </ul>

            <h2>Content and Copyright</h2>
            <p>
              You own what you post. We don&apos;t claim any rights to your content. 
              We just help you get it to Reddit faster.
            </p>
            <p>
              That said, don&apos;t post content that:
            </p>
            <ul>
              <li>You don&apos;t have the right to share</li>
              <li>Violates someone else&apos;s copyright or trademark</li>
              <li>Is illegal in your jurisdiction</li>
            </ul>

            <h2>Disclaimers</h2>
            <p>
              Let&apos;s be real about what we can and can&apos;t promise:
            </p>
            <ul>
              <li>
                <strong>Service availability</strong> - We do our best to keep things running, 
                but we can&apos;t promise 100% uptime. Reddit&apos;s API goes down sometimes. Things happen.
              </li>
              <li>
                <strong>Post success</strong> - We can send your post to Reddit, but mods might 
                remove it, automoderator might flag it, or it might get caught in spam filters. 
                That&apos;s not on us.
              </li>
              <li>
                <strong>Not affiliated with Reddit</strong> - We&apos;re an independent tool. 
                Reddit Inc. doesn&apos;t endorse or support us.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              The service is provided &quot;as is&quot; without warranties of any kind. 
              We&apos;re not liable for any damages arising from your use of the service. 
              (Yes, this is the legal part. Every terms of service has it.)
            </p>

            <h2>Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate accounts that:
            </p>
            <ul>
              <li>Violate these terms</li>
              <li>Abuse the service (spamming, excessive API calls, etc.)</li>
              <li>Engage in illegal activity</li>
              <li>Try to exploit or attack the service</li>
            </ul>
            <p>
              We&apos;ll try to give you a warning first unless it&apos;s something serious. 
              If your account is terminated, you won&apos;t get a refund on any remaining Pro subscription.
            </p>

            <h2>Changes to These Terms</h2>
            <p>
              We might update these terms from time to time. When we do:
            </p>
            <ul>
              <li>We&apos;ll update the &quot;Last updated&quot; date at the top</li>
              <li>For significant changes, we&apos;ll try to notify you in the app</li>
              <li>Continued use after changes means you accept the new terms</li>
            </ul>

            <h2>Governing Law</h2>
            <p>
              These terms are governed by applicable law. Any disputes will be handled 
              in the appropriate jurisdiction. We prefer to work things out directly 
              before involving lawyers though.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these terms?
            </p>
            <p>
              Email us at: <a href="mailto:support@redditposter.app">support@redditposter.app</a>
            </p>

            <hr className="my-8" />

            <p className="text-sm text-muted-foreground">
              We tried to write these terms in a way that&apos;s actually readable. 
              If something is unclear, just ask - we&apos;re happy to explain.
            </p>
          </article>
        </main>

        <AppFooter />
      </div>
    </>
  );
}
