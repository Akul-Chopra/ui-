import { Stack, Box, Typography, Chip } from '@mui/material';
import type { Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AccountBalance } from '@mui/icons-material';

/**
 * A vendor bank account rendered as a tinted, icon-led panel rather than a flat text line —
 * shared across the contract/work-order vendor card, the vendor self-profile and the officer
 * review dialog so bank details read consistently and professionally everywhere.
 */
export function BankAccountPanel({
  bankName,
  accountNumber,
  ifscCode,
  isPrimary,
  accountHolderName,
}: {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  isPrimary?: boolean;
  accountHolderName?: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: (t: Theme) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.14 : 0.05),
        border: (t: Theme) => `1px solid ${t.palette.divider}`,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          width: 34,
          height: 34,
          borderRadius: 1.5,
          flexShrink: 0,
          bgcolor: (t: Theme) => alpha(t.palette.primary.main, 0.12),
          color: 'primary.main',
        }}
      >
        <AccountBalance sx={{ fontSize: 19 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.66rem', fontWeight: 700 }}
          >
            Bank account
          </Typography>
          {isPrimary && (
            <Chip
              label="Primary"
              size="small"
              variant="outlined"
              sx={{ height: 17, '& .MuiChip-label': { px: 0.6, fontSize: '0.6rem', fontWeight: 700 } }}
            />
          )}
        </Stack>
        <Typography variant="body2" fontWeight={600}>
          {bankName} · A/C {accountNumber} · {ifscCode}
        </Typography>
        {accountHolderName && (
          <Typography variant="caption" color="text.secondary">
            {accountHolderName}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
