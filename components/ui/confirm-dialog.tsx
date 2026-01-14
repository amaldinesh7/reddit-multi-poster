import React from 'react';
import { Button } from './button';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      
      {/* Dialog */}
      <div 
        className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-xl animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="confirm-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded-md hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <p id="confirm-dialog-message" className="text-muted-foreground">
            {message}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end gap-3 p-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onCancel}
            className="cursor-pointer"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
            className="cursor-pointer"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Hook for easier usage
interface UseConfirmDialogReturn {
  isOpen: boolean;
  title: string;
  message: string;
  variant: 'default' | 'destructive';
  openDialog: (config: { title: string; message: string; variant?: 'default' | 'destructive' }) => Promise<boolean>;
  closeDialog: () => void;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export const useConfirmDialog = (): UseConfirmDialogReturn => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [variant, setVariant] = React.useState<'default' | 'destructive'>('default');
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null);

  const openDialog = React.useCallback((config: { 
    title: string; 
    message: string; 
    variant?: 'default' | 'destructive' 
  }): Promise<boolean> => {
    setTitle(config.title);
    setMessage(config.message);
    setVariant(config.variant || 'default');
    setIsOpen(true);
    
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const closeDialog = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleConfirm = React.useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const handleCancel = React.useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    title,
    message,
    variant,
    openDialog,
    closeDialog,
    handleConfirm,
    handleCancel,
  };
};

export default ConfirmDialog;
