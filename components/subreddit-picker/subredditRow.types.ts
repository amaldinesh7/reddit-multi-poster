import { PostRequirements, SubredditEligibility, RedditUser } from '@/utils/reddit';
import { FailedPost } from '@/hooks/useFailedPosts';
import { ValidationIssue } from '@/lib/preflightValidation';
import { PerSubredditOverride } from './CustomizePostDialog';
import { TitleTag } from '../../utils/subredditCache';

export interface SubredditRules {
  requiresGenderTag: boolean;
  requiresContentTag: boolean;
  genderTags: string[];
  contentTags: string[];
  titleTags?: TitleTag[];
  submitText?: string;
}

export interface SubredditRowProps {
  name: string;
  hasError: boolean;
  isSelected: boolean;
  isLoading?: boolean;
  flairRequired?: boolean;
  flairOptions: { id: string; text: string }[];
  subredditRules?: SubredditRules;
  postRequirements?: PostRequirements;
  titleSuffix?: string;
  flairValue?: string;
  onToggle: (name: string) => void;
  onFlairChange: (name: string, id: string) => void;
  onTitleSuffixChange: (name: string, suffix: string) => void;
  failedPost?: FailedPost;
  onRetryPost?: (id: string) => void;
  onEditPost?: (post: FailedPost) => void;
  onRemovePost?: (id: string) => void;
  validationIssues?: ValidationIssue[];
  contentOverride?: PerSubredditOverride;
  onCustomize?: (name: string) => void;
  customizationEnabled?: boolean;
  onRequestUpgrade?: (context?: { title?: string; message: string }) => void;
  eligibility?: SubredditEligibility;
  userData?: RedditUser;
  postKind?: 'self' | 'link' | 'image' | 'video' | 'gallery';
  rowRef?: (node: HTMLDivElement | null) => void;
  isHighlighted?: boolean;
  showInlineValidationHint?: boolean;
  onInlineHintClick?: (name: string) => void;
}
