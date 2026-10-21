import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Alert,
  Typography,
  Box,
  Divider,
  Chip,
  IconButton,
  FormControlLabel,
  Switch,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Add, DeleteOutline, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { workflowsApi, usersApi, type AssignableUser } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';
import { useLookups } from '@/lib/useLookups';
import { WorkflowEntityTypes, WorkflowStepModes } from '@/lib/enums';

interface StepDraft {
  name: string;
  mode: string;
  assignedRoleId: string;
  /** When set, the step routes to this specific user (a holder of the role above). */
  assignedUserId: string;
  assignToDocumentDepartment: boolean;
  slaHours: string;
  canReject: boolean;
  canReturn: boolean;
  isRemarksMandatory: boolean;
  requiresOtp: boolean;
  requiresDigitalSignature: boolean;
  capturesSlaCompliance: boolean;
  /** Not edited here; carried through a save so the Creator's self-clearing step stays so. */
  autoCompleteOnRaise: boolean;
}

const emptyStep = (): StepDraft => ({
  name: '',
  mode: 'Sequential',
  assignedRoleId: '',
  assignedUserId: '',
  assignToDocumentDepartment: false,
  slaHours: '48',
  canReject: true,
  canReturn: true,
  isRemarksMandatory: false,
  requiresOtp: false,
  requiresDigitalSignature: false,
  capturesSlaCompliance: false,
  autoCompleteOnRaise: false,
});

/**
 * Authors a new approval route. Steps run in the order shown (1..n); each must assign to a
 * role, which can optionally be narrowed to the document's own department (with a tenant-wide
 * fallback) — the server enforces the role requirement. Editing a route never disturbs an
 * approval already in flight — running instances pin the version they started under.
 */
