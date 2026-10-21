import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Box, Stack, Typography, Divider, CircularProgress, Chip, Paper, Avatar, Button } from '@mui/material';
import type { Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Store, AccountTree, Gavel, AttachFile, Assignment, AccountBalanceWallet, Verified, EditOutlined, CheckCircle, Cancel, Undo } from '@mui/icons-material';
import { contractsApi, vendorsApi, workOrdersApi } from '@/api/endpoints';
import { StatusChip } from '@/components/StatusChip';
import { WorkflowProgress } from '@/components/WorkflowProgress';
import { DocumentAttachments } from '@/components/DocumentAttachments';
import { DocumentLink } from '@/components/DocumentLink';
import { DetailPageShell } from '@/components/DetailPageShell';
import { SecurityDepositCard } from '@/components/SecurityDepositCard';
import { BankAccountPanel } from '@/components/BankAccountPanel';
import { EditContractDialog } from '@/components/EditContractDialog';
import { ApprovalActionDialog, type ActionKind } from '@/components/ApprovalActionDialog';
import { useMyTask } from '@/lib/useMyApprovalTask';
import type { ApprovalTask } from '@/api/types';
import { currency, date } from '@/lib/format';
import { initials } from '@/lib/initials';
import { useAuth } from '@/lib/useAuth';
import { Permissions, RoleCodes } from '@/lib/permissions';

