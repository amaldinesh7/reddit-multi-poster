import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Props {
  value: string;
  onChange: (v: string) => void;
  prefixes: { f: boolean; c: boolean };
  onPrefixesChange: (p: { f: boolean; c: boolean }) => void;
}

export default function PostComposer({ value, onChange, prefixes, onPrefixesChange }: Props) {
  const count = value.length;
  const limit = 100;
  const isOverLimit = count > limit;

  const handleChange = (newValue: string) => {
    if (newValue.length <= limit) {
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="relative">
          <Textarea
            placeholder="An interesting title..."
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="resize-none border-0 bg-transparent focus:ring-0 focus:outline-none p-4 text-base min-h-[80px]"
            rows={3}
          />
          <div className="absolute bottom-3 right-4 text-xs font-medium">
            <span className={isOverLimit ? 'text-destructive' : 'text-muted-foreground'}>
              {count}/{limit}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-muted/20 rounded-lg p-4">
        <div className="text-sm font-medium mb-3 text-foreground">🏷️ Title Tags</div>
        <div className="flex items-center gap-4">
          <label className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 rounded-full px-3 py-1.5 transition-colors">
            <Checkbox
              id="prefix-f"
              checked={prefixes.f}
              onCheckedChange={(checked) => onPrefixesChange({ ...prefixes, f: !!checked })}
              className="rounded"
            />
            <span className="text-sm font-medium">(f) Female</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 rounded-full px-3 py-1.5 transition-colors">
            <Checkbox
              id="prefix-c"
              checked={prefixes.c}
              onCheckedChange={(checked) => onPrefixesChange({ ...prefixes, c: !!checked })}
              className="rounded"
            />
            <span className="text-sm font-medium">(c) Couple</span>
          </label>
        </div>
      </div>
    </div>
  );
} 