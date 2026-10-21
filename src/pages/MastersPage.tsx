import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Paper,
  Tabs,
  Tab,
  Box,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  FormControlLabel,
  Switch,
  CircularProgress,
  Typography,
  Tooltip,
} from '@mui/material';
import { Add, EditOutlined, DeleteOutline, Category } from '@mui/icons-material';
import { PageHeader } from '@/components/PageHeader';
import { mastersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { MasterItem, MasterType } from '@/api/types';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

const TABS: { type: MasterType; label: string }[] = [
  { type: 'Department', label: 'Department (Issuing Office)' },
  { type: 'Vertical', label: 'Vertical / Division / Section' },
  { type: 'ContractSelectionMode', label: 'Contract Selection Mode' },
  { type: 'ContractFor', label: 'Contract For' },
  { type: 'ContractCategory', label: 'Contract Category' },
];

export function MastersPage() {
  const { can } = useAuth();
  const canManage = can(Permissions.masterManage);
  const [tab, setTab] = useState(0);
  const type = TABS[tab].type;

  return (
    <>
      <PageHeader
        title="Master Data"
        subtitle="Reference lists that feed the contract form dropdowns"
        icon={<Category />}
      />
      <Paper sx={{ overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {TABS.map((t) => (
            <Tab key={t.type} label={t.label} />
          ))}
        </Tabs>
        <MasterTable type={type} canManage={canManage} />
      </Paper>
    </>
  );
}

function MasterTable({ type, canManage }: { type: MasterType; canManage: boolean }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<MasterItem | 'new' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['masters', type],
    queryFn: () => mastersApi.list(type),
  });

  const remove = useMutation({
    mutationFn: (id: string) => mastersApi.remove(type, id),
    onSuccess: () => {
      dispatch(showToast({ message: 'Entry removed.', severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['masters', type] });
      queryClient.invalidateQueries({ queryKey: ['lookups'] });
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const isCategory = type === 'ContractCategory';

  return (
    <Box>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        {canManage && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setEditing('new')}>
            Add entry
          </Button>
        )}
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
              {isCategory && <TableCell sx={{ fontWeight: 700 }}>Cost &amp; Payment</TableCell>}
              <TableCell sx={{ fontWeight: 700 }} align="right">
                Order
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {(data ?? []).map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {item.name}
                  </Typography>
                  {item.description && (
                    <Typography variant="caption" color="text.secondary">
                      {item.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {item.code}
                  </Typography>
                </TableCell>
                {isCategory && (
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.showCostPaymentSection ? 'Shown' : 'Hidden'}
                      color={item.showCostPaymentSection ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                )}
                <TableCell align="right">{item.sortOrder}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={item.isActive ? 'Active' : 'Inactive'}
                    color={item.isActive ? 'primary' : 'default'}
                    variant={item.isActive ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  {canManage && (
                    <>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditing(item)}>
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <IconButton
                          size="small"
                          color="error"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(item.id)}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={isCategory ? 6 : 5}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    No entries yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {editing && (
        <MasterEditDialog
          type={type}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Box>
  );
}

function MasterEditDialog({
  type,
  item,
  onClose,
}: {
  type: MasterType;
  item: MasterItem | null;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const isCategory = type === 'ContractCategory';
  // Departments have no description / sort order.
  const hasDescSort = type !== 'Department';

  const [name, setName] = useState(item?.name ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [retention, setRetention] = useState(
    item?.defaultRetentionPercentage != null ? String(item.defaultRetentionPercentage) : ''
  );
  const [duration, setDuration] = useState(
    item?.defaultDurationMonths != null ? String(item.defaultDurationMonths) : ''
  );
  const [showCostPayment, setShowCostPayment] = useState(item?.showCostPaymentSection ?? true);

  const save = useMutation({
    mutationFn: () =>
      mastersApi.save({
        id: item?.id,
        type,
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        sortOrder: Number(sortOrder) || 0,
        isActive,
        ...(isCategory
          ? {
              defaultRetentionPercentage: retention ? Number(retention) : null,
              defaultDurationMonths: duration ? Number(duration) : null,
              showCostPaymentSection: showCostPayment,
            }
          : {}),
      }),
    onSuccess: () => {
      dispatch(showToast({ message: `${name.trim()} saved.`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['masters', type] });
      queryClient.invalidateQueries({ queryKey: ['lookups'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item ? 'Edit entry' : 'Add entry'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required autoFocus />
          <TextField
            label="Code (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            fullWidth
            helperText="Left blank, a code is derived from the name."
          />
          {hasDescSort && (
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
            />
          )}
          <Stack direction="row" spacing={2} alignItems="center">
            {hasDescSort && (
              <TextField
                label="Sort order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                sx={{ width: 140 }}
              />
            )}
            <FormControlLabel
              control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
              label="Active"
            />
          </Stack>

          {isCategory && (
            <>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Default retention %"
                  type="number"
                  value={retention}
                  onChange={(e) => setRetention(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Default duration (months)"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  fullWidth
                />
              </Stack>
              <FormControlLabel
                control={
                  <Switch checked={showCostPayment} onChange={(e) => setShowCostPayment(e.target.checked)} />
                }
                label="Show the Cost & Payment section on the contract form for this category"
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!name.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
