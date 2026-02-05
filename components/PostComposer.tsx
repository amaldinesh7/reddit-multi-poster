import React, { useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  body?: string;
  onBodyChange?: (value: string) => void;
  prefixes: { f: boolean; c: boolean };
  onPrefixesChange: (prefixes: { f: boolean; c: boolean }) => void;
}

export default function PostComposer({ value, onChange, body, onBodyChange, prefixes, onPrefixesChange }: Props) {
  const [showBody, setShowBody] = React.useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const count = value.length;
  const limit = 300;
  const bodyLimit = 40000;

  // Auto-expand title textarea based on content
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(40, el.scrollHeight)}px`;
    }
  }, [value]);

  // Auto-expand body textarea based on content
  useEffect(() => {
    const el = bodyRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(120, el.scrollHeight)}px`;
    }
  }, [body]);

  const handleChange = (newValue: string) => {
    if (newValue.length <= limit) {
      onChange(newValue);
    }
  };

  const handleBodyChange = (newValue: string) => {
    if (onBodyChange && newValue.length <= bodyLimit) {
      onBodyChange(newValue);
    }
  };

  return (
    <div className="space-y-3">
      {/* Title Input */}
      <div>
        <Textarea
          ref={titleRef}
          placeholder="Post title"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="resize-none min-h-[40px] overflow-hidden"
          rows={1}
        />
        <div className="flex justify-end mt-1">
          <span className={`text-xs ${count > limit * 0.9 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {count}/{limit}
          </span>
        </div>
      </div>

      {/* Body/Description Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowBody(!showBody)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showBody ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>Add description{body && body.length > 0 ? ` (${body.length} chars)` : ''}</span>
        </button>
        
        {showBody && onBodyChange && (
          <div className="mt-2">
            <Textarea
              ref={bodyRef}
              placeholder="Description (optional)"
              value={body || ''}
              onChange={(e) => handleBodyChange(e.target.value)}
              className="resize-none min-h-[120px] overflow-hidden"
              rows={4}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                Description (optional)
              </span>
              <span className={`text-xs ${(body?.length || 0) > bodyLimit * 0.9 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {body?.length || 0}/{bodyLimit}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
