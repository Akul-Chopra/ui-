import { Snackbar, Alert } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store';
import { dismissToast } from '@/store/uiSlice';

/** Global toast, driven by the ui slice so any handler can raise one with a dispatch. */
export function Toast() {
  const dispatch = useAppDispatch();
  const toast = useAppSelector((s) => s.ui.toast);

  return (
    <Snackbar
      open={!!toast}
      autoHideDuration={5000}
      onClose={() => dispatch(dismissToast())}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      {toast ? (
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => dispatch(dismissToast())}
          sx={{ minWidth: 300 }}
        >
          {toast.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
