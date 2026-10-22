import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { EditOutlined, Refresh, Send, Sms } from '@mui/icons-material';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/PageHeader';
import { smsApi } from '@/api/endpoints';
import type {
  SendTestSmsResult,
  SmsEvent,
  SmsGatewayStatus,
  SmsLogEntry,
  SmsTemplate,
} from '@/api/types';
import { errorMessage } from '@/api/client';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

/** Splits "RecipientName" into "Recipient name" for field labels. */
const humanise = (name: string) =>
  name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

const SETTINGS_KEY = ['sms-settings'];

/**
 * Super Admin configuration for SMS sent through the MSDG (Mobile Seva) gateway: which
 * business events send an SMS, the DLT ids of the registered templates, a test send and
 * the recent SMS log.
 */
export function SmsSettingsPage() {
  const [tab, setTab] = useState(0);
  const { data, isLoading, error } = useQuery({ queryKey: SETTINGS_KEY, queryFn: smsApi.settings });

  return (
    <>
      <PageHeader
        title="SMS Notifications"
        subtitle="MSDG gateway, DLT templates and which events send an SMS"
        icon={<Sms />}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(error)}</Alert>}

      {data && <GatewayBanner gateway={data.gateway} />}

      <Paper sx={{ overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Events" />
          <Tab label="Templates" />
          <Tab label="Send test SMS" />
          <Tab label="Recent SMS" />
        </Tabs>
        {isLoading || !data ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            {tab === 0 && <EventsTable events={data.events} />}
            {tab === 1 && <TemplatesTable templates={data.templates} />}
            {tab === 2 && <TestSmsPanel templates={data.templates} />}
            {tab === 3 && <SmsLogTable />}
          </>
        )}
      </Paper>
    </>
  );
}

function GatewayBanner({ gateway }: { gateway: SmsGatewayStatus }) {
  const missing = [
    !gateway.usernameConfigured && 'username',
    !gateway.passwordConfigured && 'password',
    !gateway.secureKeyConfigured && 'secure key',
    !gateway.senderId && 'sender id',
  ].filter(Boolean) as string[];

  return (
    <Alert
      severity={gateway.enabled ? (missing.length ? 'error' : 'success') : 'info'}
      sx={{ mb: 2 }}
      action={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pr: 1 }}>
          <Chip size="small" label={`Sender ID: ${gateway.senderId || 'not set'}`} />
        </Stack>
      }
    >
      {gateway.enabled ? (
        missing.length ? (
          <>Gateway is enabled but the {missing.join(', ')} {missing.length > 1 ? 'are' : 'is'} not configured on the server.</>
        ) : (
          <>Live: SMS are sent through MSDG ({gateway.endpoint}).</>
        )
      ) : (
        <>
          Simulation mode: SMS are rendered, queued and logged but not sent. Set
          <strong> Notifications:Msdg:Enabled</strong> on a server whose IP MSDG has whitelisted.
        </>
      )}
    </Alert>
  );
}

