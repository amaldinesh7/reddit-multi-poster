import React from 'react';

export function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold">Reddit Multi-Poster</h2>
          <p className="text-sm text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    </div>
  );
} 