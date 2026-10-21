import type { ReactNode } from 'react';
import { Box, Stack, Typography, Chip } from '@mui/material';
import type { Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { VerifiedUser, WarningAmber, ErrorOutline } from '@mui/icons-material';
import { currency, date } from '@/lib/format';

type Props = {
  amount?: number | null;
  instrumentType?: string | null;
  instrumentNumber?: string | null;
  instrumentDate?: string | null;
  validityDate?: string | null;
};

const INSTRUMENT_LABELS: Record<string, string> = {
  PerformanceBankGuarantee: 'Performance Bank Guarantee',
  DemandDraft: 'Demand Draft',
  RtgsNeft: 'RTGS / NEFT',
  FixedDepositReceipt: 'Fixed Deposit Receipt (FDR)',
  InsuranceSurety: 'Insurance Surety',
  ElectronicPerformanceBankGuarantee: 'Electronic PBG (ePBG)',
  IndemnityBond: 'Indemnity Bond',
};

const instrumentLabel = (t?: string | null) => (t ? (INSTRUMENT_LABELS[t] ?? t) : '—');

/** Traffic-light status for the instrument's validity, so an expired/expiring deposit stands out. */
function expiryStatus(validityDate?: string | null) {
  if (!validityDate) return null;
  const days = Math.ceil((new Date(validityDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: 'Expired', color: 'error' as const, icon: <ErrorOutline sx={{ fontSize: 14 }} /> };
  if (days <= 60) return { label: `Expires in ${days}d`, color: 'warning' as const, icon: <WarningAmber sx={{ fontSize: 14 }} /> };
  return { label: 'Valid', color: 'success' as const, icon: <VerifiedUser sx={{ fontSize: 14 }} /> };
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mb: 0.4, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem', fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} component="div">
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Corporate presentation of a contract / work-order security deposit: the amount reads as a
 * hero figure in a tinted panel, the instrument particulars sit in a tidy grid, and the
 * validity date carries a status chip so an expired or soon-to-expire instrument is obvious.
 */
export function SecurityDepositCard({ amount, instrumentType, instrumentNumber, instrumentDate, validityDate }: Props) {
  const exp = expiryStatus(validityDate);
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: 'stretch',
        borderRadius: 2,
        overflow: 'hidden',
        border: (t: Theme) => `1px solid ${t.palette.divider}`,
      }}
    >
      {/* Amount hero */}
      <Box
        sx={{
          p: 2.5,
          minWidth: { sm: 210 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 1,
          bgcolor: (t: Theme) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.05),
          borderRight: { sm: (t: Theme) => `1px solid ${t.palette.divider}` },
          borderBottom: { xs: (t: Theme) => `1px solid ${t.palette.divider}`, sm: 'none' },
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem', fontWeight: 600 }}
        >
          Deposit amount
        </Typography>
        <Typography variant="h5" fontWeight={800} color="primary.main" sx={{ lineHeight: 1.1 }}>
          {amount ? currency(amount) : '—'}
        </Typography>
        {instrumentType && (
          <Chip label={instrumentLabel(instrumentType)} size="small" variant="outlined" sx={{ alignSelf: 'flex-start', fontWeight: 600 }} />
        )}
      </Box>

      {/* Instrument particulars */}
      <Box
        sx={{
          p: 2.5,
          flex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
          gap: 2.5,
          alignContent: 'center',
        }}
      >
        {instrumentNumber && <Field label="Instrument no." value={instrumentNumber} />}
        {instrumentDate && <Field label="Issued on" value={date(instrumentDate)} />}
        {validityDate && (
          <Field
            label="Valid till"
            value={
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <span>{date(validityDate)}</span>
                {exp && (
                  <Chip
                    icon={exp.icon}
                    label={exp.label}
                    size="small"
                    color={exp.color}
                    variant="outlined"
                    sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.68rem', fontWeight: 700 } }}
                  />
                )}
              </Stack>
            }
          />
        )}
      </Box>
    </Box>
  );
}
