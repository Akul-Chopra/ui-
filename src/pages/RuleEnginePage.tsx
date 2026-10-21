import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Rule as RuleIcon,
  PlayArrow,
  Edit,
  Check,
  Bolt,
  Gavel,
  Science,
  Add,
} from '@mui/icons-material';
import {
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
  Stack,
  Divider,
  Button,
  TextField,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/PageHeader';
import { RuleSetEditorDialog } from '@/components/RuleSetEditorDialog';
import { rulesApi } from '@/api/endpoints';
import type { Rule, RuleCondition, RuleSetDetail, SimulateResult } from '@/api/types';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';

export function RuleEnginePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { can } = useAuth();
  const { data: sets, isLoading } = useQuery({ queryKey: ['rule-sets'], queryFn: rulesApi.sets });

  const activeId = selectedId ?? sets?.[0]?.id ?? null;
  const canEdit = can(Permissions.ruleUpdate);

  const openNew = () => {
    setEditId(null);
    setEditorOpen(true);
  };
  const openEdit = (id: string) => {
    setEditId(id);
    setEditorOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Rule Engine"
        subtitle="Configure thresholds, approval depth and deductions — no code, no redeployment"
        icon={<RuleIcon />}
        actions={
          can(Permissions.ruleCreate) && (
            <Button variant="contained" startIcon={<Add />} onClick={openNew}>
              New rule set
            </Button>
          )
        }
      />
      <RuleSetEditorDialog open={editorOpen} editId={editId} onClose={() => setEditorOpen(false)} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Rule Sets
              </Typography>
            </Box>
            <Divider />
            {isLoading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
                <CircularProgress size={22} />
              </Box>
            ) : (
              <List disablePadding sx={{ maxHeight: 560, overflowY: 'auto' }}>
                {sets?.map((s) => (
                  <ListItemButton
                    key={s.id}
                    selected={s.id === activeId}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <ListItemText
                      primary={s.name}
                      secondary={`${s.trigger} · ${s.ruleCount} rules · v${s.definitionVersion}`}
                    />
                    {!s.isActive && <Chip label="Off" size="small" />}
                  </ListItemButton>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          {activeId ? (
            <RuleSetPanel ruleSetId={activeId} canEdit={canEdit} onEdit={() => openEdit(activeId)} />
          ) : null}
        </Grid>
      </Grid>
    </>
  );
}

function RuleSetPanel({ ruleSetId, canEdit, onEdit }: { ruleSetId: string; canEdit: boolean; onEdit: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['rule-set', ruleSetId],
    queryFn: () => rulesApi.set(ruleSetId),
  });

  if (isLoading || !data) {
    return (
      <Paper sx={{ display: 'grid', placeItems: 'center', height: 300 }}>
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h6">{data.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {data.description}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={data.trigger} size="small" color="primary" variant="outlined" />
            <Chip label={data.evaluationMode} size="small" variant="outlined" />
            <Chip label={`v${data.definitionVersion}`} size="small" />
            {canEdit && (
              <Button size="small" variant="outlined" startIcon={<Edit fontSize="small" />} onClick={onEdit}>
                Edit
              </Button>
            )}
          </Stack>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={1.5}>
          {data.rules.map((r) => (
            <RuleCard key={r.id} rule={r} ruleSetId={ruleSetId} />
          ))}
        </Stack>
      </Paper>

      <Simulator ruleSet={data} />
    </Stack>
  );
}

function RuleCard({ rule, ruleSetId }: { rule: Rule; ruleSetId: string }) {
  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: rule.isDefaultRule ? 'action.hover' : 'transparent',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={0.5}>
        <Typography variant="subtitle2" fontWeight={700}>
          {rule.name}
        </Typography>
        {rule.isDefaultRule && <Chip label="Default (else)" size="small" />}
      </Stack>

      {/* The condition: for a leaf, an editable threshold; for a default, a note. */}
      <Box sx={{ mt: 1 }}>
        {rule.rootCondition ? (
          <ConditionView condition={rule.rootCondition} ruleSetId={ruleSetId} />
        ) : (
          <Typography variant="caption" color="text.secondary">
            Always matches — the fallback when no other rule does.
          </Typography>
        )}
      </Box>

      {/* The actions this rule emits. */}
      {rule.actions.length > 0 && (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
          {rule.actions.map((a, i) => (
            <Chip
              key={i}
              icon={<Bolt fontSize="small" />}
              label={`${a.actionType} ${summariseParams(a.parametersJson)}`}
              size="small"
              color="secondary"
              variant="outlined"
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function ConditionView({ condition, ruleSetId }: { condition: RuleCondition; ruleSetId: string }) {
  // A group renders its children joined by AND/OR; a leaf renders the editable comparison.
  if (condition.isGroup) {
    return (
      <Stack spacing={0.5}>
        {condition.children.map((c, i) => (
          <Box key={i}>
            {i > 0 && (
              <Typography variant="caption" color="primary" fontWeight={700}>
                {condition.logicalOperator.toUpperCase()}
              </Typography>
            )}
            <ConditionView condition={c} ruleSetId={ruleSetId} />
          </Box>
        ))}
      </Stack>
    );
  }
  return <ThresholdLeaf condition={condition} ruleSetId={ruleSetId} />;
}

function ThresholdLeaf({ condition, ruleSetId }: { condition: RuleCondition; ruleSetId: string }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canEdit = can(Permissions.ruleUpdate);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(condition.value ?? '');

  const mutation = useMutation({
    mutationFn: () => rulesApi.setThreshold(condition.id!, { value, reason: 'Edited from rule engine screen' }),
    onSuccess: (r) => {
      dispatch(
        showToast({
          message: `Threshold updated to ${r.newValue}. Effective immediately (v${r.newDefinitionVersion}).`,
          severity: 'success',
        })
      );
      setEditing(false);
      // Refresh the set and any simulation so the change is visible at once.
      queryClient.invalidateQueries({ queryKey: ['rule-set', ruleSetId] });
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] });
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const operator = humaniseOperator(condition.operator);

  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      <Chip icon={<Gavel fontSize="small" />} label={condition.factKey} size="small" variant="outlined" />
      <Typography variant="caption" color="text.secondary">
        {operator}
      </Typography>
      {editing ? (
        <>
          <TextField
            size="small"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            sx={{ width: 130 }}
            autoFocus
          />
          <IconButton size="small" color="primary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            <Check fontSize="small" />
          </IconButton>
        </>
      ) : (
        <>
          <Chip label={condition.value} size="small" color="primary" />
          {canEdit && (
            <Tooltip title="Change threshold">
              <IconButton size="small" onClick={() => setEditing(true)}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </>
      )}
    </Stack>
  );
}

function Simulator({ ruleSet }: { ruleSet: RuleSetDetail }) {
  const { can } = useAuth();
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SimulateResult | null>(null);
  const dispatch = useAppDispatch();

  // The distinct fact keys the set's rules reference, so the simulator offers exactly the
  // inputs that matter for this set rather than the whole catalogue.
  const factKeys = useMemo(() => collectFactKeys(ruleSet), [ruleSet]);

  const mutation = useMutation({
    mutationFn: () => rulesApi.simulate(ruleSet.id, facts),
    onSuccess: setResult,
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  if (!can(Permissions.ruleSimulate)) return null;

  return (
    <Paper sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Science color="primary" />
        <Typography variant="h6">Simulator</Typography>
        <Typography variant="caption" color="text.secondary">
          Try values and see what the rules would decide — nothing is saved.
        </Typography>
      </Stack>

      <Grid container spacing={1.5}>
        {factKeys.map((key) => (
          <Grid size={{ xs: 12, sm: 6 }} key={key}>
            <TextField
              fullWidth
              size="small"
              label={key}
              value={facts[key] ?? ''}
              onChange={(e) => setFacts((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={key.includes('Amount') || key.includes('Value') ? 'e.g. 500000' : ''}
            />
          </Grid>
        ))}
      </Grid>

      <Button
        variant="contained"
        startIcon={<PlayArrow />}
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        sx={{ mt: 2 }}
      >
        {mutation.isPending ? 'Running…' : 'Run simulation'}
      </Button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Box sx={{ mt: 2.5 }}>
            <Divider sx={{ mb: 2 }} />
            {result.isBlocked && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                Blocked: {result.blockMessage}
              </Alert>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
              {result.approvalLevels != null && (
                <Chip label={`${result.approvalLevels} approval levels`} color="primary" />
              )}
              {result.contractRequired != null && (
                <Chip
                  label={result.contractRequired ? 'Contract required' : 'Contract optional'}
                  color={result.contractRequired ? 'warning' : 'success'}
                />
              )}
              {result.isFlaggedForAudit && <Chip label="Flagged for audit" color="warning" />}
              {result.isAutoApproved && <Chip label="Auto-approved" color="success" />}
              {result.matchedRules.map((m) => (
                <Chip key={m.code} label={`Matched: ${m.code}`} size="small" variant="outlined" />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              WHY
            </Typography>
            {result.explanation.map((line, i) => (
              <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12.5 }}>
                {line}
              </Typography>
            ))}
          </Box>
        </motion.div>
      )}
    </Paper>
  );
}

// ---- helpers -------------------------------------------------------------

function collectFactKeys(set: RuleSetDetail): string[] {
  const keys = new Set<string>();
  const walk = (c?: RuleCondition) => {
    if (!c) return;
    if (!c.isGroup && c.factKey) keys.add(c.factKey);
    c.children?.forEach(walk);
  };
  set.rules.forEach((r) => walk(r.rootCondition));
  return [...keys];
}

function humaniseOperator(op?: string): string {
  const map: Record<string, string> = {
    GreaterThan: '>',
    GreaterThanOrEqual: '≥',
    LessThan: '<',
    LessThanOrEqual: '≤',
    Equals: '=',
    NotEquals: '≠',
    Between: 'between',
    In: 'in',
    IsTrue: 'is true',
    IsFalse: 'is false',
  };
  return op ? map[op] ?? op : '';
}

function summariseParams(json: string): string {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const entries = Object.entries(obj).slice(0, 2);
    if (entries.length === 0) return '';
    return `(${entries.map(([k, v]) => `${k}: ${v}`).join(', ')})`;
  } catch {
    return '';
  }
}
