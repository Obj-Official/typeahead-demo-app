'use client';

import React, {useEffect, useState} from 'react';
import { JetBrains_Mono } from 'next/font/google';
import {
  AppBar,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from '@mui/material';
import {
  CountrySearchError,
  MIN_QUERY_LENGTH,
  flagUrl,
  searchCountries,
  type Country,
} from '@/lib/countries';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

const mono = JetBrains_Mono({ subsets: ['latin'], display: 'swap' });

const BG = '#F5F5F5'; // whitesmoke
const ORANGE = '#FF8C00'; // dark orange
const INK = '#222222'; // very dark gray

const theme = createTheme({
  palette: {
    background: { default: BG, paper: BG },
    text: { primary: INK, secondary: '#555555' },
    primary: { main: ORANGE, contrastText: INK },
  },
  typography: { fontFamily: mono.style.fontFamily },
  shape: { borderRadius: 0 },
});

const DEBOUNCE_MS = 400;

interface SearchResult {
  forQuery: string; // the query these results/error belong to
  options: Country[];
  error: string | null;
}
const EMPTY_RESULT: SearchResult = { forQuery: '', options: [], error: null };

function Flag({ code }: { code: string }) {
  return (
    <Box
      component="img"
      src={flagUrl(code)}
      alt=""
      loading="lazy"
      sx={{ width: 24, height: 16, objectFit: 'cover', border: `1px solid ${INK}`, mr: 1.5 }}
    />
  );
}

export default function SearchPage() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selected, setSelected] = useState<Country | null>(null);
  const [confirmed, setConfirmed] = useState<Country | null>(null);
  const [result, setResult] = useState<SearchResult>(EMPTY_RESULT);
  const [retryTick, setRetryTick] = useState(0);

  const query = inputValue.trim();
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) return;
    if (debouncedQuery === selected?.name) return;

    // Race conditions: every new query cancels the previous request via cleanup.
    const controller = new AbortController();

    searchCountries(debouncedQuery, controller.signal)
      .then((options) => {
        if (controller.signal.aborted) return; // stale response, discard
        setResult({ forQuery: debouncedQuery, options, error: null });
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        setResult({
          forQuery: debouncedQuery,
          options: [],
          error: err instanceof CountrySearchError ? err.message : 'Unexpected error.',
        });
      });

    return () => controller.abort();
  }, [debouncedQuery, retryTick, selected?.name]);

  const enabled = query.length >= MIN_QUERY_LENGTH && query !== selected?.name;
  // Loading covers both the debounce wait and the in-flight request.
  const busy = enabled && result.forQuery !== query;
  const options = enabled && !busy ? result.options : [];
  const error = enabled && !busy ? result.error : null;

  const retry = () => {
    setResult(EMPTY_RESULT);
    setRetryTick((t) => t + 1);
  };

  const noOptionsText = error ? (
    <Box role="alert" aria-live="assertive">
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        Failed to load results. Try again.
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ my: 0.5 }}>
        {error}
      </Typography>
      <Button
        size="small"
        onClick={retry}
        sx={{ color: INK, border: `2px solid ${INK}`, '&:hover': { bgcolor: ORANGE } }}
      >
        Retry
      </Button>
    </Box>
  ) : (
    <span aria-live="polite">No results found</span>
  );

  const loadingText = (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }} aria-live="polite">
      <CircularProgress size={14} thickness={6} sx={{ color: INK }} />
      <span>Searching...</span>
    </Stack>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: BG }}>
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar sx={{ py: 1 }}>
            <Box
              component="img"
              src="/rest_countries.png"
              alt="REST Countries"
              sx={{ height: 40, width: 'auto', display: 'block' }}
            />
          </Toolbar>
        </AppBar>
        <Divider sx={{ borderColor: INK, borderBottomWidth: 2 }} />

        <Box
          component="main"
          sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', pb: 10 }}
        >
          <Container maxWidth="sm">
            <Typography component="h1" variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Find a country
            </Typography>

            <Stack direction="row" spacing={1.5} sx={{ alignItems: "stretch" }}>
              <Autocomplete<Country>
                fullWidth
                open={open && enabled}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
                options={options}
                value={selected}
                onChange={(_, value) => setSelected(value)}
                inputValue={inputValue}
                onInputChange={(_, value) => setInputValue(value)}
                filterOptions={(x) => x} // filtering is done by the API
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(a, b) => a.code === b.code}
                loading={busy}
                loadingText={loadingText}
                noOptionsText={noOptionsText}
                autoHighlight
                handleHomeEndKeys
                forcePopupIcon={false}
                slotProps={{
                  paper: {
                    sx: {
                      mt: 0.5,
                      border: `2px solid ${INK}`,
                      boxShadow: `4px 4px 0 ${ORANGE}`,
                      '& .MuiAutocomplete-loading, & .MuiAutocomplete-noOptions': {
                        color: INK,
                        fontSize: '0.875rem',
                        p: 2,
                      },
                      '& .MuiAutocomplete-option': { py: 1.25, fontSize: '0.95rem' },
                      '& .MuiAutocomplete-option[aria-selected="true"]': {
                        bgcolor: 'rgba(255,140,0,0.25)',
                      },
                      '& .MuiAutocomplete-option.Mui-focused, & .MuiAutocomplete-option[aria-selected="true"].Mui-focused':
                        { bgcolor: ORANGE },
                    },
                  },
                }}
                renderOption={(props, option) => {
                  const { key, ...liProps } = props as typeof props & { key?: string };
                  return (
                    <li key={key ?? option.code} {...liProps}>
                      <Flag code={option.code} />
                      {option.name}
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="type a country name"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '1.05rem',
                        '& fieldset, &:hover fieldset, &.Mui-focused fieldset': {
                          borderColor: INK,
                          borderWidth: 2,
                        },
                        '&.Mui-focused': { boxShadow: `4px 4px 0 ${ORANGE}` },
                      },
                    }}
                    slotProps={{
                      input: {
                        ...params.slotProps.input,
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography component="span" sx={{ color: ORANGE, fontWeight: 800 }}>
                              &gt;
                            </Typography>
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <>
                            {busy ? <CircularProgress size={16} thickness={6} sx={{ color: INK }} /> : null}
                            {params.slotProps.input.endAdornment}
                          </>
                        ),
                      },
                      htmlInput: { ...params.slotProps.htmlInput, 'aria-label': 'Search countries' },
                    }}
                  />
                )}
              />

              <Button
                variant="contained"
                disableElevation
                disabled={!selected}
                onClick={() => setConfirmed(selected)}
                sx={{
                  minWidth: 72,
                  fontWeight: 700,
                  color: INK,
                  bgcolor: ORANGE,
                  border: `2px solid ${INK}`,
                  '&:hover': { bgcolor: INK, color: BG },
                  '&.Mui-disabled': { bgcolor: 'transparent', color: '#8a8a8a', borderColor: '#b5b5b5' },
                }}
              >
                OK
              </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
              Type at least {MIN_QUERY_LENGTH} characters. Up/Down to move, Enter to select, Esc to close.
            </Typography>

            <Box role="status" aria-live="polite" sx={{ mt: 4, minHeight: 32 }}>
              {confirmed && (
                <Stack direction="row" sx={{ alignItems: "center" }}>
                  <Flag code={confirmed.code} />
                  <Typography>
                    Country selected: <b>{confirmed.name}</b>
                  </Typography>
                </Stack>
              )}
            </Box>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
