import type { OutreachStatus } from '@/lib/internal/research/types';

const STATUS_CLASS: Record<OutreachStatus, string> = {
  not_contacted: 'bg-zinc-700 text-zinc-300',
  sent: 'bg-blue-500/20 text-blue-400',
  failed: 'bg-red-500/20 text-red-400',
  replied: 'bg-emerald-500/20 text-emerald-400',
};

const STATUS_LABEL: Record<OutreachStatus, string> = {
  not_contacted: 'Not contacted',
  sent: 'Sent',
  failed: 'Failed',
  replied: 'Replied',
};

interface OutreachStatusBadgeProps {
  status: OutreachStatus | undefined;
}

export const OutreachStatusBadge = ({ status }: OutreachStatusBadgeProps) => {
  const value = status ?? 'not_contacted';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[value]}`}>
      {STATUS_LABEL[value]}
    </span>
  );
};