/** Full-page view of a contract — particulars, vendor + contact, work orders and approval trail. */
export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const contractId = id ?? null;
  const { isVendor, can, isInRole, user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [action, setAction] = useState<{ task: ApprovalTask; kind: ActionKind } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => contractsApi.get(contractId!),
    enabled: !!contractId,
  });
  // Work orders drawn against this contract.
  const workOrders = useQuery({
    queryKey: ['contract', contractId, 'work-orders'],
    queryFn: () => workOrdersApi.list({ contractId: contractId!, pageSize: 100 }),
    enabled: !!contractId,
  });
  // If this contract's current approval step is pending with the viewer, they can act on it
  // right here rather than going to the Approvals inbox.
  const myTask = useMyTask(contractId, !isVendor);

  return (
    <DetailPageShell listLabel="Contracts" listRoute="/contracts" current={data?.contractNumber ?? 'Contract'}>
      {isLoading || !data ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3 }, ...CARD_SX }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={1.5}>
              <Box>
                <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                  {data.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {data.contractNumber}
                  {data.versionNumber > 1 ? ` · v${data.versionNumber}` : ''}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {myTask && (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" color="success" startIcon={<CheckCircle fontSize="small" />} onClick={() => setAction({ task: myTask, kind: 'Approve' })}>
                      Approve
                    </Button>
                    {myTask.canReject && (
                      <Button size="small" variant="outlined" color="error" startIcon={<Cancel fontSize="small" />} onClick={() => setAction({ task: myTask, kind: 'Reject' })}>
                        Reject
                      </Button>
                    )}
                    {myTask.canReturn && (
                      <Button size="small" variant="outlined" color="warning" startIcon={<Undo fontSize="small" />} onClick={() => setAction({ task: myTask, kind: 'Return' })}>
                        Return
                      </Button>
                    )}
                  </Stack>
                )}
                {can(Permissions.contractUpdate) &&
                  (!isInRole(RoleCodes.Approver) || data.pendingWithUserId === user?.id) && (
                    <Button size="small" variant="outlined" startIcon={<EditOutlined fontSize="small" />} onClick={() => setEditOpen(true)}>
                      Correct
                    </Button>
                  )}
                {/* The contract record's own lifecycle status — distinct from the approval
                    workflow's status shown lower down under "Approval progress". */}
                <StatusChip status={data.status} />
              </Stack>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <FactGrid>
              <Fact label="Value" value={currency(data.contractValue)} emphasis />
              <Fact label="Committed" value={currency(data.committedValue)} emphasis />
              <Fact label="Department" value={data.departmentName ?? '—'} />
              <Fact label="Category" value={data.categoryName ?? '—'} />
              <Fact label="Vertical" value={data.verticalName ?? '—'} />
              <Fact label="Selection mode" value={data.selectionModeName ?? '—'} />
              <Fact label="Contract for" value={data.contractForName ?? '—'} />
              <Fact label="Start" value={date(data.startDate)} />
              <Fact label="End" value={date(data.endDate)} />
              <Fact
                label="Renewal"
                value={
                  data.isRenewable
                    ? data.renewalPeriodMonths
                      ? `${data.renewalPeriodMonths} month${data.renewalPeriodMonths > 1 ? 's' : ''}`
                      : 'Renewable'
                    : 'Not renewable'
                }
              />
              <Fact label="Signed" value={data.signedDate ? date(data.signedDate) : '—'} />
            </FactGrid>
            {data.rejectionReason && (
              <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1.5 }}>
                Rejection reason: {data.rejectionReason}
              </Typography>
            )}
          </Paper>

          <VendorContactCard vendorId={data.vendorId} fallbackName={data.vendorName} />

          {/* Work orders raised against this contract. */}
          <Section icon={<Assignment fontSize="small" />} title={`Purchase Orders / Work Orders (${workOrders.data?.totalCount ?? 0})`}>
            {workOrders.isLoading ? (
              <Typography variant="caption" color="text.secondary">
                Loading…
              </Typography>
            ) : (workOrders.data?.items.length ?? 0) === 0 ? (
              <Typography variant="caption" color="text.secondary">
                No purchase orders / work orders drawn against this contract yet.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {workOrders.data!.items.map((w) => (
                  <Box key={w.id} sx={{ p: 1.5, borderRadius: 1.5, border: (t) => `1px solid ${t.palette.divider}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <DocumentLink type="WorkOrder" entityId={w.id} reference={w.workOrderNumber} bold />
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {w.title}
                        </Typography>
                        {w.invoiceCount > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            {w.invoiceCount} invoice{w.invoiceCount > 1 ? 's' : ''}
                          </Typography>
                        )}
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
                        <StatusChip status={w.status} />
                        <Typography variant="body2" fontWeight={700}>
                          {currency(w.totalAmount)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Section>

          {!isVendor && (
            <Section icon={<AccountTree fontSize="small" />} title="Approval progress">
              <WorkflowProgress entityType="Contract" entityId={data.id} />
            </Section>
          )}

          <Section icon={<AttachFile fontSize="small" />} title="Attachments">
            <DocumentAttachments ownerType="Contract" ownerId={data.id} />
          </Section>

          {data.slas && data.slas.length > 0 && (
            <Section icon={<Gavel fontSize="small" />} title="Service levels (SLA)">
              <Stack spacing={1.25}>
                {data.slas.map((s) => (
                  <SlaCard
                    key={s.sequenceNumber}
                    metric={s.metric}
                    measurementPeriod={s.measurementPeriod}
                    targetValue={s.targetValue}
                    deductionType={s.deductionType}
                    deductionValue={s.deductionValue}
                    penaltyPeriod={s.penaltyPeriod}
                    penaltyCapPercentage={s.penaltyCapPercentage}
                    failureCondition={s.failureCondition}
                  />
                ))}
              </Stack>
            </Section>
          )}

          {(data.securityDepositAmount || data.sdInstrumentNumber) && (
            <Section icon={<AccountBalanceWallet fontSize="small" />} title="Security deposit">
              <SecurityDepositCard
                amount={data.securityDepositAmount}
                instrumentType={data.sdInstrumentType}
                instrumentNumber={data.sdInstrumentNumber}
                instrumentDate={data.sdInstrumentDate}
                validityDate={data.sdInstrumentValidityDate}
              />
            </Section>
          )}

          {data.scopeOfWork && (
            <Section title="Scope of work">
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {data.scopeOfWork}
              </Typography>
            </Section>
          )}

          {(data.complianceTerms ||
            data.indemnificationTerms ||
            data.disputeResolution ||
            data.paymentTerms ||
            data.termsAndConditions) && (
            <Section icon={<Gavel fontSize="small" />} title="Terms & legal clauses">
              <Stack spacing={1.5}>
                <Clause label="Payment terms" value={data.paymentTerms} />
                <Clause label="General conditions" value={data.termsAndConditions} />
                <Clause label="Compliance" value={data.complianceTerms} />
                <Clause label="Indemnification" value={data.indemnificationTerms} />
                <Clause label="Dispute resolution" value={data.disputeResolution} />
              </Stack>
            </Section>
          )}
        </Stack>
      )}
      {data && <EditContractDialog open={editOpen} onClose={() => setEditOpen(false)} contract={data} />}
      <ApprovalActionDialog action={action} onClose={() => setAction(null)} />
    </DetailPageShell>
  );
}

/** Vendor identity and the contact/bank details that matter for a document review. */
export function VendorContactCard({ vendorId, fallbackName }: { vendorId: string; fallbackName?: string }) {
  const { data } = useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: () => vendorsApi.get(vendorId),
    enabled: !!vendorId,
  });

  return (
    <Section icon={<Store fontSize="small" />} title="Vendor & contact">
      {!data ? (
        <Typography variant="body2" color="text.secondary">
          {fallbackName ?? 'Loading…'}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {/* Identity header — monogram, legal name, code, and verification standing. */}
          <Stack direction="row" spacing={1.75} alignItems="center">
            <Avatar
              variant="rounded"
              sx={{
                width: 46,
                height: 46,
                fontSize: 15,
                fontWeight: 800,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                color: 'primary.main',
              }}
            >
              {initials(data.legalName)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.25 }} noWrap>
                {data.legalName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {data.vendorCode}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent="flex-end">
              {data.isGstVerified && (
                <Chip icon={<Verified sx={{ fontSize: 15 }} />} label="GST verified" size="small" color="success" variant="outlined" />
              )}
              {data.isBankVerified && (
                <Chip icon={<Verified sx={{ fontSize: 15 }} />} label="Bank verified" size="small" color="success" variant="outlined" />
              )}
            </Stack>
          </Stack>

          <Divider />

          {/* Statutory identifiers and contact, as one consistent labelled grid. */}
          <FactGrid>
            <Fact label="GSTIN" value={data.gstin} />
            <Fact label="PAN" value={data.pan} />
            <Fact label="Contact person" value={data.contactPersonName} />
            <Fact label="Mobile" value={data.mobile} />
            <Fact label="Email" value={data.email} />
          </FactGrid>

          {/* Primary bank account, as a tinted panel. */}
          {(() => {
            const bank = data.bankAccounts?.find((b) => b.isPrimary) ?? data.bankAccounts?.[0];
            return bank ? (
              <BankAccountPanel
                bankName={bank.bankName}
                accountNumber={bank.accountNumber}
                ifscCode={bank.ifscCode}
                isPrimary={bank.isPrimary}
              />
            ) : null;
          })()}
        </Stack>
      )}
    </Section>
  );
}

/** Soft card shadow shared across the detail sections. */
export const CARD_SX = {
  borderRadius: 2,
  border: (t: Theme) => `1px solid ${t.palette.divider}`,
  boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.05)',
} as const;

/** A titled content card — the building block of the detail pages. */
export function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.75 }, ...CARD_SX }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        {icon && <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>}
        <Typography variant="overline" fontWeight={800} sx={{ letterSpacing: 0.8, lineHeight: 1, color: 'text.primary' }}>
          {title}
        </Typography>
      </Stack>
      {children}
    </Paper>
  );
}

/** Responsive grid of label/value facts. */
export function FactGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 2.5,
      }}
    >
      {children}
    </Box>
  );
}

export function Fact({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mb: 0.4, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem', fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography
        variant={emphasis ? 'h6' : 'body2'}
        fontWeight={emphasis ? 800 : 600}
        color={emphasis ? 'primary.main' : 'text.primary'}
        sx={{ lineHeight: 1.25 }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/** One SLA / penalty commitment card with a left accent and the penalty as a chip. */
export function SlaCard({
  metric,
  measurementPeriod,
  targetValue,
  deductionType,
  deductionValue,
  penaltyPeriod,
  penaltyCapPercentage,
  failureCondition,
}: {
  metric: string;
  measurementPeriod?: string;
  targetValue?: string | null;
  deductionType?: string;
  deductionValue?: number;
  penaltyPeriod?: string | null;
  penaltyCapPercentage?: number | null;
  failureCondition?: string | null;
}) {
  const per = penaltyPeriod
    ? ({ Days: 'day', Weekly: 'week', Monthly: 'month', Yearly: 'year' } as Record<string, string>)[penaltyPeriod] ??
      penaltyPeriod.toLowerCase()
    : '';
  const penaltyRate =
    (deductionType === 'Percentage' ? `${deductionValue}%` : currency(deductionValue ?? 0)) + (per ? ` / ${per}` : '');
  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 1.5,
        bgcolor: 'action.hover',
        borderLeft: (t) => `3px solid ${t.palette.warning.main}`,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700}>
            {metric}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
            {measurementPeriod}
            {targetValue ? ` · target ${targetValue}` : ''}
            {penaltyCapPercentage != null ? ` · capped at ${penaltyCapPercentage}%` : ''}
          </Typography>
        </Box>
        {/* Make it explicit this rate is a penalty deducted from payment on breach. */}
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography
            variant="caption"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, fontSize: '0.6rem', color: 'warning.main' }}
          >
            Penalty deduction
          </Typography>
          <Typography variant="body2" fontWeight={800} color="warning.main" sx={{ whiteSpace: 'nowrap' }}>
            {penaltyRate}
          </Typography>
        </Box>
      </Stack>
      {failureCondition && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75, fontStyle: 'italic' }}>
          Deducted when: {failureCondition}
        </Typography>
      )}
    </Box>
  );
}

/** One labelled legal clause; renders nothing when the clause is empty. */
function Clause({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        borderLeft: (t) => `3px solid ${t.palette.primary.main}`,
        bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.1 : 0.04),
      }}
    >
      <Typography
        variant="caption"
        fontWeight={800}
        color="primary.main"
        display="block"
        sx={{ letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.5, fontSize: '0.68rem' }}
      >
        {label}
      </Typography>
      <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
        {value}
      </Typography>
    </Box>
  );
}