export function WorkflowEditorDialog({
  open,
  onClose,
  editId,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, the dialog loads that workflow and saves an update to it. */
  editId?: string | null;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lookups = useLookups(open);

  // Active users grouped by role, for the optional "assign to a specific user" picker.
  const usersQuery = useQuery({ queryKey: ['assignable-users'], queryFn: usersApi.list, enabled: open });
  const usersByRole = useMemo(() => {
    const m = new Map<string, AssignableUser[]>();
    for (const u of usersQuery.data ?? []) {
      const arr = m.get(u.roleId) ?? [];
      arr.push(u);
      m.set(u.roleId, arr);
    }
    return m;
  }, [usersQuery.data]);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState<string>('WorkOrder');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [overallSlaHours, setOverallSlaHours] = useState('');
  const [routingMode, setRoutingMode] = useState<'Auto' | 'Manual'>('Auto');
  const [sdRequired, setSdRequired] = useState(false);
  const [sdLevel, setSdLevel] = useState<'Contract' | 'WorkOrder'>('Contract');
  const [sdType, setSdType] = useState<'Percentage' | 'FixedAmount'>('Percentage');
  const [sdValue, setSdValue] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()]);

  // In edit mode, load the existing definition and populate the form from it.
  const existing = useQuery({
    queryKey: ['workflow', editId],
    queryFn: () => workflowsApi.get(editId!),
    enabled: open && !!editId,
  });

  useEffect(() => {
    if (!open) return;
    if (editId && existing.data) {
      const d = existing.data;
      setCode(d.code);
      setName(d.name);
      setDescription(d.description ?? '');
      setEntityType(d.entityType);
      setIsDefault(d.isDefault);
      setIsActive(d.isActive);
      setOverallSlaHours(d.overallSlaHours ? String(d.overallSlaHours) : '');
      setRoutingMode(d.routingMode ?? 'Auto');
      setSdRequired(d.securityDepositRequired ?? false);
      setSdLevel((d.securityDepositLevel as 'Contract' | 'WorkOrder') ?? 'Contract');
      setSdType((d.securityDepositType as 'Percentage' | 'FixedAmount') ?? 'Percentage');
      setSdValue(d.securityDepositValue ? String(d.securityDepositValue) : '');
      setSteps(
        d.steps.map((s) => ({
          name: s.name,
          mode: s.mode,
          assignedRoleId: s.assignedRoleId ?? '',
          assignedUserId: s.assignedUserId ?? '',
          assignToDocumentDepartment: s.assignToDocumentDepartment,
          slaHours: s.slaHours ? String(s.slaHours) : '',
          canReject: s.canReject,
          canReturn: s.canReturn,
          isRemarksMandatory: s.isRemarksMandatory,
          requiresOtp: s.requiresOtp,
          requiresDigitalSignature: s.requiresDigitalSignature,
          capturesSlaCompliance: s.capturesSlaCompliance ?? false,
          autoCompleteOnRaise: s.autoCompleteOnRaise ?? false,
        }))
      );
    } else if (!editId) {
      // Fresh "new workflow" — clear any state left from a previous edit.
      setCode('');
      setName('');
      setDescription('');
      setEntityType('WorkOrder');
      setIsDefault(false);
      setIsActive(true);
      setOverallSlaHours('');
      setSdRequired(false);
      setSdLevel('Contract');
      setSdType('Percentage');
      setSdValue('');
      setSteps([emptyStep()]);
    }
  }, [open, editId, existing.data]);

  const setStep = (i: number, patch: Partial<StepDraft>) =>
    setSteps((ss) => ss.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    setSteps((ss) => {
      const next = [...ss];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        id: editId ?? undefined,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description || undefined,
        entityType,
        isDefault,
        isActive,
        routingMode,
        overallSlaHours: overallSlaHours ? Number(overallSlaHours) : undefined,
        securityDepositRequired: sdRequired,
        securityDepositLevel: sdLevel,
        securityDepositType: sdType,
        securityDepositValue: sdValue ? Number(sdValue) : 0,
        allowSameUserConsecutiveApproval: false,
        steps: steps.map((s, idx) => ({
          stepNumber: idx + 1,
          name: s.name.trim(),
          mode: s.mode,
          parallelCompletion: 'Any',
          // The role is always sent (it scopes the user picker) and must survive when the
          // department toggle is on: "assign to the document's department" only narrows that
          // role to the raising department (with a tenant-wide fallback). A specific user,
          // when chosen, takes precedence in the engine and the department toggle then does
          // not apply.
          assignedRoleId: s.assignedRoleId || null,
          assignedDepartmentId: null,
          assignedUserId: s.assignedUserId || null,
          assignToDocumentDepartment: s.assignedUserId ? false : s.assignToDocumentDepartment,
          conditionFactKey: null,
          conditionOperator: null,
          conditionValue: null,
          slaHours: s.slaHours ? Number(s.slaHours) : null,
          reminderBeforeHours: null,
          escalationRoleId: null,
          escalationAfterHours: null,
          autoEscalate: false,
          canReject: s.canReject,
          canReturn: s.canReturn,
          canDelegate: false,
          isRemarksMandatory: s.isRemarksMandatory,
          requiresOtp: s.requiresOtp,
          requiresDigitalSignature: s.requiresDigitalSignature,
          capturesSlaCompliance: s.capturesSlaCompliance,
          autoCompleteOnRaise: s.autoCompleteOnRaise,
        })),
      };
      return workflowsApi.save(payload);
    },
    onSuccess: (r) => {
      dispatch(showToast({ message: `Workflow ${r.code} saved (v${r.definitionVersion}).`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const stepsValid = steps.every((s) => s.name.trim().length > 0 && !!s.assignedRoleId);
  const valid =
    /^[A-Z0-9_]+$/.test(code.trim().toUpperCase()) && name.trim().length > 0 && steps.length > 0 && stepsValid;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{editId ? 'Edit workflow' : 'New workflow'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                fullWidth
                required
                disabled={!!editId}
                placeholder="WO_HIGH_VALUE"
                helperText={editId ? 'Code cannot be changed' : 'A–Z, 0–9, underscore'}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="Entity"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                fullWidth
              >
                {WorkflowEntityTypes.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                label="Overall SLA (hours)"
                type="number"
                value={overallSlaHours}
                onChange={(e) => setOverallSlaHours(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <TextField
                select
                label="Default routing"
                value={routingMode}
                onChange={(e) => setRoutingMode(e.target.value as 'Auto' | 'Manual')}
                fullWidth
                helperText="Officers can override this at submit"
              >
                <MenuItem value="Auto">Automatic (by role)</MenuItem>
                <MenuItem value="Manual">Manual (pick officer)</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Stack direction="row">
                <FormControlLabel
                  control={<Switch checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />}
                  label="Default"
                />
                <FormControlLabel
                  control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
                  label="Active"
                />
              </Stack>
            </Grid>
          </Grid>

          <Divider>
            <Chip label="Security Deposit" size="small" />
          </Divider>
          <Box sx={{ p: 1.5, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
            <FormControlLabel
              control={<Switch checked={sdRequired} onChange={(e) => setSdRequired(e.target.checked)} />}
              label="Security deposit required for documents on this route"
            />
            {sdRequired && (
              <Grid container spacing={2} sx={{ mt: 0.25 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Collected at"
                    value={sdLevel}
                    onChange={(e) => setSdLevel(e.target.value as 'Contract' | 'WorkOrder')}
                    fullWidth
                  >
                    <MenuItem value="Contract">Contract level</MenuItem>
                    <MenuItem value="WorkOrder">Purchase Order / Work Order level</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField
                    select
                    label="Type"
                    value={sdType}
                    onChange={(e) => setSdType(e.target.value as 'Percentage' | 'FixedAmount')}
                    fullWidth
                  >
                    <MenuItem value="Percentage">Percentage of value</MenuItem>
                    <MenuItem value="FixedAmount">Fixed amount (₹)</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField
                    label={sdType === 'Percentage' ? 'Deposit %' : 'Deposit ₹'}
                    type="number"
                    value={sdValue}
                    onChange={(e) => setSdValue(e.target.value)}
                    fullWidth
                    helperText={sdType === 'Percentage' ? 'e.g. 5 (% of the document value)' : 'Fixed rupee amount'}
                  />
                </Grid>
              </Grid>
            )}
          </Box>

          <Divider>
            <Chip label="Steps" size="small" />
          </Divider>

          {steps.map((step, i) => (
            <Box key={i} sx={{ p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Step {i + 1}
                </Typography>
                <Stack direction="row">
                  <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUpward fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => move(i, 1)} disabled={i === steps.length - 1}>
                    <ArrowDownward fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setSteps((ss) => ss.filter((_, idx) => idx !== i))}
                    disabled={steps.length === 1}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <TextField
                    label="Step name"
                    value={step.name}
                    onChange={(e) => setStep(i, { name: e.target.value })}
                    fullWidth
                    size="small"
                    required
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField
                    select
                    label="Assign to role"
                    value={step.assignedRoleId}
                    // Changing the role clears any specific user chosen under the old role.
                    onChange={(e) => setStep(i, { assignedRoleId: e.target.value, assignedUserId: '' })}
                    fullWidth
                    size="small"
                    required
                  >
                    {(lookups.data?.roles ?? []).map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        {r.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 5 }}>
                  <TextField
                    select
                    label="Assign to user (optional)"
                    value={step.assignedUserId}
                    onChange={(e) => setStep(i, { assignedUserId: e.target.value })}
                    fullWidth
                    size="small"
                    disabled={!step.assignedRoleId || step.assignToDocumentDepartment}
                    helperText={
                      step.assignedRoleId
                        ? step.assignedUserId
                          ? 'Routes to this person specifically.'
                          : 'Leave blank to route to any holder of the role.'
                        : 'Pick a role first.'
                    }
                  >
                    <MenuItem value="">
                      <em>Any holder of the role</em>
                    </MenuItem>
                    {(usersByRole.get(step.assignedRoleId) ?? []).map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.fullName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="SLA (hrs)"
                    type="number"
                    value={step.slaHours}
                    onChange={(e) => setStep(i, { slaHours: e.target.value })}
                    fullWidth
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Mode"
                    value={step.mode}
                    onChange={(e) => setStep(i, { mode: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {WorkflowStepModes.filter((m) => m !== 'Conditional').map((m) => (
                      <MenuItem key={m} value={m}>
                        {m}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={step.assignToDocumentDepartment}
                        onChange={(e) => setStep(i, { assignToDocumentDepartment: e.target.checked })}
                      />
                    }
                    label="Restrict to the same department"
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: -0.5, ml: 4.5 }}>
                    On: only this role in the department that raised the document can approve. Off: anyone with this role can approve.
                  </Typography>
                </Grid>
              </Grid>

              <Stack direction="row" flexWrap="wrap" sx={{ mt: 0.5 }}>
                <FormControlLabel
                  control={<Switch size="small" checked={step.canReject} onChange={(e) => setStep(i, { canReject: e.target.checked })} />}
                  label="Can reject"
                />
                <FormControlLabel
                  control={<Switch size="small" checked={step.canReturn} onChange={(e) => setStep(i, { canReturn: e.target.checked })} />}
                  label="Can return"
                />
                <FormControlLabel
                  control={<Switch size="small" checked={step.isRemarksMandatory} onChange={(e) => setStep(i, { isRemarksMandatory: e.target.checked })} />}
                  label="Remarks required"
                />
                <FormControlLabel
                  control={<Switch size="small" checked={step.requiresOtp} onChange={(e) => setStep(i, { requiresOtp: e.target.checked })} />}
                  label="OTP"
                />
                <FormControlLabel
                  control={<Switch size="small" checked={step.requiresDigitalSignature} onChange={(e) => setStep(i, { requiresDigitalSignature: e.target.checked })} />}
                  label="e-Sign"
                />
                {entityType === 'Invoice' && (
                  <FormControlLabel
                    control={<Switch size="small" color="info" checked={step.capturesSlaCompliance} onChange={(e) => setStep(i, { capturesSlaCompliance: e.target.checked })} />}
                    label="Capture SLA compliance"
                  />
                )}
              </Stack>

              {!step.assignedRoleId && (
                <Typography variant="caption" color="warning.main">
                  Every step must assign to a role. Optionally restrict it to the same department.
                </Typography>
              )}
            </Box>
          ))}

          <Button startIcon={<Add />} onClick={() => setSteps((ss) => [...ss, emptyStep()])} sx={{ alignSelf: 'flex-start' }}>
            Add step
          </Button>

          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save workflow'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
