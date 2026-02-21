import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 1. Siri Orb — Morphing gradient blob that gently breathes and shifts color.
 *    Inspired by the Siri animation on HomePod / iOS.
 */
const SiriOrbLoader = () => (
  <div className="relative flex items-center justify-center w-24 h-24">
    <div
      className="absolute w-16 h-16 rounded-full opacity-60 blur-xl animate-[orb-breathe_4s_cubic-bezier(0.4,0,0.6,1)_infinite]"
      style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), #a855f7, #3b82f6)' }}
    />
    <div
      className="absolute w-14 h-14 rounded-full opacity-40 blur-lg animate-[orb-breathe_4s_cubic-bezier(0.4,0,0.6,1)_infinite_0.6s]"
      style={{ background: 'linear-gradient(225deg, #3b82f6, hsl(var(--primary)), #ec4899)' }}
    />
    <div
      className="relative w-10 h-10 rounded-full animate-[orb-scale_4s_cubic-bezier(0.4,0,0.6,1)_infinite]"
      style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), #8b5cf6)' }}
    />
  </div>
);

/**
 * 2. Stacked Bars — Three horizontal bars that expand/contract in sequence.
 *    Apple Music / audio visualizer feel. Clean, rhythmic.
 */
const StackedBarsLoader = () => (
  <div className="flex items-center gap-[5px] h-10">
    {[0, 1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="w-[4px] rounded-full bg-primary animate-[bar-dance_1.2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        style={{
          animationDelay: `${i * 120}ms`,
          height: '16px',
        }}
      />
    ))}
  </div>
);

/**
 * 3. Orbital Dots — Small dots rotating in a circle at staggered distances.
 *    watchOS spinner reimagined with trailing opacity.
 */
const OrbitalDotsLoader = () => (
  <div className="relative w-16 h-16 animate-[ring-trace_3s_linear_infinite]">
    {Array.from({ length: 8 }).map((_, i) => {
      const angle = (i * 360) / 8;
      const opacity = 0.15 + (i / 8) * 0.85;
      const scale = 0.6 + (i / 8) * 0.4;
      return (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 w-[9px] h-[9px] -ml-[4.5px] -mt-[4.5px] rounded-full bg-primary"
          style={{
            transform: `rotate(${angle}deg) translateY(-26px)`,
            opacity,
            scale: `${scale}`,
          }}
        />
      );
    })}
  </div>
);

/**
 * 4. Morphing Square — A rounded square that smoothly rotates and shifts
 *    border-radius between circle and squircle. Gradient hue rotates.
 *    Apple Card / Apple Pay vibe.
 */
const MorphingSquareLoader = () => (
  <div className="relative flex items-center justify-center w-24 h-24">
    <div
      className="w-14 h-14 animate-[morph-spin_3s_cubic-bezier(0.4,0,0.6,1)_infinite]"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--primary)), #8b5cf6, #06b6d4)',
        borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
      }}
    />
    <div
      className="absolute w-14 h-14 opacity-30 blur-md animate-[morph-spin_3s_cubic-bezier(0.4,0,0.6,1)_infinite]"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--primary)), #8b5cf6, #06b6d4)',
        borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
      }}
    />
  </div>
);

const LOADERS: Record<string, { component: React.FC; name: string; description: string }> = {
  '1': {
    component: SiriOrbLoader,
    name: 'Siri Orb',
    description: 'A soft gradient orb that breathes and glows. HomePod / Siri energy — alive, ambient, mesmerizing.',
  },
  '2': {
    component: StackedBarsLoader,
    name: 'Stacked Bars',
    description: 'Five bars dance in rhythm. Apple Music visualizer feel — minimal, clean, satisfying.',
  },
  '3': {
    component: OrbitalDotsLoader,
    name: 'Orbital Dots',
    description: 'Dots orbit in a circle with trailing opacity. watchOS spinner reimagined — smooth, premium.',
  },
  '4': {
    component: MorphingSquareLoader,
    name: 'Morph',
    description: 'A gradient shape that smoothly rotates and morphs. Apple Pay / Dynamic Island vibes — fluid, playful.',
  },
};

const LoaderDemoPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const loaderId = typeof id === 'string' ? id : '1';

  const current = LOADERS[loaderId];
  if (!current) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loader not found. Try /loader/1 through /loader/4</p>
      </div>
    );
  }

  const LoaderComponent = current.component;

  return (
    <>
      <Head>
        <title>Loader {loaderId}: {current.name}</title>
      </Head>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border/50 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <span className="text-xs text-muted-foreground font-medium">{loaderId} / 4</span>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-10">
            <div className="h-36 w-36 flex items-center justify-center">
              <LoaderComponent />
            </div>
            <div className="text-center space-y-2 max-w-xs px-4">
              <h1 className="text-lg font-semibold tracking-tight">{current.name}</h1>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{current.description}</p>
            </div>
          </div>
        </div>

        <footer className="border-t border-border/50 px-4 py-5">
          <div className="max-w-md mx-auto flex items-center justify-center gap-2">
            {Object.entries(LOADERS).map(([key, loader]) => (
              <Link key={key} href={`/loader/${key}`}>
                <Button
                  variant={key === loaderId ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'cursor-pointer rounded-full px-4 h-9 text-xs font-medium transition-all',
                    key === loaderId && 'pointer-events-none shadow-sm',
                    key !== loaderId && 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {loader.name}
                </Button>
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </>
  );
};

export default LoaderDemoPage;
