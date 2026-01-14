import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PostRequirements as PostRequirementsType } from '../utils/reddit';
import { AlertCircle, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    requirements: Record<string, PostRequirementsType>;
    loading: Record<string, boolean>;
    selectedSubreddits: string[];
}

export const PostRequirements: React.FC<Props> = ({ requirements, loading, selectedSubreddits }) => {
    // Filter only selected subreddits that have some requirements to show
    const activeSubs = selectedSubreddits.filter(sub => {
        const reqs = requirements[sub];
        if (!reqs) return false;
        // Check if there are any meaningful requirements to display
        return (
            reqs.title_text_min_length !== undefined ||
            reqs.title_text_max_length !== undefined ||
            reqs.body_text_min_length !== undefined ||
            reqs.body_text_max_length !== undefined ||
            (reqs.domain_blacklist && reqs.domain_blacklist.length > 0) ||
            (reqs.domain_whitelist && reqs.domain_whitelist.length > 0) ||
            (reqs.title_regexes && reqs.title_regexes.length > 0) ||
            (reqs.body_regexes && reqs.body_regexes.length > 0) ||
            reqs.body_restriction_policy === 'required'
        );
    });

    if (activeSubs.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Info className="w-4 h-4 text-primary" />
                        Posting Requirements
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="w-full divide-y divide-border">
                    {activeSubs.map(sub => {
                        const reqs = requirements[sub];
                        const isLoading = loading[sub];

                        return (
                            <details key={sub} className="group">
                                <summary className="flex cursor-pointer items-center justify-between py-3 px-2 text-sm font-medium hover:bg-muted/50 rounded-t transition-colors marker:text-transparent [&::-webkit-details-marker]:hidden list-none">
                                    <span className="flex items-center gap-2">
                                        r/{sub}
                                        {isLoading && <span className="text-xs text-muted-foreground font-normal">(loading...)</span>}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="px-2 pt-2 pb-4 space-y-3 animation-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-foreground/80">
                                        {/* Title Length */}
                                        {(reqs.title_text_min_length !== undefined || reqs.title_text_max_length !== undefined) && (
                                            <div className="flex flex-col gap-1 bg-secondary/30 p-2 rounded">
                                                <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Title Length</span>
                                                <span>
                                                    {reqs.title_text_min_length || 0} - {reqs.title_text_max_length || 'Max'} chars
                                                </span>
                                            </div>
                                        )}

                                        {/* Body Length */}
                                        {(reqs.body_text_min_length !== undefined || reqs.body_text_max_length !== undefined) && (
                                            <div className="flex flex-col gap-1 bg-secondary/30 p-2 rounded">
                                                <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Body Length</span>
                                                <span>
                                                    {reqs.body_text_min_length || 0} - {reqs.body_text_max_length ? `${reqs.body_text_max_length} chars` : 'Unlimited'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Regex / Patterns */}
                                    {reqs.title_regexes && reqs.title_regexes.length > 0 && (
                                        <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-200 dark:border-red-900/30">
                                            <span className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400 text-xs mb-1">
                                                <AlertCircle className="w-3 h-3" />
                                                Strict Title Format Required
                                            </span>
                                            <ul className="list-disc list-inside text-xs space-y-1 opacity-90 break-all">
                                                {reqs.title_regexes.map((regex, idx) => (
                                                    <li key={idx} className="font-mono">{regex}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Domain Restrictions */}
                                    {reqs.domain_whitelist && reqs.domain_whitelist.length > 0 && (
                                        <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded border border-blue-200 dark:border-blue-900/30">
                                            <span className="font-medium text-blue-600 dark:text-blue-400 text-xs mb-1 block">
                                                Allowed Domains Only
                                            </span>
                                            <div className="flex flex-wrap gap-1">
                                                {reqs.domain_whitelist.map(d => (
                                                    <span key={d} className="bg-background px-1.5 py-0.5 rounded text-xs border border-border">{d}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Blacklist */}
                                    {reqs.domain_blacklist && reqs.domain_blacklist.length > 0 && (
                                        <div className="bg-orange-50 dark:bg-orange-900/10 p-2 rounded border border-orange-200 dark:border-orange-900/30">
                                            <span className="font-medium text-orange-600 dark:text-orange-400 text-xs mb-1 block">
                                                Blocked Domains
                                            </span>
                                            <div className="flex flex-wrap gap-1">
                                                {reqs.domain_blacklist.map(d => (
                                                    <span key={d} className="bg-background px-1.5 py-0.5 rounded text-xs border border-border strike-through decoration-red-500">{d}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {reqs.body_restriction_policy === 'required' && (
                                        <div className="text-xs p-2 bg-secondary/30 rounded">
                                            <span className="font-semibold">Note:</span> Body text is required.
                                        </div>
                                    )}
                                </div>
                            </details>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};
