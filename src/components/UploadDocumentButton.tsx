import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@mui/material';
import { UploadFile } from '@mui/icons-material';
import { documentsApi, type ExtractedDocumentFields } from '@/api/endpoints';
import { useAppDispatch } from '@/store';
import { showToast } from '@/store/uiSlice';

// Word/text/PDF drafts can be read for auto-fill; image files are attached only.
const EXTRACTABLE = /\.(docx|txt|text|pdf)$/i;

/**
 * Uploads a document for the entity being created: the file is held and attached once the
 * record is saved, and — silently, in the background — a Word/text/PDF draft is also read so the
 * form pre-fills from it. One button, both effects; no separate "import" step.
 */
export function UploadDocumentButton({
  onExtracted,
  onFileSelected,
  label,
}: {
  onExtracted: (fields: ExtractedDocumentFields) => void;
  onFileSelected: (file: File) => void;
  label: string;
}) {
  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLInputElement>(null);

  const extract = useMutation({
    mutationFn: (file: File) => documentsApi.extractFields(file),
    onSuccess: (fields) => onExtracted(fields),
    // Best-effort background read — a failure must never block the attachment.
    onError: () => {},
  });

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,.doc,.txt,.text,.pdf,.jpg,.jpeg,.png"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onFileSelected(file);
            dispatch(showToast({ message: `“${file.name}” will be attached on save.`, severity: 'info' }));
            if (EXTRACTABLE.test(file.name)) extract.mutate(file);
          }
          e.target.value = '';
        }}
      />
      <Button
        variant="outlined"
        size="small"
        startIcon={<UploadFile fontSize="small" />}
        disabled={extract.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {extract.isPending ? 'Reading…' : label}
      </Button>
    </>
  );
}
