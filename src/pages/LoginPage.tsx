import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, Navigate, Link as RouterLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  MenuItem,
  Alert,
  InputAdornment,
  Stack,
  Divider,
  Link,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import { AccountBalance, Person, Lock, Domain, ContentCopy, Store } from '@mui/icons-material';
import { authApi } from '@/api/endpoints';
import { publicRegistrationApi, type DemoAccount } from '@/api/publicRegistration';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { signedIn } from '@/store/authSlice';
import { useAuth } from '@/lib/useAuth';

const schema = z.object({
  tenantCode: z.string().min(1, 'Select an organisation'),
  login: z.string().min(1, 'Enter your username or email'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

// The two seeded tenants, offered as a picker so a demo audience can switch between
// ministries without typing a code. A real deployment would resolve the tenant from the
// host name; the picker is a POC affordance.
const DEMO_TENANTS = [
  { code: 'negd', name: 'National eGovernance Division' },
  { code: 'mopsw', name: 'Ministry of Ports, Shipping & Waterways' },
];

// Seeded accounts share this password; accounts created through the admin screen use whatever
// password was set for them.
const DEMO_PASSWORD = 'Vps@2026#Demo';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [accountSearch, setAccountSearch] = useState('');

  const { register, handleSubmit, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tenantCode: 'negd', login: '', password: '' },
  });

  // Organisations for the picker (all active tenants, not a hard-coded pair).
  const orgs = useQuery({ queryKey: ['public-orgs'], queryFn: publicRegistrationApi.organisations });
  const orgOptions = (orgs.data ?? []).length
    ? orgs.data!.map((o) => ({ code: o.code, name: o.name }))
    : DEMO_TENANTS;

  // Development-only: every account, so a reviewer can sign in as anyone. Empty in production.
  const accounts = useQuery({
    queryKey: ['dev-accounts'],
    queryFn: publicRegistrationApi.devAccounts,
    enabled: import.meta.env.DEV,
  });

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    const rows = accounts.data ?? [];
    if (!q) return rows;
    return rows.filter((a) =>
      [a.fullName, a.userName, a.roles, a.designation, a.orgName]
        .some((f) => f?.toLowerCase().includes(q))
    );
  }, [accounts.data, accountSearch]);

  // Group the (filtered) accounts by organisation, preserving order.
  const groupedAccounts = useMemo(() => {
    const groups = new Map<string, DemoAccount[]>();
    for (const a of filteredAccounts) {
      const arr = groups.get(a.orgName) ?? [];
      arr.push(a);
      groups.set(a.orgName, arr);
    }
    return [...groups.entries()];
  }, [filteredAccounts]);

  const fillCredentials = (orgCode: string, login: string) => {
    setValue('tenantCode', orgCode, { shouldValidate: true });
    setValue('login', login, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
  };

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      dispatch(signedIn(data));
      navigate('/dashboard');
    },
  });

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background:
          'radial-gradient(1200px 600px at 10% -10%, rgba(11,79,108,0.25), transparent), radial-gradient(1000px 500px at 110% 110%, rgba(1,186,239,0.2), transparent)',
      }}
    >
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, width: { xs: '100%', sm: 440 }, maxWidth: '100%' }}>
          <Stack spacing={1} alignItems="center" sx={{ mb: 3 }}>
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 60,
                height: 60,
                borderRadius: 3,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                mb: 1,
              }}
            >
              <AccountBalance fontSize="large" />
            </Box>
            <Typography variant="h5" fontWeight={800}>
              Vendor Payment System
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              National eGovernance Division — secure government access
            </Typography>
          </Stack>

          {mutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage(mutation.error)}
            </Alert>
          )}

          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
            <Stack spacing={2}>
              <TextField
                select
                label="Organisation"
                defaultValue="negd"
                fullWidth
                {...register('tenantCode')}
                error={!!formState.errors.tenantCode}
                helperText={formState.errors.tenantCode?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Domain fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              >
                {orgOptions.map((t) => (
                  <MenuItem key={t.code} value={t.code}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Username or email"
                fullWidth
                autoFocus
                {...register('login')}
                error={!!formState.errors.login}
                helperText={formState.errors.login?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="Password"
                type="password"
                fullWidth
                {...register('password')}
                error={!!formState.errors.password}
                helperText={formState.errors.password?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <Button type="submit" variant="contained" size="large" fullWidth disabled={mutation.isPending}>
                {mutation.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </form>

          <Divider sx={{ my: 2.5 }} />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            New vendor?{' '}
            <Link component={RouterLink} to="/register" fontWeight={700}>
              Register here
            </Link>
          </Typography>

          {/* Development only: every account, click to fill (sets organisation + username) and
              sign in. The API returns an empty list outside Development, so this never renders
              in production. */}
          {import.meta.env.DEV && (accounts.data?.length ?? 0) > 0 && (
            <Box sx={{ mt: 3, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
              <Box sx={{ px: 1.5, pt: 1.25, pb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label="LOCAL DEV" size="small" color="warning" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {accounts.data!.length} demo accounts — click to fill
                  </Typography>
                </Stack>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  Password: <b>{DEMO_PASSWORD}</b> (accounts created via admin use the password set for them).
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search name, username, role or organisation…"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  sx={{ mt: 1 }}
                />
              </Box>
              <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
                {groupedAccounts.map(([orgName, rows]) => (
                  <Box key={orgName}>
                    <Typography
                      variant="caption"
                      sx={{ px: 1.5, py: 0.5, display: 'block', fontWeight: 800, color: 'text.secondary', bgcolor: 'action.selected', position: 'sticky', top: 0, zIndex: 1 }}
                    >
                      {orgName}
                    </Typography>
                    <List dense disablePadding>
                      {rows.map((a) => (
                        <ListItemButton key={`${a.orgCode}:${a.userName}`} onClick={() => fillCredentials(a.orgCode, a.userName)} sx={{ py: 0.5 }}>
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Typography variant="body2" fontWeight={600}>{a.fullName}</Typography>
                                {a.isVendor && <Store sx={{ fontSize: 14, color: 'text.disabled' }} />}
                              </Stack>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {a.roles ?? (a.isVendor ? 'Vendor' : '—')} · <code>{a.userName}</code>
                              </Typography>
                            }
                          />
                          <Tooltip title="Copy username">
                            <IconButton
                              size="small"
                              edge="end"
                              onClick={(e) => {
                                e.stopPropagation();
                                void navigator.clipboard?.writeText(a.userName);
                              }}
                            >
                              <ContentCopy sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </ListItemButton>
                      ))}
                    </List>
                  </Box>
                ))}
                {groupedAccounts.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 1, display: 'block' }}>
                    No accounts match “{accountSearch}”.
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Paper>
      </motion.div>
    </Box>
  );
}
