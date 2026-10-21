import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import { UploadFile, Download, InsertDriveFile, Verified } from '@mui/icons-material';
import { documentsApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { DocumentFile } from '@/api/types';
import { relativeTime } from '@/lib/format';
import { useAuth } from '@/lib/useAuth';
import { Permissions } from '@/lib/permissions';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The file attachments on one entity — visible to everyone who can view the entity (so
 * approval officers along the workflow see the signed papers), with upload for those who
 * hold document.upload. Downloads stream with the bearer token, then save locally.
 */
export function DocumentAttachments({ ownerType, ownerId }: { ownerType: string; ownerId: string }) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const canUpload = can(Permissions.documentUpload);
  const canDownload = can(Permissions.documentDownload);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', ownerType, ownerId],
    queryFn: () => documentsApi.list(ownerType, ownerId),
    enabled: !!ownerId,
  });

  const upload = useMutation({
    mutationFn: (file: File) => documentsApi.upload(ownerType, ownerId, file),
    onSuccess: (r) => {
      dispatch(showToast({ message: `${r.originalFileName} attached.`, severity: 'success' }));
      queryClient.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] });
    },
    onError: (e) => dispatch(showToast({ message: errorMessage(e), severity: 'error' })),
  });

  const download = async (doc: DocumentFile) => {
    try {
      const blob = await documentsApi.download(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalFileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      dispatch(showToast({ message: errorMessage(e), severity: 'error' }));
    }
  };

  return (
    <Stack spacing={1}>
      {isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : !data || data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No files attached yet.
        </Typography>
      ) : (
        data.map((doc) => (
          <Box
            key={doc.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              borderRadius: 1.5,
              border: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            <InsertDriveFile fontSize="small" color="action" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography variant="body2" fontWeight={600} noWrap>
                  {doc.originalFileName}
                </Typography>
                {doc.isVerified && (
                  <Tooltip title="Verified">
                    <Verified fontSize="inherit" color="success" />
                  </Tooltip>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {humanSize(doc.fileSizeBytes)}
                {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ''} · {relativeTime(doc.uploadedOn)}
                {doc.description ? ` · ${doc.description}` : ''}
              </Typography>
            </Box>
            {canDownload && (
              <Tooltip title="Download">
                <IconButton size="small" onClick={() => download(doc)}>
                  <Download fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ))
      )}

      {canUpload && (
        <Box>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = '';
            }}
          />
          <Button
            size="small"
            startIcon={upload.isPending ? <CircularProgress size={14} /> : <UploadFile />}
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? 'Uploading…' : 'Attach file'}
          </Button>
          <Chip label="PDF, image, Office, text · max 25 MB" size="small" variant="outlined" sx={{ ml: 1, height: 20, fontSize: 11 }} />
        </Box>
      )}
    </Stack>
  );
}
