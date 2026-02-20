import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { OutreachTemplate } from './types';

interface OutreachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  template: OutreachTemplate;
  onSend: (template: OutreachTemplate) => Promise<boolean>;
}

export const OutreachDialog = ({
  open,
  onOpenChange,
  selectedCount,
  template,
  onSend,
}: OutreachDialogProps) => {
  const [draft, setDraft] = useState<OutreachTemplate>(template);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(template);
    }
  }, [open, template]);

  const handleSend = async (): Promise<void> => {
    if (!draft.subjectTemplate.trim() || !draft.bodyTemplate.trim()) return;
    setIsSending(true);
    const ok = await onSend({
      subjectTemplate: draft.subjectTemplate.trim(),
      bodyTemplate: draft.bodyTemplate.trim(),
    });
    setIsSending(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Send Outreach Messages</DialogTitle>
          <DialogDescription>
            Sending to {selectedCount} selected user{selectedCount === 1 ? '' : 's'}. Use placeholders:
            {' '}<code>{'{{username}}'}</code>, <code>{'{{top_channel}}'}</code>, <code>{'{{lead_score}}'}</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="outreach-subject">Subject</Label>
            <Input
              id="outreach-subject"
              value={draft.subjectTemplate}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, subjectTemplate: event.target.value }))
              }
              maxLength={300}
              aria-label="Outreach subject template"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="outreach-body">Message</Label>
            <Textarea
              id="outreach-body"
              value={draft.bodyTemplate}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, bodyTemplate: event.target.value }))
              }
              className="min-h-[180px]"
              maxLength={5000}
              aria-label="Outreach body template"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleSend}
              disabled={
                isSending
                || !draft.subjectTemplate.trim()
                || !draft.bodyTemplate.trim()
              }
            >
              {isSending ? 'Sending...' : `Send to ${selectedCount}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
