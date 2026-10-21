import { Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';

/** Document types that have a full-page detail view a link can open. */
export type DocumentType = 'Contract' | 'WorkOrder' | 'Invoice' | 'Payment';

// Each document type's detail route. Appending /<id> opens that record's own page.
const ROUTE: Record<DocumentType, string> = {
  Contract: '/contracts',
  WorkOrder: '/work-orders',
  Invoice: '/invoices',
  Payment: '/finance/queue',
};

/**
 * A clickable document reference (contract / work order / invoice number). Clicking navigates
 * to that document's full detail page. Falls back to plain text when there is no id to link to.
 * Stops propagation so it works inside clickable table rows.
 */
export function DocumentLink({
  type,
  entityId,
  reference,
  bold = true,
}: {
  type?: string | null;
  entityId?: string | null;
  reference?: string | null;
  bold?: boolean;
}) {
  const navigate = useNavigate();
  const route = type && (ROUTE as Record<string, string>)[type];
  const label = reference ?? '—';

  if (!route || !entityId || !reference) {
    return <>{label}</>;
  }

  return (
    <Link
      component="button"
      type="button"
      underline="hover"
      onClick={(e) => {
        e.stopPropagation();
        // Payment has no per-record page today — just land on the queue.
        navigate(type === 'Payment' ? route : `${route}/${entityId}`);
      }}
      sx={{ fontWeight: bold ? 700 : 500, textAlign: 'left', cursor: 'pointer', verticalAlign: 'baseline' }}
    >
      {reference}
    </Link>
  );
}
