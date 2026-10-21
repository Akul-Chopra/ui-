import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  MenuItem,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Typography,
  FormControlLabel,
  Switch,
  Divider,
  Box,
  InputAdornment,
} from '@mui/material';
import { CheckCircle, Undo, Cancel, Gavel, Add, DeleteOutline, MoneyOff, VerifiedUser, AttachFile } from '@mui/icons-material';
import { invoicesApi, approvalsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { InvoiceDetail, InvoiceReviewContext } from '@/api/types';
import { DeductionTypes } from '@/lib/enums';
import { DocumentAttachments } from '@/components/DocumentAttachments';
import { currency } from '@/lib/format';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

type Decision = 'Approve' | 'Return' | 'Reject';
type SlaLine = InvoiceReviewContext['slas'][number];
type Verdict = { status: 'Compliant' | 'NonCompliant'; reason: string };

interface DeductionLine {
  deductionType: string;
  description: string;
  amount: string;
}

const slaKey = (l: SlaLine) => `${l.source}:${l.sequenceNumber}`;

/**
 * The Approver's single review of an invoice — certifies the % of work done, records an
 * inspection, and settles the deduction (accepting, adjusting or waiving the rule-computed
 * set) in one action, now that the approval chain is a single level.
 *
 * When the current workflow step is configured to capture SLA compliance, the reviewer also
 * records a Compliant / Non-Compliant verdict for every governing SLA line (from the contract
 * if the work order is linked, else the work order's own SLAs) as part of their approval.
 */
export function InvoiceReviewDialog({
  invoice,
  open,
  capturesSlaCompliance = false,
  slaLines = [],
  onClose,
}: {
  invoice: InvoiceDetail | null;
  open: boolean;
  capturesSlaCompliance?: boolean;
  slaLines?: SlaLine[];
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<Decision>('Approve');
  const [remarks, setRemarks] = useState('');
  const [returnToUserId, setReturnToUserId] = useState('');
  const orgUsers = useQuery({
    queryKey: ['org-users'],
    queryFn: () => approvalsApi.orgUsers(),
    enabled: decision === 'Return',
  });
  // Certification fields
  const [certifiedPct, setCertifiedPct] = useState('100');
  const [satisfactory, setSatisfactory] = useState(true);
  const [observations, setObservations] = useState('');
  // Deduction editor
  const [lines, setLines] = useState<DeductionLine[]>([]);
  // Per-SLA compliance verdicts, keyed by "source:sequence".
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  // Seed the deduction editor from the invoice's current deductions each time it opens.
  useEffect(() => {
    if (invoice && open) {
      setLines(
        (invoice.deductions ?? []).map((d) => ({
          deductionType: d.deductionType,
          description: d.description,
          amount: String(d.amount),
        }))
      );
    }
  }, [invoice, open]);

  // Default every SLA line to Compliant when the compliance form applies.
  useEffect(() => {
    if (capturesSlaCompliance && slaLines.length > 0) {
      setVerdicts((prev) => {
        const next = { ...prev };
        for (const l of slaLines) next[slaKey(l)] ??= { status: 'Compliant', reason: '' };
        return next;
      });
    }
  }, [capturesSlaCompliance, slaLines]);

  const settledTotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0), [lines]);

  const reset = () => {
    setDecision('Approve');
    setRemarks('');
    setReturnToUserId('');
    setCertifiedPct('100');
    setSatisfactory(true);
    setObservations('');
    setLines([]);
    setVerdicts({});
    onClose();
  };

  const showSlaForm = capturesSlaCompliance && slaLines.length > 0 && decision === 'Approve';
  const verdictFor = (l: SlaLine): Verdict => verdicts[slaKey(l)] ?? { status: 'Compliant', reason: '' };
  const setVerdict = (l: SlaLine, patch: Partial<Verdict>) =>
    setVerdicts((v) => ({ ...v, [slaKey(l)]: { ...verdictFor(l), ...patch } }));

  const slaCompliancesPayload = () =>
    slaLines.map((l) => {
      const v = verdictFor(l);
      return {
        source: l.source,
        sequenceNumber: l.sequenceNumber,
        metric: l.metric,
        status: v.status,
        nonComplianceReason: v.status === 'NonCompliant' ? v.reason : undefined,
      };
    });

  const mutation = useMutation({
    mutationFn: () => {
      const slaCompliances = showSlaForm ? slaCompliancesPayload() : undefined;
      return invoicesApi.review(invoice!.id, {
        action: decision,
        certifiedWorkPercentage: decision === 'Approve' ? Number(certifiedPct) : undefined,
        isWorkSatisfactory: satisfactory,
        observations: observations || undefined,
        // The reviewer's lines win; an empty list means the deduction is fully waived (pay full).
        approvedDeductions:
          decision === 'Approve'
            ? lines
                .filter((l) => Number(l.amount) > 0)
                .map((l) => ({
                  deductionType: l.deductionType,
                  description: l.description || 'Deduction',
                  amount: Number(l.amount),
                }))
            : undefined,
        remarks,
        slaCompliances,
        returnToUserId: decision === 'Return' && returnToUserId ? returnToUserId : undefined,
      });
    },
    onSuccess: (result: { pendingWith?: string } | undefined) => {
      // When the claim advances to a further approval level, name who it now sits with.
      const pending = result?.pendingWith ? ` — ${result.pendingWith}` : '';
      dispatch(
        showToast({
          message:
            decision === 'Approve'
              ? `Reviewed and approved${pending}.`
              : decision === 'Return'
                ? 'Returned to the vendor for correction.'
                : 'Invoice rejected.',
          severity: 'success',
        })
      );
      const id = invoice!.id;
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-context', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['wf-progress', 'Invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      reset();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  if (!invoice || !open) return null;

  const setLine = (i: number, patch: Partial<DeductionLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  // Every non-compliant line needs a reason before the approval can go through.
  const slaValid = !showSlaForm || slaLines.every((l) => {
    const v = verdictFor(l);
    return v.status === 'Compliant' || v.reason.trim().length > 0;
  });
  const canSubmit =
    remarks.trim().length > 0 &&
    slaValid &&
    (decision !== 'Approve' || settledTotal <= invoice.grossAmount);

  const netPayable = invoice.grossAmount - settledTotal;

  return (
    <Dialog open onClose={reset} maxWidth="md" fullWidth sx={{ zIndex: (t) => t.zIndex.modal + 2 }}>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Gavel />
          <span>Review — {invoice.invoiceNumber}</span>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} justifyContent="space-between">
            <Metric label="Gross" value={currency(invoice.grossAmount)} />
            <Metric label="Deduction (editing)" value={currency(settledTotal)} />
            <Metric label="Net payable" value={currency(netPayable)} />
          </Stack>

          <Divider>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <AttachFile fontSize="small" />
              <span>Attachments</span>
            </Stack>
          </Divider>
          <DocumentAttachments ownerType="Invoice" ownerId={invoice.id} />

          <ToggleButtonGroup exclusive value={decision} onChange={(_, v) => v && setDecision(v)} fullWidth size="small">
            <ToggleButton value="Approve" color="success">
              <CheckCircle fontSize="small" sx={{ mr: 0.5 }} /> Approve
            </ToggleButton>
            <ToggleButton value="Return" color="warning">
              <Undo fontSize="small" sx={{ mr: 0.5 }} /> Return
            </ToggleButton>
            <ToggleButton value="Reject" color="error">
              <Cancel fontSize="small" sx={{ mr: 0.5 }} /> Reject
            </ToggleButton>
          </ToggleButtonGroup>

          {decision === 'Return' && (
            <>
              <Alert severity="warning">
                Returns the invoice for correction. Optionally name who it's for — they're notified
                and it's recorded on the document.
              </Alert>
              <TextField
                select
                label="Send to (optional)"
                value={returnToUserId}
                onChange={(e) => setReturnToUserId(e.target.value)}
                fullWidth
                helperText="Leave blank to just return it without naming anyone in particular"
              >
                <MenuItem value="">
                  <em>No one in particular</em>
                </MenuItem>
                {(orgUsers.data ?? []).map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.fullName}
                    {u.designation ? ` · ${u.designation}` : ''}
                    {u.departmentName ? ` · ${u.departmentName}` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
          {decision === 'Reject' && <Alert severity="error">Rejects the invoice; it is closed.</Alert>}

          {/* SLA compliance — required at this step because it is configured to capture it. */}
          {showSlaForm && (
            <>
              <Divider>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <VerifiedUser fontSize="small" />
                  <span>SLA compliance</span>
                </Stack>
              </Divider>
              <Typography variant="caption" color="text.secondary">
                Record whether the vendor met each governing SLA. A non-compliance needs a description.
              </Typography>
              {slaLines.map((l) => {
                const v = verdictFor(l);
                return (
                  <Box key={slaKey(l)} sx={{ p: 1.25, borderRadius: 1.5, border: (t) => `1px solid ${t.palette.divider}` }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {l.metric}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {l.source === 'Contract' ? 'Contract SLA' : 'Purchase Order / Work Order SLA'}
                          {l.targetValue ? ` · target ${l.targetValue}` : ''}
                        </Typography>
                      </Box>
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={v.status}
                        onChange={(_, val) => val && setVerdict(l, { status: val })}
                      >
                        <ToggleButton value="Compliant" color="success">
                          <CheckCircle fontSize="small" sx={{ mr: 0.5 }} /> Compliant
                        </ToggleButton>
                        <ToggleButton value="NonCompliant" color="error">
                          <Cancel fontSize="small" sx={{ mr: 0.5 }} /> Non-compliant
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                    {v.status === 'NonCompliant' && (
                      <TextField
                        label="Describe the non-compliance (required)"
                        value={v.reason}
                        onChange={(e) => setVerdict(l, { reason: e.target.value })}
                        fullWidth
                        size="small"
                        multiline
                        minRows={2}
                        error={!v.reason.trim()}
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                );
              })}
            </>
          )}

          {/* Certification + settlement — one Approver, one action. */}
          {decision === 'Approve' && (
            <>
              <Divider>Certification</Divider>
              <TextField
                label="Certified work done (%)"
                type="number"
                value={certifiedPct}
                onChange={(e) => setCertifiedPct(e.target.value)}
                fullWidth
                inputProps={{ min: 0, max: 100 }}
              />
              <FormControlLabel
                control={<Switch checked={satisfactory} onChange={(e) => setSatisfactory(e.target.checked)} />}
                label="Work is satisfactory"
              />
              <TextField
                label="Observations (optional)"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />

              <Divider>Deductions — accept, adjust or waive</Divider>
              <Typography variant="caption" color="text.secondary">
                Edit each line, add new ones, or clear all to pay in full.
              </Typography>

              {lines.length === 0 && (
                <Alert severity="success" icon={<MoneyOff />}>
                  No deductions — the vendor is paid in full ({currency(invoice.grossAmount)}).
                </Alert>
              )}

              {lines.map((line, i) => (
                <Stack key={i} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <TextField
                    select
                    label="Type"
                    value={line.deductionType}
                    onChange={(e) => setLine(i, { deductionType: e.target.value })}
                    size="small"
                    sx={{ minWidth: 170 }}
                    SelectProps={{ MenuProps: { sx: { zIndex: (t) => t.zIndex.modal + 4 } } }}
                  >
                    {DeductionTypes.map((d) => (
                      <MenuItem key={d.value} value={d.value}>
                        {d.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Description"
                    value={line.description}
                    onChange={(e) => setLine(i, { description: e.target.value })}
                    size="small"
                    fullWidth
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      label="Amount"
                      type="number"
                      value={line.amount}
                      onChange={(e) => setLine(i, { amount: e.target.value })}
                      size="small"
                      sx={{ width: { xs: '100%', sm: 160 } }}
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    />
                    <IconButton size="small" color="error" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              ))}

              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setLines((ls) => [...ls, { deductionType: 'Other', description: '', amount: '0' }])}
                >
                  Add deduction
                </Button>
                {lines.length > 0 && (
                  <Button size="small" color="warning" startIcon={<MoneyOff />} onClick={() => setLines([])}>
                    Waive all (pay full)
                  </Button>
                )}
              </Stack>

              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">Total deduction</Typography>
                  <Typography variant="body2" fontWeight={700} color="error.main">
                    − {currency(settledTotal)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">Net payable</Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">
                    {currency(netPayable)}
                  </Typography>
                </Stack>
              </Box>

              {settledTotal > invoice.grossAmount && (
                <Alert severity="error">Deductions cannot exceed the gross claim of {currency(invoice.grossAmount)}.</Alert>
              )}
            </>
          )}

          <TextField
            label="Remarks (required)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            required
            error={!remarks.trim()}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={reset} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={decision === 'Approve' ? 'success' : decision === 'Return' ? 'warning' : 'error'}
          disabled={!canSubmit || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Working…' : `Confirm ${decision.toLowerCase()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Stack alignItems="center" sx={{ flex: 1 }}>
      <Typography variant="caption" color="text.secondary" textAlign="center">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700}>
        {value}
      </Typography>
    </Stack>
  );
}
