import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AdminPanelSettings,
  Add,
  AddBusiness,
  Badge as BadgeIcon,
  Security,
  Groups,
  LockReset,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { PageHeader } from '@/components/PageHeader';
import { UiThemeSettingCard } from '@/components/UiThemeSettingCard';
import {
  adminApi,
  lookupsApi,
  type CreateRoleBody,
  type CreateTenantBody,
  type CreateTenantResult,
  type CreateUserBody,
  type PermissionItem,
} from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/lib/useAuth';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

const USER_STATUS: Record<number, { label: string; color: 'success' | 'default' | 'warning' | 'error' }> = {
  0: { label: 'Pending', color: 'warning' },
  1: { label: 'Active', color: 'success' },
  2: { label: 'Locked', color: 'error' },
  3: { label: 'Suspended', color: 'error' },
  4: { label: 'Inactive', color: 'default' },
};

export function AdminPage() {
  const { isPlatformAdmin, user } = useAuth();
  const [tab, setTab] = useState(0);
  const [orgId, setOrgId] = useState<string>('');
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const queryClient = useQueryClient();

  // Super Admin picks any organisation; an org admin always acts on their own (undefined =
  // the tenant from their token).
  const orgs = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: adminApi.tenants,
    enabled: isPlatformAdmin,
  });
  const tenantId = isPlatformAdmin ? orgId || undefined : undefined;
  const orgName = isPlatformAdmin
    ? orgs.data?.find((o) => o.id === orgId)?.name ?? 'All organisations — pick one'
    : user?.tenant.name;

  return (
    <>
      <PageHeader
        title="Administration"
        subtitle="Create officials, define roles and designations for the organisation"
        icon={<AdminPanelSettings />}
      />

      {isPlatformAdmin && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1.5 }}>
            {/* Top-aligned so the field (not field + helper text) lines up with the label and the
                button; the label column matches the Appearance card below. */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }}>
              <Typography variant="subtitle2" sx={{ width: { sm: 140 }, flexShrink: 0, lineHeight: { sm: '40px' } }}>
                Organisation
              </Typography>
              <TextField
                select
                size="small"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                sx={{ minWidth: 320 }}
                helperText="You are the platform Super Admin — choose which organisation to administer."
              >
                <MenuItem value="">
                  <em>Select an organisation…</em>
                </MenuItem>
                {(orgs.data ?? []).map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name} <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>({o.code})</Typography>
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddBusiness fontSize="small" />}
                onClick={() => setCreateOrgOpen(true)}
                sx={{ ml: { sm: 'auto' } }}
              >
                New organisation
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <UiThemeSettingCard />

      {createOrgOpen && (
        <CreateTenantDialog
          onClose={() => setCreateOrgOpen(false)}
          onCreated={(tenant) => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
            setOrgId(tenant.tenantId);
            setTab(0);
          }}
        />
      )}

      {isPlatformAdmin && !orgId ? (
        <Alert severity="info">Choose an organisation above to manage its users, roles and designations.</Alert>
      ) : (
        <Card variant="outlined">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
          >
            <Tab icon={<Groups fontSize="small" />} iconPosition="start" label="Users" sx={{ minHeight: 56 }} />
            <Tab icon={<Security fontSize="small" />} iconPosition="start" label="Roles" sx={{ minHeight: 56 }} />
            <Tab icon={<BadgeIcon fontSize="small" />} iconPosition="start" label="Designations" sx={{ minHeight: 56 }} />
          </Tabs>
          <CardContent>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
              Managing: <strong>{orgName}</strong>
            </Typography>
            {tab === 0 && <UsersTab tenantId={tenantId} />}
            {tab === 1 && <RolesTab tenantId={tenantId} />}
            {tab === 2 && <DesignationsTab tenantId={tenantId} />}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ---- Organisations -----------------------------------------------------------

function CreateTenantDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (tenant: CreateTenantResult) => void;
}) {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState<CreateTenantBody>({ code: '', name: '' });

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.createTenant({
        ...form,
        code: form.code.trim().toLowerCase(),
        legalName: form.legalName || undefined,
        ministryName: form.ministryName || undefined,
        gstin: form.gstin || undefined,
        pan: form.pan || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
      }),
    onSuccess: (tenant) => {
      dispatch(
        showToast({
          message: `${tenant.name} onboarded. Now create its first Tenant Admin user.`,
          severity: 'success',
        })
      );
      onCreated(tenant);
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const set = (k: keyof CreateTenantBody) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'code' ? e.target.value.toLowerCase() : e.target.value }));

  const canSubmit = /^[a-z][a-z0-9-]*$/.test(form.code.trim()) && form.name.trim().length > 0;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New organisation</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Alert severity="info">
            Its roles and permissions are cloned from NeGD's, and it starts its own document
            numbering. Departments, categories, notifications and approval workflows are not
            cloned — set those up for this organisation from its own Admin screens once it
            exists.
          </Alert>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Organisation name"
              value={form.name}
              onChange={set('name')}
              fullWidth
              autoFocus
              required
            />
            <TextField
              label="Code"
              value={form.code}
              onChange={set('code')}
              sx={{ width: 200 }}
              required
              helperText="e.g. indiaai"
            />
          </Stack>
          <TextField label="Legal name (optional)" value={form.legalName ?? ''} onChange={set('legalName')} fullWidth />
          <TextField label="Ministry / parent body (optional)" value={form.ministryName ?? ''} onChange={set('ministryName')} fullWidth />
          <Stack direction="row" spacing={2}>
            <TextField label="GSTIN (optional)" value={form.gstin ?? ''} onChange={set('gstin')} fullWidth />
            <TextField label="PAN (optional)" value={form.pan ?? ''} onChange={set('pan')} fullWidth />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Contact email (optional)" type="email" value={form.contactEmail ?? ''} onChange={set('contactEmail')} fullWidth />
            <TextField label="Contact phone (optional)" value={form.contactPhone ?? ''} onChange={set('contactPhone')} fullWidth />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="City (optional)" value={form.city ?? ''} onChange={set('city')} fullWidth />
            <TextField label="State (optional)" value={form.state ?? ''} onChange={set('state')} fullWidth />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Creating…' : 'Create organisation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- Users -----------------------------------------------------------------

