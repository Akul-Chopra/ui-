import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  Box,
  Stack,
  Typography,
  Divider,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  Button,
} from '@mui/material';
import { AccountTree, AttachFile, Gavel, ReceiptLong, Event, AccountBalanceWallet, Payments, Send, Publish, EditOutlined, CheckCircle, Cancel, Undo } from '@mui/icons-material';
import { workOrdersApi, invoicesApi } from '@/api/endpoints';
import { StatusChip } from '@/components/StatusChip';
import { WorkflowProgress } from '@/components/WorkflowProgress';
import { DocumentAttachments } from '@/components/DocumentAttachments';
import { DocumentLink } from '@/components/DocumentLink';
import { DetailPageShell } from '@/components/DetailPageShell';
import { SecurityDepositCard } from '@/components/SecurityDepositCard';
import { SubmitForApprovalDialog } from '@/components/SubmitForApprovalDialog';
import { EditWorkOrderDialog } from '@/components/EditWorkOrderDialog';
import { ApprovalActionDialog, type ActionKind } from '@/components/ApprovalActionDialog';
import { useMyTask } from '@/lib/useMyApprovalTask';
import type { ApprovalTask } from '@/api/types';
import { VendorContactCard, Section, Fact, FactGrid, SlaCard, CARD_SX } from '@/pages/ContractDetailPage';
import { currency, date } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { Permissions, RoleCodes } from '@/lib/permissions';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

const SCHEDULE_LABELS: Record<string, string> = {
  OneTime: 'One-time',
  Monthly: 'Monthly',
  Quarterly: 'Quarterly',
  Yearly: 'Yearly',
  Milestone: 'Milestone',
};

const AMOUNT_TYPE_LABELS: Record<string, string> = {
  TenderedValue: 'Tendered Value',
  AverageValue: 'Average Value',
};

