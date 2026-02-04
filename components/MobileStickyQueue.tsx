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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border lg:hidden z-50">
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Queue</span>
                        <Badge variant="secondary" className="text-xs">
                            {items.length} item{items.length !== 1 ? 's' : ''}
                        </Badge>
                    </div>
                    {hasErrors && (
                        <p className="text-xs text-red-500 mt-1">Has validation errors</p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {!isPosting && !isCompleted && onClearClick && items.length > 0 && (
                        <Button
                            onClick={onClearClick}
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Clear selection"
                        >
                            Clear All
                        </Button>
                    )}

                    {isCompleted ? (
                        <Button onClick={onResetClick} size="sm" className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Done
                        </Button>
                    ) : isPosting ? (
                        <Button
                            onClick={onStopClick}
                            variant="destructive"
                            size="sm"
                        >
                            <X className="w-4 h-4 mr-2" />
                            Stop
                        </Button>
                    ) : (
                        <Button
                            onClick={onPostClick}
                            disabled={hasErrors || items.length === 0}
                            size="sm"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Post All
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
