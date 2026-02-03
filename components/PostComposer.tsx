import React from 'react';
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
  const count = value.length;
  const limit = 300;
  const bodyLimit = 40000;

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
          placeholder="Write your post title..."
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="resize-none min-h-[44px] sm:min-h-[40px] text-sm sm:text-base"
          rows={1}
        />
        <div className="flex justify-end mt-1">
          <span className={`text-[10px] sm:text-xs tabular-nums ${count > limit * 0.9 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {count}/{limit}
          </span>
        </div>
      </div>

      {/* Body/Description Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowBody(!showBody)}
          className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground active:text-foreground transition-colors cursor-pointer tap-highlight-none py-1"
        >
          {showBody ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>Add body text {body && body.length > 0 && `(${body.length} chars)`}</span>
        </button>
        
        {showBody && onBodyChange && (
          <div className="mt-2">
            <Textarea
              placeholder="Optional body text for self posts..."
              value={body || ''}
              onChange={(e) => handleBodyChange(e.target.value)}
              className="resize-none min-h-[100px] sm:min-h-[120px] text-sm sm:text-base"
              rows={4}
            />
            <div className="flex justify-between mt-1 gap-2">
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                Used for self/text posts only
              </span>
              <span className={`text-[10px] sm:text-xs tabular-nums flex-shrink-0 ${(body?.length || 0) > bodyLimit * 0.9 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {body?.length || 0}/{bodyLimit}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
