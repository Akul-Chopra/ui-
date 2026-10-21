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
  Box,
  Divider,
  Chip,
  IconButton,
  FormControlLabel,
  Switch,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Add, DeleteOutline, Bolt } from '@mui/icons-material';
import { rulesApi } from '@/api/endpoints';
import type { RuleCondition } from '@/api/types';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';
import {
  RuleTriggers,
  WorkflowEntityTypes,
  RuleEvaluationModes,
  ComparisonOperators,
  RuleActionTypes,
} from '@/lib/enums';

interface ActionDraft {
  actionType: string;
  parametersJson: string;
}

interface RuleDraft {
  code: string;
  name: string;
  isDefaultRule: boolean;
  factKey: string;
  operator: string;
  value: string;
  valueTo: string;
  actions: ActionDraft[];
}

const emptyRule = (isDefault = false): RuleDraft => ({
  code: '',
  name: '',
  isDefaultRule: isDefault,
  factKey: '',
  operator: 'GreaterThanOrEqual',
  value: '',
  valueTo: '',
  actions: [{ actionType: 'SetApprovalLevels', parametersJson: '{"levels":1}' }],
});

/**
 * Authors a new rule set — the "create new rule" the concept note calls for, done without
 * code or redeployment. Each rule is a single leaf condition (a fact compared to a value)
 * plus the actions it emits; a first-match set needs a default rule to fall back on, which
 * this editor seeds and the server enforces.
 */
