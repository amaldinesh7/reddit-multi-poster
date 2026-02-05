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
        <div className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden">
            <div className="bg-background/90 backdrop-blur-2xl border-t border-border/50 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
                <div className="px-5 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                            <span className="font-bold text-sm tracking-tight">Queue</span>
                            <Badge variant="secondary" className="px-2 h-5.5 text-[11px] font-bold bg-primary/10 text-primary border-none shadow-none">
                                {items.length}
                            </Badge>
                        </div>
                        {hasErrors ? (
                            <div className="flex items-center gap-1.5 text-red-500 mt-1.5 transition-all">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="text-[11px] font-semibold">
                                    Needs attention
                                </span>
                            </div>
                        ) : (
                            <div className="text-[11px] font-medium text-muted-foreground mt-1 truncate">
                                {isPosting ? 'Posting in progress...' : isCompleted ? 'All done!' : 'Ready to post'}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        {!isPosting && !isCompleted && onClearClick && items.length > 0 && (
                            <button
                                onClick={onClearClick}
                                className="text-muted-foreground hover:text-red-500 text-xs font-bold uppercase tracking-wider px-2 py-2 transition-colors active:scale-90"
                            >
                                Clear
                            </button>
                        )}

                        {isCompleted ? (
                            <Button
                                onClick={onResetClick}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 h-11 px-5 font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-all text-sm"
                            >
                                <CheckCircle className="w-4.5 h-4.5 mr-2" />
                                Done
                            </Button>
                        ) : isPosting ? (
                            <Button
                                onClick={onStopClick}
                                variant="destructive"
                                size="sm"
                                className="h-11 px-5 font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all text-sm"
                            >
                                <X className="w-4.5 h-4.5 mr-2" />
                                Stop
                            </Button>
                        ) : (
                            <Button
                                onClick={onPostClick}
                                disabled={hasErrors || items.length === 0}
                                size="sm"
                                className={`h-11 px-5 font-bold shadow-xl shadow-primary/30 active:scale-95 transition-all text-sm ${hasErrors ? 'opacity-50' : 'bg-primary'}`}
                            >
                                <Send className="w-4.5 h-4.5 mr-2" />
                                Post All
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
