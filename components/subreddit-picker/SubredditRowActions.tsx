import React from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Pencil,
  X,
  Tag,
  Clock,
  Ban,
  Key,
  Image,
  Wifi,
  Lock,
  Link as LinkIcon,
  FileText,
  Type,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItemPrimitive,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { FailedPost } from '@/hooks/useFailedPosts';
import { ClassifiedError } from '@/lib/errorClassification';
import { ValidationIssue } from '@/lib/preflightValidation';
import { PerSubredditOverride } from './CustomizePostDialog';

type ValidationSummary = {
  severity: 'error' | 'warning';
  count: number;
  label: string;
};

interface SubredditRowActionsProps {
  name: string;
  isSelected: boolean;
  isLoading?: boolean;
  failedPost?: FailedPost;
  validationIssues?: ValidationIssue[];
  validationErrors: ValidationIssue[];
  validationWarnings: ValidationIssue[];
  validationSummary: ValidationSummary | null;
  canExpand: boolean;
  isExpanded: boolean;
  customizationEnabled?: boolean;
  contentOverride?: PerSubredditOverride;
  onCustomize?: (name: string) => void;
  onRequestUpgrade?: (context?: { title?: string; message: string }) => void;
  onRetryPost?: (id: string) => void;
  onEditPost?: (post: FailedPost) => void;
  onRemovePost?: (id: string) => void;
  onExpandClick: (e: React.MouseEvent) => void;
  onControlsClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  openValidationDetailsSignal?: number;
}

const getErrorIcon = (iconName: ClassifiedError['icon'], className: string = 'h-4 w-4') => {
  switch (iconName) {
    case 'tag': return <Tag className={className} />;
    case 'clock': return <Clock className={className} />;
    case 'ban': return <Ban className={className} />;
    case 'key': return <Key className={className} />;
    case 'text': return <FileText className={className} />;
    case 'lock': return <Lock className={className} />;
    case 'image': return <Image className={className} />;
    case 'wifi': return <Wifi className={className} />;
    default: return <AlertTriangle className={className} />;
  }
};

const getFieldIcon = (field: ValidationIssue['field'], className: string = 'h-4 w-4') => {
  switch (field) {
    case 'title': return <Type className={className} />;
    case 'body': return <FileText className={className} />;
    case 'flair': return <Tag className={className} />;
    case 'url': return <LinkIcon className={className} />;
    case 'media': return <Image className={className} />;
    default: return <AlertTriangle className={className} />;
  }
};

