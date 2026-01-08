import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  value: string;
  onChange: (value: string) => void;
  prefixes: { f: boolean; c: boolean };
  onPrefixesChange: (prefixes: { f: boolean; c: boolean }) => void;
}

export default function PostComposer({ value, onChange, prefixes, onPrefixesChange }: Props) {
  const count = value.length;
  const limit = 100;

  const handleChange = (newValue: string) => {
    if (newValue.length <= limit) {
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-4">
      {/* Title Input */}
      <div>
        <Textarea
          placeholder="Write your post title..."
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="resize-none min-h-[100px]"
          rows={3}
        />
        <div className="flex justify-end mt-1">
          <span className={`text-xs ${count > limit * 0.9 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {count}/{limit}
          </span>
        </div>
      </div>

      {/* Title Tags */}
      <div className="p-3 rounded-md bg-secondary/50 border border-border">
        <p className="text-sm font-medium mb-3">Title Tags (optional)</p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={prefixes.f}
              onCheckedChange={(checked) => onPrefixesChange({ ...prefixes, f: !!checked })}
            />
            <span className="text-sm">(f) Female</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={prefixes.c}
              onCheckedChange={(checked) => onPrefixesChange({ ...prefixes, c: !!checked })}
            />
            <span className="text-sm">(c) Couple</span>
          </label>
        </div>
      </div>
    </div>
  );
}
