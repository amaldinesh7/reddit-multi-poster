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
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          placeholder="Write your caption/title..."
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="resize-none text-sm"
          rows={2}
        />
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          <span className={isOverLimit ? 'text-red-500' : ''}>
            {count}/{limit}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="prefix-f"
            checked={prefixes.f}
            onCheckedChange={(checked) => onPrefixesChange({ ...prefixes, f: !!checked })}
          />
          <Label htmlFor="prefix-f" className="text-sm font-normal cursor-pointer">(f)</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="prefix-c"
            checked={prefixes.c}
            onCheckedChange={(checked) => onPrefixesChange({ ...prefixes, c: !!checked })}
          />
          <Label htmlFor="prefix-c" className="text-sm font-normal cursor-pointer">(c)</Label>
        </div>
      </div>
    </div>
  );
} 