function EventsTable({ events }: { events: SmsEvent[] }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: ({ code, isEnabled }: { code: string; isEnabled: boolean }) => smsApi.updateEvent(code, isEnabled),
    onSuccess: (_, { isEnabled }) => {
      dispatch(showToast({ message: isEnabled ? 'SMS enabled for this event.' : 'SMS disabled for this event.', severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Event</TableCell>
            <TableCell>Module</TableCell>
            <TableCell>Template</TableCell>
            <TableCell>Sent to</TableCell>
            <TableCell align="center">Send SMS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((e) => (
            <TableRow key={e.code} hover>
              <TableCell>
                <Typography variant="body2" fontWeight={600}>{e.name}</Typography>
                {e.description && (
                  <Typography variant="caption" color="text.secondary">{e.description}</Typography>
                )}
              </TableCell>
              <TableCell><Chip size="small" variant="outlined" label={e.module} /></TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>{e.templateName}</span>
                  {e.isEnabled && !e.isDeliverable && (
                    <Tooltip title="The template is inactive or has no DLT template id, so this event sends nothing yet.">
                      <Chip size="small" color="warning" label="Template not ready" />
                    </Tooltip>
                  )}
                </Stack>
              </TableCell>
              <TableCell>{e.recipientDescription}</TableCell>
              <TableCell align="center">
                <Switch
                  checked={e.isEnabled}
                  disabled={toggle.isPending}
                  onChange={(_, checked) => toggle.mutate({ code: e.code, isEnabled: checked })}
                  inputProps={{ 'aria-label': `Send SMS for ${e.name}` }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function TemplatesTable({ templates }: { templates: SmsTemplate[] }) {
  const [editing, setEditing] = useState<SmsTemplate | null>(null);

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Alert severity="info" sx={{ m: 2 }}>
        Template text must match the DLT registration exactly, so only the DLT template id and the active flag can be
        changed here. Each <code>{'{#var#}'}</code> is filled from the variable at the same position.
      </Alert>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Template</TableCell>
            <TableCell>Registered text</TableCell>
            <TableCell>DLT template id</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {templates.map((t) => (
            <TableRow key={t.code} hover>
              <TableCell>
                <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.isOtp ? 'OTP message' : 'Transactional'} · {t.variables.join(', ')}
                </Typography>
              </TableCell>
              <TableCell sx={{ maxWidth: 420 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{t.body}</Typography>
              </TableCell>
              <TableCell>
                {t.dltTemplateId ? (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{t.dltTemplateId}</Typography>
                ) : (
                  <Chip size="small" color="warning" label="Not set" />
                )}
              </TableCell>
              <TableCell>
                <Chip size="small" color={t.isActive ? 'success' : 'default'} label={t.isActive ? 'Active' : 'Inactive'} />
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Edit DLT id">
                  <IconButton size="small" onClick={() => setEditing(t)}>
                    <EditOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {editing && <TemplateDialog template={editing} onClose={() => setEditing(null)} />}
    </Box>
  );
}

function TemplateDialog({ template, onClose }: { template: SmsTemplate; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [dltTemplateId, setDltTemplateId] = useState(template.dltTemplateId ?? '');
  const [isActive, setIsActive] = useState(template.isActive);

  const trimmed = dltTemplateId.trim();
  const invalid = trimmed.length > 0 && !/^(\d{12}|\d{19})$/.test(trimmed);

  const save = useMutation({
    mutationFn: () => smsApi.updateTemplate(template.code, { dltTemplateId: trimmed || null, isActive }),
    onSuccess: () => {
      dispatch(showToast({ message: 'Template updated.', severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      onClose();
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{template.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
            {template.body}
          </Typography>
          <TextField
            label="DLT template id"
            value={dltTemplateId}
            onChange={(e) => setDltTemplateId(e.target.value)}
            error={invalid}
            helperText={invalid ? 'Must be 12 or 19 digits.' : 'Issued by the operator when the template was registered on DLT.'}
            inputProps={{ inputMode: 'numeric', maxLength: 19 }}
            fullWidth
          />
          <FormControlLabel
            control={<Switch checked={isActive} onChange={(_, v) => setIsActive(v)} />}
            label="Active (events using this template can send)"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={invalid || save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TestSmsPanel({ templates }: { templates: SmsTemplate[] }) {
  const dispatch = useAppDispatch();
  const [templateCode, setTemplateCode] = useState(templates[0]?.code ?? '');
  const [mobile, setMobile] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SendTestSmsResult | null>(null);

  const template = useMemo(() => templates.find((t) => t.code === templateCode), [templates, templateCode]);

  // Each template has its own variables; start every switch with a clean set.
  useEffect(() => {
    setValues({});
    setResult(null);
  }, [templateCode]);

  const preview = useMemo(() => {
    if (!template) return '';
    let i = 0;
    return template.body.replace(/\{#var#\}/g, () => {
      const name = template.variables[i++];
      return values[name]?.trim() || `{${name}}`;
    });
  }, [template, values]);

  const send = useMutation({
    mutationFn: () => smsApi.sendTest({ mobile, templateCode, values }),
    onSuccess: (r) => setResult(r),
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const complete = !!template && template.variables.every((v) => values[v]?.trim()) && /^\d{10}$/.test(mobile.replace(/\D/g, '').slice(-10));

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 640 }}>
      <TextField select label="Template" value={templateCode} onChange={(e) => setTemplateCode(e.target.value)}>
        {templates.map((t) => (
          <MenuItem key={t.code} value={t.code}>
            {t.name}
            {!t.dltTemplateId && ' (no DLT id)'}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Mobile number"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        placeholder="98XXXXXXXX"
        inputProps={{ inputMode: 'tel', maxLength: 14 }}
      />
      {template?.variables.map((name) => (
        <TextField
          key={name}
          label={humanise(name)}
          value={values[name] ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
        />
      ))}
      {template && (
        <Box>
          <Typography variant="caption" color="text.secondary">Preview</Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
            {preview}
          </Typography>
        </Box>
      )}
      <Box>
        <Button
          variant="contained"
          startIcon={send.isPending ? <CircularProgress size={16} color="inherit" /> : <Send />}
          disabled={!complete || send.isPending}
          onClick={() => send.mutate()}
        >
          Send test SMS
        </Button>
      </Box>
      {result && (
        <Alert severity={result.succeeded ? (result.simulated ? 'info' : 'success') : 'error'}>
          {result.message}
          {result.responseCode && <> (code {result.responseCode})</>}
          {result.providerMessageId && result.providerMessageId !== 'simulated' && <> · Message id {result.providerMessageId}</>}
        </Alert>
      )}
    </Stack>
  );
}

const STATUS_COLOR: Record<SmsLogEntry['status'], 'default' | 'success' | 'error' | 'info'> = {
  Queued: 'info',
  Sent: 'success',
  Failed: 'error',
  Read: 'default',
};

function SmsLogTable() {
  const { data, isLoading, isFetching, refetch } = useQuery({ queryKey: ['sms-log'], queryFn: () => smsApi.log(50) });

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          The latest 50 SMS raised by events, across all organisations. Numbers are masked and OTPs are hidden.
        </Typography>
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={() => refetch()} disabled={isFetching}>
              <Refresh />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {isLoading ? (
        <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
      ) : !data?.length ? (
        <Typography sx={{ p: 3 }} color="text.secondary">No SMS has been raised yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Organisation</TableCell>
              <TableCell>Event</TableCell>
              <TableCell>Mobile</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{dayjs(row.createdOn).format('DD MMM YYYY, HH:mm')}</TableCell>
                <TableCell>{row.organisation ?? '—'}</TableCell>
                <TableCell><Chip size="small" variant="outlined" label={row.eventCode ?? '—'} /></TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{row.maskedMobile}</TableCell>
                <TableCell sx={{ maxWidth: 360 }}>
                  <Typography variant="body2" sx={{ fontSize: 12 }}>{row.message}</Typography>
                  {row.failureReason && (
                    <Typography variant="caption" color="error">{row.failureReason}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Tooltip title={row.providerMessageId ? `Message id: ${row.providerMessageId}` : `Attempts: ${row.attempts}`}>
                    <Chip size="small" color={STATUS_COLOR[row.status]} label={row.providerMessageId === 'simulated' ? 'Simulated' : row.status} />
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
