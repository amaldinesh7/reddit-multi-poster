import React, { useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';

type CardVariant = 'hook' | 'problem' | 'cta';

type CardContent = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

const getVariant = (value: unknown): CardVariant => {
  if (value === 'problem') return 'problem';
  if (value === 'cta') return 'cta';
  return 'hook';
};

const CONTENT: Record<CardVariant, CardContent> = {
  hook: {
    eyebrow: 'Reddit Multi Poster',
    title: 'Post once. Reach 30+ communities.',
    subtitle: 'Share once. Reach everywhere.',
  },
  problem: {
    eyebrow: 'The problem',
    title: 'Copy/paste. Select flair. Repeat.',
    subtitle: 'Post too quickly and you risk getting flagged.',
  },
  cta: {
    eyebrow: 'Ready?',
    title: 'Stop copy-pasting. Start creating.',
    subtitle: 'Try it now.',
  },
};

export default function DemoCardsPage() {
  const router = useRouter();

  const variant = useMemo(() => getVariant(router.query.variant), [router.query.variant]);
  const content = CONTENT[variant];

  const wrapClassName =
    'min-h-screen w-full flex items-center justify-center bg-zinc-950 text-white';

  const cardClassName = cn(
    'w-full max-w-5xl mx-auto px-10 py-16',
    'rounded-2xl border border-white/10',
    'bg-gradient-to-br from-zinc-900/70 via-zinc-900/40 to-zinc-900/70',
    'shadow-[0_20px_80px_-30px_rgba(0,0,0,0.75)]'
  );

  return (
    <>
      <Head>
        <title>Demo Card</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className={wrapClassName} aria-label="Demo card">
        <section className={cardClassName}>
          {content.eyebrow && (
            <div className="text-sm font-medium tracking-wide text-white/70">
              {content.eyebrow}
            </div>
          )}

          <h1 className="mt-4 text-5xl font-semibold leading-tight">
            {content.title}
          </h1>

          {content.subtitle && (
            <p className="mt-5 text-xl leading-relaxed text-white/80 max-w-3xl">
              {content.subtitle}
            </p>
          )}

          {variant === 'cta' && (
            <div className="mt-10 flex items-center gap-3">
              <div className="inline-flex items-center rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 px-4 py-2 text-sm font-medium">
                reddit-multi-poster.vercel.app
              </div>
              <div className="text-sm text-white/60">
                Product Hunt launch video (demo)
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

