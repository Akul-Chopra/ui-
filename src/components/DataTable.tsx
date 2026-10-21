import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TablePagination,
  TextField,
  InputAdornment,
  Box,
  CircularProgress,
  Typography,
  Stack,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import type { PagedResult } from '@/api/types';
import type { ListParams } from '@/api/endpoints';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
}

/**
 * A server-paged, searchable table. Owns its own page/search/filter state and fetches via
 * React Query, so a list screen is just a set of columns plus a fetcher — the pagination,
 * the debounced-enough search box and the loading state come for free and behave the same
 * everywhere.
 */
export function DataTable<T extends { id?: string; invoiceId?: string }>({
  queryKey,
  fetcher,
  columns,
  filters,
  extraParams,
  searchPlaceholder = 'Search…',
  onRowClick,
  rowKey,
}: {
  queryKey: unknown[];
  fetcher: (params: ListParams) => Promise<PagedResult<T>>;
  columns: Column<T>[];
  filters?: React.ReactNode;
  /** Extra query params (e.g. a "pending with me" toggle) merged into every fetch. */
  extraParams?: ListParams;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');

  const params: ListParams = {
    pageNumber: page + 1,
    pageSize,
    searchTerm: search || undefined,
    ...extraParams,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...queryKey, page, pageSize, search, extraParams],
    queryFn: () => fetcher(params),
    // Keep the previous page visible while the next loads, so paging does not flash empty.
    placeholderData: keepPreviousData,
  });

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ p: 2 }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
      >
        <TextField
          size="small"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          sx={{ minWidth: { sm: 280 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        {filters}
      </Stack>

      <TableContainer sx={{ position: 'relative' }}>
        {isFetching && (
          <Box sx={{ position: 'absolute', top: 6, right: 12, zIndex: 2 }}>
            <CircularProgress size={18} />
          </Box>
        )}
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.key} align={c.align} sx={{ fontWeight: 700, width: c.width }}>
                  {c.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                </TableCell>
              </TableRow>
            ) : data && data.items.length > 0 ? (
              data.items.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  hover
                  onClick={() => onRowClick?.(row)}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((c) => (
                    <TableCell key={c.key} align={c.align}>
                      {c.render ? c.render(row) : (row as Record<string, unknown>)[c.key] as React.ReactNode}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                    No records found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={data?.totalCount ?? 0}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => {
          setPageSize(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[15, 25, 50]}
      />
    </Paper>
  );
}
