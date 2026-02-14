import React from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, AlertTriangle, CheckCircle, X, RotateCcw } from 'lucide-react';
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

    const statusText = hasErrors
        ? 'Needs attention'
        : isPosting
            ? 'Posting...'
            : isCompleted
                ? 'All done!'
                : 'Ready';

    const statusClassName = statusText === 'Ready'
        ? 'text-emerald-500'
        : 'text-muted-foreground';

    return (
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 z-[100] lg:hidden">
            <div className="bg-background/90 backdrop-blur-2xl border-t border-border/50 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
                <div className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                                Queue ({items.length})
                            </span>
                            {hasErrors && (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                            )}
                        </div>
                        <div className={`text-[11px] mt-0.5 ${statusClassName}`}>
                            {statusText}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {!isPosting && !isCompleted && onClearClick && items.length > 0 && (
                            <Button
                                onClick={onClearClick}
                                variant="ghost"
                                size="sm"
                                className="h-9 px-3 text-xs font-medium"
                            >
                                Reset
                            </Button>
                        )}

                        {isCompleted ? (
                            <Button
                                onClick={onResetClick}
                                size="sm"
                                className="h-10 px-4 font-medium shadow-lg shadow-primary/20 active:scale-95 transition-all text-sm cursor-pointer"
                            >
                                <RotateCcw className="w-4 h-4 mr-1.5" />
                                Reset
                            </Button>
                        ) : isPosting ? (
                            <Button
                                onClick={onStopClick}
                                variant="destructive"
                                size="sm"
                                className="h-10 px-4 font-medium shadow-lg shadow-red-500/20 active:scale-95 transition-all text-sm"
                            >
                                <X className="w-4 h-4 mr-1.5" />
                                Stop
                            </Button>
                        ) : (
                            <Button
                                onClick={onPostClick}
                                disabled={hasErrors || items.length === 0}
                                size="sm"
                                className={`h-9 px-3 font-medium active:scale-95 transition-all text-sm ${hasErrors ? 'opacity-50' : 'bg-primary'}`}
                            >
                                Review &amp; post
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
