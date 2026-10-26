import { Stack, Typography } from '@mui/material';

/** Column title for every grid that shows who is paid. */
export const BENEFICIARY_HEADER = 'Beneficiary/Vendor';

/**
 * Who is paid: the bank account holder, or the vendor's name when there is no account holder,
 * with the masked account number and IFSC underneath. Used by every grid with a
 * "Beneficiary/Vendor" column so they read the same.
 */
export function BeneficiaryCell({
  beneficiaryName,
  vendorName,
  accountNumberMasked,
  ifsc,
}: {
  beneficiaryName?: string | null;
  vendorName?: string | null;
  accountNumberMasked?: string | null;
  ifsc?: string | null;
}) {
  return (
    <Stack>
      <Typography variant="body2">{beneficiaryName || vendorName || '—'}</Typography>
      <Typography variant="caption" color="text.secondary">
        {accountNumberMasked || 'No bank account'} · {ifsc || '—'}
      </Typography>
    </Stack>
  );
}
