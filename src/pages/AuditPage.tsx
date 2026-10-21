import { History } from '@mui/icons-material';
import { Stack, Typography, Chip, Box } from '@mui/material';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { auditApi } from '@/api/endpoints';
import type { AuditEntry } from '@/api/types';
import { dateTime } from '@/lib/format';

const ACTION_TONE: Record<string, 'success' | 'error' | 'info' | 'default'> = {
  Approve: 'success',
  Disburse: 'success',
  Login: 'info',
  Submit: 'info',
  Create: 'info',
  Reject: 'error',
  Cancel: 'error',
  LoginFailed: 'error',
};

const columns: Column<AuditEntry>[] = [
  {
    key: 'timestamp',
    header: 'When',
    width: 170,
    render: (a) => (
      <Typography variant="caption" color="text.secondary">
        {dateTime(a.timestamp)}
      </Typography>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    render: (a) => <Chip label={a.actionLabel} size="small" color={ACTION_TONE[a.actionLabel] ?? 'default'} />,
  },
  {
    key: 'entity',
    header: 'Record',
    render: (a) => (
      <Stack>
        <Typography variant="body2" fontWeight={600}>
          {a.entityName} {a.entityReference ?? ''}
        </Typography>
        {a.changes.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {a.changes
              .slice(0, 2)
              .map((c) => `${c.field}: ${c.oldValue ?? '∅'} → ${c.newValue ?? '∅'}`)
              .join(', ')}
            {a.changes.length > 2 ? ` +${a.changes.length - 2} more` : ''}
          </Typography>
        )}
      </Stack>
    ),
  },
  {
    key: 'userName',
    header: 'By',
    render: (a) => (
      <Stack>
        <Typography variant="body2" fontWeight={600}>
          {a.userName ?? 'system'}
        </Typography>
        {(a.actorDesignation || a.actorRoles) && (
          <Typography variant="caption" color="text.secondary">
            {[a.actorDesignation, a.actorRoles].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </Stack>
    ),
  },
  {
    key: 'ipAddress',
    header: 'IP',
    render: (a) => (
      <Typography variant="caption" color="text.secondary">
        {a.ipAddress ?? '—'}
      </Typography>
    ),
  },
];

export function AuditPage() {
  return (
    <>
      <PageHeader
        title="Audit Trail"
        subtitle="Append-only record of every action — who, when, from where, and what changed"
        icon={<History />}
      />
      <Box>
        <DataTable
          queryKey={['audit']}
          fetcher={auditApi.list}
          columns={columns}
          rowKey={(a) => a.id}
          searchPlaceholder="Search by reference, user, remarks…"
        />
      </Box>
    </>
  );
}
