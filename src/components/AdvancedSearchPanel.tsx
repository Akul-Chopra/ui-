import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Popover,
  Button,
  Box,
  Stack,
  TextField,
  MenuItem,
  Autocomplete,
  Chip,
  FormControlLabel,
  Switch,
  Divider,
  Typography,
} from '@mui/material';
import { FilterList } from '@mui/icons-material';
import { vendorsApi } from '@/api/endpoints';

export interface AdvancedFilters {
  status?: string;
  vendorId?: string;
  vendorName?: string;
  minAmount?: string;
  maxAmount?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  overdueOnly?: boolean;
  sortBy?: string;
  sortDescending?: boolean;
}

export const EMPTY_ADVANCED_FILTERS: AdvancedFilters = {};

/** How many of a filter set's fields are actually set — drives the badge on the trigger button. */
export function countActiveFilters(f: AdvancedFilters): number {
  let n = 0;
  if (f.status) n++;
  if (f.vendorId) n++;
  if (f.minAmount || f.maxAmount) n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.category) n++;
  if (f.overdueOnly) n++;
  return n;
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Quick aging/date presets: "older than N days" sets dateTo; "last N days" sets dateFrom. */
const AGE_PRESETS = [
  { label: '7+ days old', days: 7 },
  { label: '30+ days old', days: 30 },
  { label: '90+ days old', days: 90 },
  { label: '1 year+', days: 365 },
];

/**
 * One consistent "Advanced Search" filter popover, reused across Approvals, Invoices, Work
 * Orders and Contracts. Each screen supplies its own status/category option lists (and labels)
 * and translates the emitted generic {@link AdvancedFilters} into that entity's own query
 * params — the screens' backing fields differ (SubmittedFrom/IssuedFrom/CreatedFrom, etc.), but
 * the search experience stays identical everywhere.
 */
export function AdvancedSearchPanel({
  filters,
  onChange,
  statusOptions,
  categoryOptions,
  categoryLabel = 'Type',
  overdueLabel,
  sortOptions,
  amountLabel = 'Amount',
}: {
  filters: AdvancedFilters;
  onChange: (next: AdvancedFilters) => void;
  statusOptions?: { value: string; label: string }[];
  categoryOptions?: { value: string; label: string }[];
  categoryLabel?: string;
  /** Omit to hide the overdue toggle entirely (not every entity has an overdue concept). */
  overdueLabel?: string;
  sortOptions?: { value: string; label: string }[];
  amountLabel?: string;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState<AdvancedFilters>(filters);
  const [vendorSearch, setVendorSearch] = useState('');

  const vendors = useQuery({
    queryKey: ['advanced-search-vendors', vendorSearch],
    queryFn: () => vendorsApi.list({ searchTerm: vendorSearch || undefined, pageSize: 20 }),
    enabled: anchorEl !== null,
  });

  const open = Boolean(anchorEl);
  const activeCount = countActiveFilters(filters);

  const set = <K extends keyof AdvancedFilters>(key: K, value: AdvancedFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const applyAgePreset = (days: number) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    set('dateTo', toDateInput(cutoff));
    set('dateFrom', undefined);
  };

  return (
    <>
      <Button
        size="small"
        variant={activeCount > 0 ? 'contained' : 'outlined'}
        startIcon={<FilterList fontSize="small" />}
        onClick={(e) => {
          setDraft(filters);
          setAnchorEl(e.currentTarget);
        }}
      >
        Advanced search{activeCount > 0 ? ` (${activeCount})` : ''}
      </Button>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2.5, width: 360 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
            Advanced search
          </Typography>
          <Stack spacing={2}>
            {statusOptions && (
              <TextField
                select
                size="small"
                label="Status"
                value={draft.status ?? ''}
                onChange={(e) => set('status', e.target.value || undefined)}
                fullWidth
              >
                <MenuItem value="">
                  <em>Any status</em>
                </MenuItem>
                {statusOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {categoryOptions && (
              <TextField
                select
                size="small"
                label={categoryLabel}
                value={draft.category ?? ''}
                onChange={(e) => set('category', e.target.value || undefined)}
                fullWidth
              >
                <MenuItem value="">
                  <em>{`Any ${categoryLabel.toLowerCase()}`}</em>
                </MenuItem>
                {categoryOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Autocomplete
              size="small"
              options={vendors.data?.items ?? []}
              loading={vendors.isLoading}
              value={draft.vendorId ? { id: draft.vendorId, legalName: draft.vendorName ?? '' } as never : null}
              getOptionLabel={(o) => (o as { legalName: string }).legalName}
              isOptionEqualToValue={(o, v) => (o as { id: string }).id === (v as { id: string }).id}
              onInputChange={(_, v) => setVendorSearch(v)}
              onChange={(_, v) => {
                const vendor = v as { id: string; legalName: string } | null;
                set('vendorId', vendor?.id);
                set('vendorName', vendor?.legalName);
              }}
              renderInput={(params) => <TextField {...params} label="Vendor" placeholder="Search vendors…" />}
            />

            <Stack direction="row" spacing={1.5}>
              <TextField
                size="small"
                type="number"
                label={`Min ${amountLabel} (₹)`}
                value={draft.minAmount ?? ''}
                onChange={(e) => set('minAmount', e.target.value || undefined)}
                fullWidth
              />
              <TextField
                size="small"
                type="number"
                label={`Max ${amountLabel} (₹)`}
                value={draft.maxAmount ?? ''}
                onChange={(e) => set('maxAmount', e.target.value || undefined)}
                fullWidth
              />
            </Stack>

            <Stack spacing={1}>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  size="small"
                  type="date"
                  label="From"
                  value={draft.dateFrom ?? ''}
                  onChange={(e) => set('dateFrom', e.target.value || undefined)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  size="small"
                  type="date"
                  label="To"
                  value={draft.dateTo ?? ''}
                  onChange={(e) => set('dateTo', e.target.value || undefined)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {AGE_PRESETS.map((p) => (
                  <Chip
                    key={p.days}
                    label={p.label}
                    size="small"
                    variant="outlined"
                    onClick={() => applyAgePreset(p.days)}
                  />
                ))}
              </Stack>
            </Stack>

            {overdueLabel && (
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.overdueOnly ?? false}
                    onChange={(e) => set('overdueOnly', e.target.checked || undefined)}
                  />
                }
                label={overdueLabel}
              />
            )}

            {sortOptions && (
              <TextField
                select
                size="small"
                label="Sort by"
                value={draft.sortBy ?? ''}
                onChange={(e) => set('sortBy', e.target.value || undefined)}
                fullWidth
              >
                <MenuItem value="">
                  <em>Default</em>
                </MenuItem>
                {sortOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Button
                size="small"
                onClick={() => {
                  setDraft({});
                  onChange({});
                  setAnchorEl(null);
                }}
              >
                Clear all
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  onChange(draft);
                  setAnchorEl(null);
                }}
              >
                Apply
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
