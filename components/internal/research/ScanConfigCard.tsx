import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ScanConfigCardProps {
  subredditsInput: string;
  setSubredditsInput: (v: string) => void;
  addingSubreddits: boolean;
  handleAddSubreddits: () => Promise<void>;
  error: string;
}

export const ScanConfigCard = ({
  subredditsInput,
  setSubredditsInput,
  addingSubreddits,
  handleAddSubreddits,
  error,
}: ScanConfigCardProps) => (
  <Card className="border-zinc-800">
    <CardHeader className="pb-4">
      <CardTitle className="text-base font-semibold">Add Subreddits to Research</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="subs" className="text-sm font-medium">
          Subreddits
          <span className="ml-1 text-xs font-normal text-muted-foreground">(newline or comma separated)</span>
        </Label>
        <Textarea
          id="subs"
          value={subredditsInput}
          onChange={(event) => setSubredditsInput(event.target.value)}
          placeholder={'reactjs\njavascript\nnextjs'}
          className="min-h-[80px] resize-y font-mono text-sm"
          aria-label="Subreddits to add to research"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          className="cursor-pointer"
          onClick={handleAddSubreddits}
          disabled={!subredditsInput.trim() || addingSubreddits}
        >
          {addingSubreddits ? 'Adding...' : 'Add to Research'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Subreddits are added to the master list. Run &quot;Collect Posts&quot; in the Pipeline tab to fetch data.
        </p>
      </div>
      {error && <p className="text-sm font-medium text-red-400">{error}</p>}
    </CardContent>
  </Card>
);
