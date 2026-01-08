import React from 'react';

export function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin" />
        <div className="text-center">
          <p className="font-medium">Loading...</p>
          <p className="text-sm text-muted-foreground">Please wait</p>
        </div>
      </div>
    </div>
  );
}
