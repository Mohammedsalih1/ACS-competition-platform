import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG = {
  draft:        { label: 'Draft',        className: 'bg-gray-100 text-gray-600 border-gray-200' },
  submitted:    { label: 'Submitted',    className: 'bg-blue-100 text-blue-700 border-blue-200' },
  under_review: { label: 'Under Review', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  scored:       { label: 'Scored',       className: 'bg-green-100 text-green-700 border-green-200' },
};

export default function SubmissionStatus({ status }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <Badge variant="outline" className={`text-xs font-medium px-2.5 py-0.5 ${config.className}`}>
      {config.label}
    </Badge>
  );
}