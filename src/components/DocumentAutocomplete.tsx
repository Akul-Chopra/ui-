import { Autocomplete, TextField, Box, Typography } from '@mui/material';

/** One selectable document in a searchable reference picker (a work order, contract, etc.). */
export interface DocumentPickerOption {
  id: string;
  /** Bold first line — typically "number · title". */
  primary: string;
  /** Muted second line — typically the vendor, value, or status. */
  secondary?: string;
  /** Lower-cased text the search box matches against; include every field a user might type. */
  searchText: string;
  /** Shown but not selectable — e.g. a contract still pending approval. */
  disabled?: boolean;
}

/**
 * A searchable, two-line reference picker for documents (work orders, contracts, invoices…).
 * Replaces a plain `<TextField select>` full of single-line "NUMBER · long title · vendor"
 * options that becomes unreadable and unsearchable once there are more than a handful of
 * documents — the common case in a live tenant. Typing filters across number, title and
 * vendor at once; each option keeps the number and title on their own line so a long title
 * doesn't crowd out the number that actually identifies the document.
 */
export function DocumentAutocomplete({
  options,
  value,
  onChange,
  label,
  required,
  disabled,
  loading,
  helperText,
  emptyOptionLabel,
  autoFocus,
}: {
  options: DocumentPickerOption[];
  value: string;
  onChange: (id: string | undefined) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  helperText?: React.ReactNode;
  /** When set, an extra unselectable-looking-but-clearable option is offered, e.g. "Not Applicable". */
  emptyOptionLabel?: string;
  autoFocus?: boolean;
}) {
  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <Autocomplete
      options={options}
      value={selected}
      onChange={(_, next) => onChange(next?.id)}
      getOptionLabel={(o) => o.primary}
      getOptionDisabled={(o) => !!o.disabled}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      filterOptions={(opts, state) => {
        const q = state.inputValue.trim().toLowerCase();
        return q ? opts.filter((o) => o.searchText.includes(q)) : opts;
      }}
      loading={loading}
      disabled={disabled}
      fullWidth
      clearText={emptyOptionLabel ?? 'Clear'}
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <Box component="li" key={key} {...rest}>
            <Box sx={{ py: 0.25, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {option.primary}
              </Typography>
              {option.secondary && (
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {option.secondary}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          helperText={helperText}
          autoFocus={autoFocus}
          placeholder={emptyOptionLabel ? `Search, or leave blank — ${emptyOptionLabel}` : 'Search…'}
        />
      )}
    />
  );
}
