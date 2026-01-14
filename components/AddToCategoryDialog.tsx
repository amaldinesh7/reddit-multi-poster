import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Check } from 'lucide-react';
import { useSubreddits } from '@/hooks/useSubreddits';

interface AddToCategoryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (categoryId: string) => void;
    subredditName: string;
}

const AddToCategoryDialog: React.FC<AddToCategoryDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    subredditName,
}) => {
    const { data, addSubreddit, isLoaded } = useSubreddits();
    const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    // Handle escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when open
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            setSelectedCategory(null); // Reset selection on close
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleSave = async () => {
        if (!selectedCategory) return;

        setIsSaving(true);
        try {
            await onSave(selectedCategory);
            onClose();
        } catch (error) {
            console.error('Failed to save to category', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Dialog */}
            <div
                className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-xl animate-fadeIn flex flex-col max-h-[85vh]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-to-category-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                    <h2 id="add-to-category-title" className="text-lg font-semibold">
                        Save r/{subredditName}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-secondary transition-colors cursor-pointer"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto min-h-0 flex-1">
                    <p className="text-sm text-muted-foreground mb-4">
                        Choose a category to save this subreddit to:
                    </p>

                    <div className="space-y-2">
                        {!isLoaded ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-12 bg-secondary/50 rounded-md animate-pulse" />
                                ))}
                            </div>
                        ) : data.categories.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No categories found. Please create one in settings first.
                            </div>
                        ) : (
                            data.categories.map((category) => (
                                <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-md border transition-all ${selectedCategory === category.id
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                                        }`}
                                >
                                    <span className="font-medium">{category.name}</span>
                                    {selectedCategory === category.id && (
                                        <Check className="w-4 h-4 text-primary" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 p-4 border-t border-border shrink-0">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="cursor-pointer"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!selectedCategory || isSaving}
                        className="cursor-pointer"
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AddToCategoryDialog;
