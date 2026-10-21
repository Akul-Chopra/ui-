import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { paymentsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';

/**
 * Confirms leaving VPS for NGPS, then signs the officer in to NGPS (single sign-on).
 * The server mints a fresh NGPS token with the officer's own NGPS User Key on every
 * click; the portal keys never reach the browser, only the resulting sign-in URL.
 */
export function NgpsSsoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sso = useMutation({
    mutationFn: paymentsApi.ngpsSso,
    onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
  });

  const close = () => {
    if (sso.isPending) return;
    sso.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close}>
      <DialogTitle>Continue to NGPS for payment?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          You are leaving VPS and will be signed in to the NGPS portal to make this payment. Any unsaved changes on
          this page will be lost.
        </DialogContentText>
        {sso.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage(sso.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={sso.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => sso.mutate()}
          disabled={sso.isPending || sso.isSuccess}
          startIcon={sso.isPending || sso.isSuccess ? <CircularProgress size={16} color="inherit" /> : undefined}
          autoFocus
        >
          {sso.isError ? 'Try again' : 'Continue to NGPS'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
