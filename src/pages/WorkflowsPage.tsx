import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AccountTree, Lock, Draw, Schedule, Add, Edit } from '@mui/icons-material';
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
  CircularProgress,
  Button,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/PageHeader';
import { WorkflowEditorDialog } from '@/components/WorkflowEditorDialog';
import { workflowsApi } from '@/api/endpoints';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';

export function WorkflowsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { can } = useAuth();
  const { data: defs, isLoading } = useQuery({ queryKey: ['workflows'], queryFn: workflowsApi.list });
  const activeId = selectedId ?? defs?.[0]?.id ?? null;
  const canEdit = can(Permissions.workflowUpdate);

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
        title="Workflows"
        subtitle="Dynamic approval routes — running approvals pin the version they started under"
        icon={<AccountTree />}
        actions={
          can(Permissions.workflowCreate) && (
            <Button variant="contained" startIcon={<Add />} onClick={openNew}>
              New workflow
            </Button>
          )
        }
      />
      <WorkflowEditorDialog open={editorOpen} editId={editId} onClose={() => setEditorOpen(false)} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Approval Routes
              </Typography>
            </Box>
            <Divider />
            {isLoading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
                <CircularProgress size={22} />
              </Box>
            ) : (
              <List disablePadding>
                {defs?.map((d) => (
                  <ListItemButton key={d.id} selected={d.id === activeId} onClick={() => setSelectedId(d.id)}>
                    <ListItemText primary={d.name} secondary={`${d.entityType} · ${d.stepCount} steps`} />
                    {d.isDefault && <Chip label="Default" size="small" color="primary" variant="outlined" />}
                  </ListItemButton>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          {activeId && <WorkflowDetail id={activeId} canEdit={canEdit} onEdit={() => openEdit(activeId)} />}
        </Grid>
      </Grid>
    </>
  );
}

function WorkflowDetail({ id, canEdit, onEdit }: { id: string; canEdit: boolean; onEdit: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['workflow', id], queryFn: () => workflowsApi.get(id) });

  if (isLoading || !data) {
    return (
      <Paper sx={{ display: 'grid', placeItems: 'center', height: 300 }}>
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h6">{data.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {data.description}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip icon={<Schedule fontSize="small" />} label={`SLA ${data.overallSlaHours ?? '—'}h`} size="small" />
          <Chip label={`v${data.definitionVersion}`} size="small" />
          {canEdit && (
            <Button size="small" variant="outlined" startIcon={<Edit fontSize="small" />} onClick={onEdit}>
              Edit
            </Button>
          )}
        </Stack>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* The steps as a vertical stepper rail. */}
      <Box sx={{ pl: 1 }}>
        {data.steps.map((s, i) => {
          const isLast = i === data.steps.length - 1;
          return (
            <motion.div
              key={s.id ?? i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Stack direction="row" spacing={1.5}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {s.stepNumber}
                  </Box>
                  {!isLast && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', my: 0.5 }} />}
                </Box>
                <Box sx={{ pb: isLast ? 0 : 2.5, flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle2" fontWeight={700}>
                      {s.name}
                    </Typography>
                    <Chip label={s.mode} size="small" variant="outlined" />
                    {s.requiresOtp && <Chip icon={<Lock fontSize="small" />} label="OTP" size="small" color="warning" />}
                    {s.requiresDigitalSignature && (
                      <Chip icon={<Draw fontSize="small" />} label="Signature" size="small" color="warning" />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {s.assignedRoleName ?? 'Document department'} · SLA {s.slaHours ?? '—'}h
                    {s.isRemarksMandatory ? ' · remarks required' : ''}
                  </Typography>
                </Box>
              </Stack>
            </motion.div>
          );
        })}
      </Box>
    </Paper>
  );
}
