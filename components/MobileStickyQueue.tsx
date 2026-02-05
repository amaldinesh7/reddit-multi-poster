import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { QueueItem } from '@/types';

interface Props {
    items: QueueItem[];
    isPosting: boolean;
    isCompleted: boolean;
    hasErrors: boolean;
    onPostClick: () => void;
    onResetClick: () => void;
    onStopClick?: () => void;
    onClearClick?: () => void;
}

export const MobileStickyQueue: React.FC<Props> = ({
    items,
    isPosting,
    isCompleted,
    hasErrors,
    onPostClick,
    onResetClick,
    onStopClick,
    onClearClick
}) => {
    if (items.length === 0 && !isCompleted) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
            <div className="bg-background/80 backdrop-blur-xl border-t border-border/50 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
                <div className="px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">Queue</span>
                            <Badge variant="secondary" className="px-1.5 h-5 text-[10px] font-medium">
                                {items.length}
                            </Badge>
                        </div>
                        {hasErrors ? (
                            <div className="flex items-center gap-1.5 text-orange-500 mt-1 animate-pulse">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                                    Action Required
                                </span>
                            </div>
                        ) : (
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                {isPosting ? 'Posting in progress...' : isCompleted ? 'All done!' : 'Ready to post'}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {!isPosting && !isCompleted && onClearClick && items.length > 0 && (
                            <button
                                onClick={onClearClick}
                                className="text-muted-foreground hover:text-foreground text-xs font-medium px-2 py-1 transition-colors active:scale-95"
                            >
                                Clear
                            </button>
                        )}

                        {isCompleted ? (
                            <Button onClick={onResetClick} size="sm" className="bg-green-600 hover:bg-green-700 h-9 font-medium shadow-sm">
                                <CheckCircle className="w-4 h-4 mr-1.5" />
                                Done
                            </Button>
                        ) : isPosting ? (
                            <Button
                                onClick={onStopClick}
                                variant="destructive"
                                size="sm"
                                className="h-9 font-medium shadow-sm"
                            >
                                <X className="w-4 h-4 mr-1.5" />
                                Stop
                            </Button>
                        ) : (
                            <Button
                                onClick={onPostClick}
                                disabled={hasErrors || items.length === 0}
                                size="sm"
                                className={`h-9 font-medium shadow-lg shadow-primary/20 transition-all active:scale-95 ${hasErrors ? 'opacity-80' : ''}`}
                            >
                                <Send className="w-4 h-4 mr-1.5" />
                                Post All
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
