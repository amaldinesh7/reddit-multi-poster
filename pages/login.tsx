import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Upload, Zap, Layers, CheckCircle } from 'lucide-react';

interface MeResponse {
  authenticated: boolean;
}

export default function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Check if already authenticated
  React.useEffect(() => {
    // Check for error in URL query params
    const { error } = router.query;
    if (error && typeof error === 'string') {
      setErrorMessage(decodeURIComponent(error));
    }

    const checkAuth = async () => {
      try {
        const { data } = await axios.get<MeResponse>('/api/me');
        if (data.authenticated) {
          router.replace('/');
        } else {
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleLogin = () => {
    setIsRedirecting(true);
    window.location.href = '/api/auth/login';
  };

  const features = [
    {
      icon: Upload,
      title: 'Upload Once',
      description: 'Share to 30+ communities with a single upload',
    },
    {
      icon: Layers,
      title: 'Queue Management',
      description: 'Track posting progress in real-time',
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Login - Reddit Multi Poster</title>
        <meta name="description" content="Log in to Reddit Multi Poster to manage your posts and share content across multiple subreddits simultaneously." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://reddit-multi-poster.vercel.app/login" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://reddit-multi-poster.vercel.app/login" />
        <meta property="og:title" content="Login - Reddit Multi Poster" />
        <meta property="og:description" content="Log in to Reddit Multi Poster to manage your posts and share content across multiple subreddits simultaneously." />
        <meta property="og:image" content="https://reddit-multi-poster.vercel.app/og-image.png" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://reddit-multi-poster.vercel.app/login" />
        <meta property="twitter:title" content="Login - Reddit Multi Poster" />
        <meta property="twitter:description" content="Log in to Reddit Multi Poster to manage your posts and share content across multiple subreddits simultaneously." />
        <meta property="twitter:image" content="https://reddit-multi-poster.vercel.app/og-image.png" />
      </Head>

      <div className="min-h-screen relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-[#0a0a0a]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#12121a] to-[#1a1a2e]" />
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] animate-pulse" />
          <div
            className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] animate-pulse"
            style={{ animationDelay: '1s' }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
          {/* Glass card */}
          <div className="w-full max-w-md">
            <div
              className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-3xl p-8 shadow-2xl"
              style={{
                boxShadow: '0 0 80px rgba(255, 69, 0, 0.05), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Logo */}
              <div className="flex flex-col items-center mb-8">
                <div
                  className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center mb-4 shadow-lg"
                // style={{
                //   boxShadow: '0 0 40px rgba(255, 69, 0, 0.3)',
                // }}
                >
                  <img src="/logo.png" alt="Reddit Multi Poster" className="w-full h-full object-contain" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Reddit Multi Poster</h1>
                <p className="text-gray-400 text-center text-sm">
                  Post to multiple communities in one click
                </p>
              </div>

              {/* Error message */}
              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <p className="font-medium mb-1">Authentication failed</p>
                  <p className="text-red-400/80 text-xs">{errorMessage}</p>
                </div>
              )}

              {/* Login button */}
              <button
                onClick={handleLogin}
                disabled={isRedirecting}
                className="w-full relative group cursor-pointer"
                aria-label="Continue with Reddit"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#FF4500] to-[#FF6B35] rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300" />
                <div className="relative flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#FF4500] to-[#FF6B35] rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:shadow-lg">
                  {isRedirecting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Logging in...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                      </svg>
                      <span>Continue with Reddit</span>
                    </>
                  )}
                </div>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <span className="text-gray-500 text-xs uppercase tracking-wider">Features</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>

              {/* Features */}
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div
                    key={feature.title}
                    className="flex items-start gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.08]"
                    style={{
                      animationDelay: `${index * 100}ms`,
                    }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-5 h-5 text-orange-400" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium text-sm">{feature.title}</h3>
                      <p className="text-gray-500 text-xs mt-0.5">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-gray-600 text-xs">
                By continuing, you agree to Reddit&apos;s{' '}
                <a
                  href="https://www.reddit.com/policies/user-agreement"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-orange-400 transition-colors cursor-pointer"
                >
                  Terms of Service
                </a>
              </p>
            </div>
          </div>

          {/* Trust badges */}
          {/* <div className="mt-12 flex items-center gap-6 text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500/60" aria-hidden="true" />
              <span className="text-xs">Secure OAuth</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500/60" aria-hidden="true" />
              <span className="text-xs">No Password Stored</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500/60" aria-hidden="true" />
              <span className="text-xs">Rate Limited</span>
            </div>
          </div> */}
        </div>
      </div>
    </>
  );
}