export function RuleSetEditorDialog({
  open,
  onClose,
  editId,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, the dialog loads that rule set and saves an update to it. */
  editId?: string | null;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trigger, setTrigger] = useState<string>('OnWorkOrderSubmit');
  const [entityType, setEntityType] = useState<string>('WorkOrder');
  const [evaluationMode, setEvaluationMode] = useState<string>('FirstMatch');
  const [priority, setPriority] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [rules, setRules] = useState<RuleDraft[]>([emptyRule(false), emptyRule(true)]);

  // In edit mode, load the existing rule set and populate the form.
  const existing = useQuery({
    queryKey: ['rule-set', editId],
    queryFn: () => rulesApi.set(editId!),
    enabled: open && !!editId,
  });

  useEffect(() => {
    if (!open) return;
    if (editId && existing.data) {
      const d = existing.data;
      setCode(d.code);
      setName(d.name);
      setDescription(d.description ?? '');
      setTrigger(d.trigger);
      setEntityType(d.entityType);
      setEvaluationMode(d.evaluationMode);
      setPriority(d.priority);
      setIsActive(d.isActive);
      setRules(
        d.rules.map((r) => {
          // The editor models one leaf condition per rule; for a grouped condition we take
          // the first leaf so the common (single-condition) rules round-trip cleanly.
          const leaf = firstLeaf(r.rootCondition);
          return {
            code: r.code,
            name: r.name,
            isDefaultRule: r.isDefaultRule,
            factKey: leaf?.factKey ?? '',
            operator: leaf?.operator ?? 'GreaterThanOrEqual',
            value: leaf?.value ?? '',
            valueTo: leaf?.valueTo ?? '',
            actions:
              r.actions.length > 0
                ? r.actions.map((a) => ({ actionType: a.actionType, parametersJson: a.parametersJson }))
                : [{ actionType: 'SetApprovalLevels', parametersJson: '{"levels":1}' }],
          };
        })
      );
    } else if (!editId) {
      setCode('');
      setName('');
      setDescription('');
      setTrigger('OnWorkOrderSubmit');
      setEntityType('WorkOrder');
      setEvaluationMode('FirstMatch');
      setPriority(100);
      setIsActive(true);
      setRules([emptyRule(false), emptyRule(true)]);
    }
  }, [open, editId, existing.data]);

  // The fact catalogue for the chosen entity — the field picker for a leaf condition.
  const facts = useQuery({
    queryKey: ['rule-facts', entityType],
    queryFn: () => rulesApi.facts(entityType),
    enabled: open,
  });

  const setRule = (i: number, patch: Partial<RuleDraft>) =>
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        id: editId ?? undefined,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description || undefined,
        trigger,
        entityType,
        evaluationMode,
        priority,
        isActive,
        rules: rules.map((r, idx) => ({
          code: r.code.trim().toUpperCase(),
          name: r.name.trim(),
          priority: (idx + 1) * 10,
          isActive: true,
          isDefaultRule: r.isDefaultRule,
          rootCondition: r.isDefaultRule
            ? null
            : {
                isGroup: false,
                logicalOperator: 'And',
                factKey: r.factKey,
                operator: r.operator,
                value: needsValue(r.operator) ? r.value : null,
                valueTo: r.operator === 'Between' ? r.valueTo : null,
                isNegated: false,
                sortOrder: 0,
                children: [],
              },
          actions: r.actions.map((a, ai) => ({
            actionType: a.actionType,
            parametersJson: a.parametersJson || '{}',
            sortOrder: ai,
          })),
        })),
      };
      return rulesApi.saveSet(payload);
    },
    onSuccess: (r) => {
      dispatch(showToast({ message: `Rule set ${r.code} saved (v${r.definitionVersion}).`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const hasDefault = rules.some((r) => r.isDefaultRule);
  const rulesValid = rules.every(
    (r) =>
      /^[A-Z0-9_]+$/.test(r.code.trim().toUpperCase()) &&
      r.name.trim().length > 0 &&
      (r.isDefaultRule || (r.factKey && r.operator)) &&
      r.actions.every((a) => isJsonObject(a.parametersJson))
  );
  const valid =
    /^[A-Z0-9_]+$/.test(code.trim().toUpperCase()) &&
    name.trim().length > 0 &&
    rules.length > 0 &&
    rulesValid &&
    (evaluationMode !== 'FirstMatch' || hasDefault);

  const factOptions = useMemo(() => facts.data ?? [], [facts.data]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{editId ? 'Edit rule set' : 'New rule set'}</DialogTitle>
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
                placeholder="WO_APPROVAL_DEPTH"
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
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField select label="Trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)} fullWidth>
                {RuleTriggers.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
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
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                select
                label="Evaluation"
                value={evaluationMode}
                onChange={(e) => setEvaluationMode(e.target.value)}
                fullWidth
                helperText={evaluationMode === 'FirstMatch' ? 'Needs a default rule' : 'Accumulates all matches'}
              >
                {RuleEvaluationModes.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                fullWidth
              />
            </Grid>
          </Grid>

          <FormControlLabel
            control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
            label="Active"
          />

          <Divider>
            <Chip label="Rules" size="small" />
          </Divider>

          {rules.map((rule, i) => (
            <Box key={i} sx={{ p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={rule.isDefaultRule}
                      onChange={(e) => setRule(i, { isDefaultRule: e.target.checked })}
                    />
                  }
                  label="Default (else) rule"
                />
                <IconButton
                  color="error"
                  size="small"
                  onClick={() => setRules((rs) => rs.filter((_, idx) => idx !== i))}
                  disabled={rules.length === 1}
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Stack>

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Rule code"
                    value={rule.code}
                    onChange={(e) => setRule(i, { code: e.target.value.toUpperCase() })}
                    fullWidth
                    size="small"
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField
                    label="Rule name"
                    value={rule.name}
                    onChange={(e) => setRule(i, { name: e.target.value })}
                    fullWidth
                    size="small"
                    required
                  />
                </Grid>

                {!rule.isDefaultRule && (
                  <>
                    <Grid size={{ xs: 12, sm: 5 }}>
                      <TextField
                        select
                        label="When fact"
                        value={rule.factKey}
                        onChange={(e) => setRule(i, { factKey: e.target.value })}
                        fullWidth
                        size="small"
                        required
                      >
                        {factOptions.map((f) => (
                          <MenuItem key={f.factKey} value={f.factKey}>
                            {f.displayName}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <TextField
                        select
                        label="Operator"
                        value={rule.operator}
                        onChange={(e) => setRule(i, { operator: e.target.value })}
                        fullWidth
                        size="small"
                      >
                        {ComparisonOperators.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    {needsValue(rule.operator) && (
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          label="Value"
                          value={rule.value}
                          onChange={(e) => setRule(i, { value: e.target.value })}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                    )}
                    {rule.operator === 'Between' && (
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          label="Value to"
                          value={rule.valueTo}
                          onChange={(e) => setRule(i, { valueTo: e.target.value })}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                    )}
                  </>
                )}
              </Grid>

              {/* Actions */}
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {rule.actions.map((a, ai) => (
                  <Grid container spacing={1} key={ai} alignItems="center">
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        select
                        label="Then action"
                        value={a.actionType}
                        onChange={(e) => {
                          const sample = RuleActionTypes.find((x) => x.value === e.target.value)?.sample ?? '{}';
                          setRule(i, {
                            actions: rule.actions.map((x, xi) =>
                              xi === ai ? { actionType: e.target.value, parametersJson: sample } : x
                            ),
                          });
                        }}
                        fullWidth
                        size="small"
                        InputProps={{ startAdornment: <Bolt fontSize="small" color="secondary" /> }}
                      >
                        {RuleActionTypes.map((t) => (
                          <MenuItem key={t.value} value={t.value}>
                            {t.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 10, sm: 7 }}>
                      <TextField
                        label="Parameters (JSON)"
                        value={a.parametersJson}
                        onChange={(e) =>
                          setRule(i, {
                            actions: rule.actions.map((x, xi) =>
                              xi === ai ? { ...x, parametersJson: e.target.value } : x
                            ),
                          })
                        }
                        fullWidth
                        size="small"
                        error={!isJsonObject(a.parametersJson)}
                      />
                    </Grid>
                    <Grid size={{ xs: 2, sm: 1 }}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          setRule(i, { actions: rule.actions.filter((_, xi) => xi !== ai) })
                        }
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Grid>
                  </Grid>
                ))}
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() =>
                    setRule(i, { actions: [...rule.actions, { actionType: 'Notify', parametersJson: '{}' }] })
                  }
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Add action
                </Button>
              </Stack>
            </Box>
          ))}

          <Button startIcon={<Add />} onClick={() => setRules((rs) => [...rs, emptyRule(false)])} sx={{ alignSelf: 'flex-start' }}>
            Add rule
          </Button>

          {evaluationMode === 'FirstMatch' && !hasDefault && (
            <Alert severity="warning">A first-match set needs one default (else) rule.</Alert>
          )}
          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Save rule set'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The first leaf (non-group) condition in a tree — what the single-leaf editor can show. */
function firstLeaf(cond?: RuleCondition): RuleCondition | null {
  if (!cond) return null;
  if (!cond.isGroup) return cond;
  for (const child of cond.children ?? []) {
    const leaf = firstLeaf(child);
    if (leaf) return leaf;
  }
  return null;
}

/** Operators that compare against a value; the boolean/null operators do not. */
function needsValue(op: string): boolean {
  return !['IsTrue', 'IsFalse', 'IsNull', 'IsNotNull'].includes(op);
}

function isJsonObject(text: string): boolean {
  if (!text.trim()) return true;
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}