/** Full-page view of a work order — particulars, vendor + contact, invoices and approval trail. */
export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const workOrderId = id ?? null;
  const { isVendor, can, isInRole, user } = useAuth();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [action, setAction] = useState<{ task: ApprovalTask; kind: ActionKind } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['work-order', workOrderId],
    queryFn: () => workOrdersApi.get(workOrderId!),
    enabled: !!workOrderId,
  });
  // If this order's current approval step is pending with the viewer, they can act on it
  // right here rather than going to the Approvals inbox.
  const myTask = useMyTask(workOrderId, !isVendor);
  // Invoices raised against this work order.
  const invoices = useQuery({
    queryKey: ['work-order', workOrderId, 'invoices'],
    queryFn: () => invoicesApi.list({ workOrderId: workOrderId!, pageSize: 100 }),
    enabled: !!workOrderId,
  });

  const publish = useMutation({
    mutationFn: () => workOrdersApi.publish(workOrderId!),
    onSuccess: () => {
      dispatch(showToast({ message: `${data?.workOrderNumber} published to the vendor.`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  return (
    <DetailPageShell listLabel="Purchase Orders / Work Orders" listRoute="/work-orders" current={data?.workOrderNumber ?? 'Purchase Order / Work Order'}>
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
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} component="div">
                  {data.workOrderNumber}
                  {data.contractNumber && (
                    <>
                      {' · against '}
                      <DocumentLink type="Contract" entityId={data.contractId} reference={data.contractNumber} bold={false} />
                    </>
                  )}
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
                {data.status === 'Draft' && can(Permissions.workOrderSubmit) && (
                  <Button size="small" variant="outlined" startIcon={<Send fontSize="small" />} onClick={() => setSubmitOpen(true)}>
                    Submit
                  </Button>
                )}
                {data.status === 'Approved' && can(Permissions.workOrderPublish) && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Publish fontSize="small" />}
                    disabled={publish.isPending}
                    onClick={() => publish.mutate()}
                  >
                    Publish
                  </Button>
                )}
                {can(Permissions.workOrderUpdate) &&
                  (!isInRole(RoleCodes.Approver) || data.pendingWithUserId === user?.id) && (
                    <Button size="small" variant="outlined" startIcon={<EditOutlined fontSize="small" />} onClick={() => setEditOpen(true)}>
                      Correct
                    </Button>
                  )}
                <StatusChip status={data.status} />
              </Stack>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <FactGrid>
              <Fact label="Total" value={currency(data.totalAmount)} emphasis />
              {data.amountType && (
                <Fact label="Amount type" value={AMOUNT_TYPE_LABELS[data.amountType] ?? data.amountType} />
              )}
              <Fact label="Invoiced" value={currency(data.invoicedAmount)} emphasis />
              <Fact label="Base" value={currency(data.baseAmount)} />
              <Fact label="Tax" value={currency(data.taxAmount)} />
              <Fact label="Department" value={data.departmentName} />
              <Fact label="Billing" value={SCHEDULE_LABELS[data.paymentScheduleType] ?? data.paymentScheduleType} />
              <Fact label="Start" value={date(data.startDate)} />
              <Fact label="Due" value={date(data.expectedCompletionDate)} />
            </FactGrid>
            {data.rejectionReason && (
              <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1.5 }}>
                Rejection reason: {data.rejectionReason}
              </Typography>
            )}
          </Paper>

          <VendorContactCard vendorId={data.vendorId} fallbackName={data.vendorName} />

          {/* Invoices raised against this work order. */}
          <Section icon={<ReceiptLong fontSize="small" />} title={`Invoices (${invoices.data?.totalCount ?? 0})`}>
            {invoices.isLoading ? (
              <Typography variant="caption" color="text.secondary">
                Loading…
              </Typography>
            ) : (invoices.data?.items.length ?? 0) === 0 ? (
              <Typography variant="caption" color="text.secondary">
                No invoices raised against this purchase order / work order yet.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {invoices.data!.items.map((inv) => (
                  <Box key={inv.id} sx={{ p: 1.5, borderRadius: 1.5, border: (t) => `1px solid ${t.palette.divider}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <DocumentLink type="Invoice" entityId={inv.id} reference={inv.invoiceNumber} bold />
                        <Typography variant="body2" color="text.secondary">
                          {inv.billingPeriodLabel ? `${inv.billingPeriodLabel} · ` : ''}net {currency(inv.netPayableAmount)}
                        </Typography>
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
                        <StatusChip status={inv.status} />
                        <Typography variant="body2" fontWeight={700}>
                          {currency(inv.grossAmount)}
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
              <WorkflowProgress entityType="WorkOrder" entityId={data.id} />
            </Section>
          )}

          <Section icon={<AttachFile fontSize="small" />} title="Attachments">
            <DocumentAttachments ownerType="WorkOrder" ownerId={data.id} />
          </Section>

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

          {data.milestones && data.milestones.length > 0 && (
            <Section icon={<Payments fontSize="small" />} title={`Payment milestones (${data.milestones.length})`}>
              <Stack spacing={1.25}>
                {data.milestones.map((m) => (
                  <Box
                    key={m.id}
                    sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}
                  >
                    <Box
                      sx={{
                        flexShrink: 0,
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                      }}
                    >
                      {m.sequenceNumber}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {m.name}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary', mt: 0.25 }}>
                        <Typography variant="caption" fontWeight={800} color="text.primary">
                          {currency(m.amount)}
                        </Typography>
                        {m.dueDate && (
                          <>
                            <Event sx={{ fontSize: 14 }} />
                            <Typography variant="caption">due {date(m.dueDate)}</Typography>
                          </>
                        )}
                      </Stack>
                    </Box>
                    <StatusChip status={m.status} />
                  </Box>
                ))}
              </Stack>
            </Section>
          )}

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
                    failureCondition={s.failureCondition}
                  />
                ))}
              </Stack>
            </Section>
          )}

          {/* Work orders are a single lump-sum amount (shown as Total above); the line-item
              table is only meaningful for genuinely itemised orders, not the one auto-line. */}
          {data.lineItems && data.lineItems.length > 1 && (
            <Section title={`Line items (${data.lineItems.length})`}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.lineItems.map((li, i) => (
                    <TableRow key={i}>
                      <TableCell>{li.itemDescription}</TableCell>
                      <TableCell align="right">
                        {li.quantity} {li.unitOfMeasure}
                      </TableCell>
                      <TableCell align="right">{currency(li.unitPrice)}</TableCell>
                      <TableCell align="right">{currency(li.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}

          <SubmitForApprovalDialog
            open={submitOpen}
            onClose={() => setSubmitOpen(false)}
            reference={data.workOrderNumber}
            documentLabel="purchase order / work order"
            submitFn={(body) => workOrdersApi.submit(data.id, body)}
            invalidateKey={['work-order', workOrderId]}
          />
        </Stack>
      )}
      {data && <EditWorkOrderDialog open={editOpen} onClose={() => setEditOpen(false)} workOrder={data} />}
      <ApprovalActionDialog action={action} onClose={() => setAction(null)} />
    </DetailPageShell>
  );
}