function UsersTab({ tenantId }: { tenantId?: string }) {
  const [open, setOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; fullName: string } | null>(null);
  const users = useQuery({
    queryKey: ['admin', 'users', tenantId ?? 'self'],
    queryFn: () => adminApi.listUsers(tenantId),
  });

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
          New user
        </Button>
      </Box>
      {users.isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}><CircularProgress size={26} /></Box>
      ) : (users.data ?? []).length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          No officials yet. Create the first one.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Roles</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(users.data ?? []).map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.fullName}</TableCell>
                  <TableCell>{u.userName}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.designation ?? '—'}</TableCell>
                  <TableCell>{u.departmentName ?? '—'}</TableCell>
                  <TableCell>{u.roles ?? '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={USER_STATUS[u.status]?.label ?? u.status} color={USER_STATUS[u.status]?.color ?? 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Reset password">
                      <IconButton size="small" onClick={() => setResetTarget({ id: u.id, fullName: u.fullName })}>
                        <LockReset fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {open && <CreateUserDialog tenantId={tenantId} onClose={() => setOpen(false)} />}
      {resetTarget && (
        <ResetPasswordDialog tenantId={tenantId} target={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </Stack>
  );
}

function ResetPasswordDialog({
  tenantId,
  target,
  onClose,
}: {
  tenantId?: string;
  target: { id: string; fullName: string };
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => adminApi.resetPassword(target.id, newPassword, tenantId),
    onSuccess: () => {
      dispatch(showToast({ message: `Password reset for ${target.fullName}.`, severity: 'success' }));
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Reset password — {target.fullName}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            This sets a new password directly. The current one is not required.
          </Typography>
          <TextField
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            required
            autoFocus
            helperText="At least 8 characters."
          />
          <TextField
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            required
            error={mismatch}
            helperText={mismatch ? 'Passwords do not match.' : ' '}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Resetting…' : 'Reset password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CreateUserDialog({ tenantId, onClose }: { tenantId?: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateUserBody>({
    fullName: '', userName: '', email: '', mobile: '', password: '', designationId: '', departmentId: '', roleIds: [],
  });

  const roles = useQuery({ queryKey: ['admin', 'roles', tenantId ?? 'self'], queryFn: () => adminApi.listRoles(tenantId) });
  const designations = useQuery({ queryKey: ['admin', 'designations', tenantId ?? 'self'], queryFn: () => adminApi.listDesignations(tenantId) });
  // Departments come from the org's own lookups — a Super Admin managing another
  // organisation needs that org's departments, not their own, hence the X-Tenant-Id override.
  const lookups = useQuery({ queryKey: ['admin', 'lookups', tenantId ?? 'self'], queryFn: () => lookupsApi.get(tenantId) });

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.createUser(
        {
          ...form,
          mobile: form.mobile || undefined,
          designationId: form.designationId || undefined,
          departmentId: form.departmentId || undefined,
        },
        tenantId,
      ),
    onSuccess: () => {
      dispatch(showToast({ message: `${form.fullName} created`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const set = (k: keyof CreateUserBody) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const canSubmit =
    form.fullName.trim() && form.userName.trim() && form.email.trim() && form.password.length >= 8 && form.roleIds.length > 0;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New official</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField label="Full name" value={form.fullName} onChange={set('fullName')} fullWidth autoFocus required />
          <Stack direction="row" spacing={2}>
            <TextField label="Username" value={form.userName} onChange={set('userName')} fullWidth required />
            <TextField label="Mobile" value={form.mobile} onChange={set('mobile')} fullWidth />
          </Stack>
          <TextField label="Email" type="email" value={form.email} onChange={set('email')} fullWidth required />
          <TextField
            label="Initial password" type="text" value={form.password} onChange={set('password')} fullWidth required
            helperText="At least 8 characters. The official can change it after signing in."
          />
          <TextField
            select label="Designation" value={form.designationId}
            onChange={(e) => setForm((f) => ({ ...f, designationId: e.target.value }))} fullWidth
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {(designations.data ?? []).map((d) => (
              <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select label="Department" value={form.departmentId}
            onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))} fullWidth
            helperText="Scopes a Creator or Approver to this section — leave blank for a tenant-wide role."
          >
            <MenuItem value=""><em>None (tenant-wide)</em></MenuItem>
            {(lookups.data?.departments ?? []).map((d) => (
              <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select label="Roles" value={form.roleIds}
            SelectProps={{ multiple: true, renderValue: (v) =>
              (roles.data ?? []).filter((r) => (v as string[]).includes(r.id)).map((r) => r.name).join(', ') }}
            onChange={(e) => setForm((f) => ({ ...f, roleIds: e.target.value as unknown as string[] }))}
            fullWidth required helperText="A user's access is the union of their roles."
          >
            {(roles.data ?? []).map((r) => (
              <MenuItem key={r.id} value={r.id}>
                <Checkbox checked={form.roleIds.includes(r.id)} size="small" />
                {r.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Creating…' : 'Create user'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- Roles -----------------------------------------------------------------

function RolesTab({ tenantId }: { tenantId?: string }) {
  const [open, setOpen] = useState(false);
  const roles = useQuery({ queryKey: ['admin', 'roles', tenantId ?? 'self'], queryFn: () => adminApi.listRoles(tenantId) });

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>New role</Button>
      </Box>
      {roles.isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}><CircularProgress size={26} /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Role</TableCell>
                <TableCell>Code</TableCell>
                <TableCell align="right">Seniority</TableCell>
                <TableCell align="right">Permissions</TableCell>
                <TableCell align="right">Users</TableCell>
                <TableCell>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(roles.data ?? []).map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell><strong>{r.name}</strong>{r.description ? <Typography variant="caption" color="text.secondary" display="block">{r.description}</Typography> : null}</TableCell>
                  <TableCell><Typography variant="caption" fontFamily="monospace">{r.code}</Typography></TableCell>
                  <TableCell align="right">{r.hierarchyLevel}</TableCell>
                  <TableCell align="right">{r.permissionCount}</TableCell>
                  <TableCell align="right">{r.userCount}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={r.isSystemRole ? 'System' : 'Custom'} color={r.isSystemRole ? 'default' : 'primary'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {open && <CreateRoleDialog tenantId={tenantId} onClose={() => setOpen(false)} />}
    </Stack>
  );
}

function CreateRoleDialog({ tenantId, onClose }: { tenantId?: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateRoleBody>({ code: '', name: '', description: '', hierarchyLevel: 50, permissionIds: [] });
  const perms = useQuery({ queryKey: ['admin', 'permissions', tenantId ?? 'self'], queryFn: () => adminApi.permissionCatalogue(tenantId) });

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionItem[]>();
    for (const p of perms.data ?? []) {
      const arr = map.get(p.module) ?? [];
      arr.push(p);
      map.set(p.module, arr);
    }
    return [...map.entries()];
  }, [perms.data]);

  const toggle = (id: string) =>
    setForm((f) => ({ ...f, permissionIds: f.permissionIds.includes(id) ? f.permissionIds.filter((x) => x !== id) : [...f.permissionIds, id] }));

  const mutation = useMutation({
    mutationFn: () => adminApi.createRole({ ...form, description: form.description || undefined }, tenantId),
    onSuccess: () => {
      dispatch(showToast({ message: `Role ${form.name} created`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const canSubmit = form.code.trim() && form.name.trim() && form.permissionIds.length > 0;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>New role</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={2}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} fullWidth required autoFocus />
            <TextField label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} fullWidth required helperText="Letters, digits, underscores" />
            <TextField label="Seniority" type="number" value={form.hierarchyLevel} onChange={(e) => setForm((f) => ({ ...f, hierarchyLevel: Number(e.target.value) }))} sx={{ width: 140 }} helperText="Higher wins" />
          </Stack>
          <TextField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} fullWidth />
          <Divider />
          <Typography variant="subtitle2">Permissions ({form.permissionIds.length} selected)</Typography>
          {perms.isLoading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={22} /></Box>
          ) : (
            <Box sx={{ maxHeight: 340, overflowY: 'auto', pr: 1 }}>
              {grouped.map(([module, items]) => (
                <Box key={module} sx={{ mb: 1.5 }}>
                  <Typography variant="caption" fontWeight={800} color="primary" sx={{ textTransform: 'uppercase' }}>{module}</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0 }}>
                    {items.map((p) => (
                      <FormControlLabel
                        key={p.id}
                        control={<Checkbox size="small" checked={form.permissionIds.includes(p.id)} onChange={() => toggle(p.id)} />}
                        label={<Typography variant="body2">{p.name}</Typography>}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Creating…' : 'Create role'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---- Designations ----------------------------------------------------------

function DesignationsTab({ tenantId }: { tenantId?: string }) {
  const [open, setOpen] = useState(false);
  const designations = useQuery({ queryKey: ['admin', 'designations', tenantId ?? 'self'], queryFn: () => adminApi.listDesignations(tenantId) });

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>New designation</Button>
      </Box>
      {designations.isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}><CircularProgress size={26} /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="right">Grade</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(designations.data ?? []).map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell align="right">{d.grade}</TableCell>
                  <TableCell><strong>{d.name}</strong></TableCell>
                  <TableCell><Typography variant="caption" fontFamily="monospace">{d.code}</Typography></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{d.description ?? '—'}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {open && <CreateDesignationDialog tenantId={tenantId} onClose={() => setOpen(false)} />}
    </Stack>
  );
}

function CreateDesignationDialog({ tenantId, onClose }: { tenantId?: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ code: '', name: '', grade: 100, description: '' });

  const mutation = useMutation({
    mutationFn: () => adminApi.createDesignation({ ...form, description: form.description || undefined }, tenantId),
    onSuccess: () => {
      dispatch(showToast({ message: `Designation ${form.name} created`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['admin', 'designations'] });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const canSubmit = form.code.trim() && form.name.trim();

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New designation</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={2}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} fullWidth required autoFocus />
            <TextField label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} fullWidth required />
          </Stack>
          <TextField label="Grade (seniority)" type="number" value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: Number(e.target.value) }))} fullWidth helperText="Lower is more senior (Secretary 10 … Assistant 80)" />
          <TextField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Creating…' : 'Create designation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
