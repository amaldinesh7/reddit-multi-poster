import React, { useState, useEffect } from 'react';

const QUIRKY_MESSAGES = [
  "Waking up the hamsters...",
  "Convincing Reddit to cooperate...",
  "Brewing some pixels...",
  "Almost there, promise...",
  "Negotiating with the servers...",
  "Counting subreddits...",
  "Warming up the karma engine...",
];

export function AppLoader() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % QUIRKY_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin" />
        <div className="text-center">
          <p className="font-medium text-muted-foreground transition-opacity duration-300">
            {QUIRKY_MESSAGES[messageIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