const SubredditRowActions: React.FC<SubredditRowActionsProps> = ({
  name,
  isSelected,
  isLoading,
  failedPost,
  validationIssues,
  validationErrors,
  validationWarnings,
  validationSummary,
  canExpand,
  customizationEnabled,
  contentOverride,
  onCustomize,
  onRequestUpgrade,
  onRetryPost,
  onEditPost,
  onRemovePost,
  onExpandClick,
  onControlsClick,
  openValidationDetailsSignal,
}) => {
  const [isValidationMenuOpen, setIsValidationMenuOpen] = React.useState(false);
  const hasValidationIssues = (validationIssues?.length ?? 0) > 0;
  const hasValidationErrors = validationErrors.length > 0;

  React.useEffect(() => {
    if (!openValidationDetailsSignal || !hasValidationIssues || failedPost) {
      return;
    }
    setIsValidationMenuOpen(true);
  }, [openValidationDetailsSignal, hasValidationIssues, failedPost]);

  // Always show customize button (even for free users), plus validation/failed/expand controls
  const showCustomizeButton = onCustomize || onRequestUpgrade;
  if (!isSelected || !(showCustomizeButton || hasValidationIssues || failedPost || canExpand)) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={onControlsClick}>
      {hasValidationIssues && validationSummary && !failedPost && (
        <DropdownMenuRoot open={isValidationMenuOpen} onOpenChange={setIsValidationMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 cursor-pointer hover:opacity-80 transition-opacity"
              aria-label={`${validationSummary.count} validation ${validationSummary.severity === 'error' ? 'error' : 'warning'}${validationSummary.count > 1 ? 's' : ''}`}
              title={validationSummary.label}
            >
              <AlertTriangle className={`h-4 w-4 ${hasValidationErrors ? 'text-red-500' : 'text-yellow-500'}`} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="px-3 py-2 bg-muted/50 border-b border-border">
              <span className="font-medium text-sm">
                {hasValidationErrors
                  ? `${validationErrors.length} issue${validationErrors.length > 1 ? 's' : ''} to fix`
                  : `${validationWarnings.length} warning${validationWarnings.length > 1 ? 's' : ''}`
                }
              </span>
            </div>

            <div className="py-1">
              {validationErrors.map((issue, idx) => (
                <div key={`error-${idx}`} className="px-3 py-2 flex items-start gap-2 text-xs">
                  {getFieldIcon(issue.field, 'h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5')}
                  <span className="text-foreground">{issue.message}</span>
                </div>
              ))}
              {validationWarnings.length > 0 && validationErrors.length > 0 && (
                <div className="border-t border-border my-1" />
              )}
              {validationWarnings.map((issue, idx) => (
                <div key={`warning-${idx}`} className="px-3 py-2 flex items-start gap-2 text-xs">
                  {getFieldIcon(issue.field, 'h-3.5 w-3.5 text-yellow-500 flex-shrink-0 mt-0.5')}
                  <span className="text-muted-foreground">{issue.message}</span>
                </div>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenuRoot>
      )}

      {failedPost && (
        <DropdownMenuRoot>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 cursor-pointer hover:opacity-80 transition-opacity"
              aria-label={`Error: ${failedPost.error.userMessage}`}
              title={failedPost.error.userMessage}
            >
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-0">
            <div className="px-3 py-2 bg-muted/50 border-b border-border">
              <div className="flex items-center gap-2 text-red-500">
                {getErrorIcon(failedPost.error.icon, 'h-4 w-4 flex-shrink-0')}
                <span className="font-medium text-sm truncate">{failedPost.error.userMessage}</span>
              </div>
              {(failedPost.error.details || failedPost.error.originalMessage) && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {failedPost.error.details || failedPost.error.originalMessage}
                </p>
              )}
            </div>

            <div className="p-1">
              {failedPost.error.category !== 'unfixable' && onRetryPost && (
                <DropdownMenuItemPrimitive
                  onClick={() => onRetryPost(failedPost.id)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-blue-500 hover:bg-blue-500/10 rounded cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </DropdownMenuItemPrimitive>
              )}
              {['edit_flair', 'edit_title', 'edit_content', 'change_media'].includes(failedPost.error.action) && onEditPost && (
                <DropdownMenuItemPrimitive
                  onClick={() => onEditPost(failedPost)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-amber-500 hover:bg-amber-500/10 rounded cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit &amp; Retry</span>
                </DropdownMenuItemPrimitive>
              )}
              {onRemovePost && (
                <DropdownMenuItemPrimitive
                  onClick={() => onRemovePost(failedPost.id)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/80 rounded cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Dismiss</span>
                </DropdownMenuItemPrimitive>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenuRoot>
      )}

      {!isLoading && canExpand && (
        <button
          onClick={onExpandClick}
          className="bg-secondary/80 hover:bg-secondary text-foreground/70 hover:text-foreground rounded-full w-5 h-5 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
          aria-label="Community rules"
          title="Community rules"
        >
          <span className="font-serif font-bold italic text-[11px]">i</span>
        </button>
      )}

      {showCustomizeButton && (
        <Tooltip 
          content={
            customizationEnabled 
              ? "Customize title & description for this community" 
              : "Customize title & description - Pro feature"
          } 
          side="left"
        >
          <button
            onClick={() => {
              if (customizationEnabled && onCustomize) {
                onCustomize(name);
              } else if (onRequestUpgrade) {
                onRequestUpgrade({
                  title: 'Customize Content',
                  message: 'Customize title & description per community with Pro.',
                });
              }
            }}
            className={`p-1.5 rounded-md cursor-pointer transition-colors ${
              contentOverride && (contentOverride.title || contentOverride.body)
                ? 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            aria-label={customizationEnabled ? "Customize content for this community" : "Customize content - Pro feature"}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  );
};

export default SubredditRowActions;
