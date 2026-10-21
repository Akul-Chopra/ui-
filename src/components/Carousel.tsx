import { useEffect, useState, type ReactNode } from 'react';
import { Box, IconButton, Stack } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * A minimal auto-advancing carousel: one slide visible at a time, with dots, arrows and a
 * timer that pauses on hover. Slides are arbitrary nodes so it can carry hero copy, feature
 * cards, or screenshots. Self-contained — no external carousel dependency.
 */
export function Carousel({
  slides,
  interval = 5000,
  height,
}: {
  slides: ReactNode[];
  interval?: number;
  height?: number | string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (paused || count <= 1) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => window.clearInterval(id);
  }, [paused, count, interval]);

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + count) % count);

  if (count === 0) return null;

  return (
    <Box
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      sx={{ position: 'relative' }}
    >
      <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: height }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.4 }}
          >
            {slides[index]}
          </motion.div>
        </AnimatePresence>
      </Box>

      {count > 1 && (
        <>
          <IconButton
            onClick={() => go(-1)}
            aria-label="Previous"
            sx={{
              position: 'absolute',
              top: '50%',
              left: 4,
              transform: 'translateY(-50%)',
              bgcolor: 'background.paper',
              boxShadow: 2,
              '&:hover': { bgcolor: 'background.paper' },
            }}
            size="small"
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            onClick={() => go(1)}
            aria-label="Next"
            sx={{
              position: 'absolute',
              top: '50%',
              right: 4,
              transform: 'translateY(-50%)',
              bgcolor: 'background.paper',
              boxShadow: 2,
              '&:hover': { bgcolor: 'background.paper' },
            }}
            size="small"
          >
            <ChevronRight />
          </IconButton>

          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
            {slides.map((_, i) => (
              <Box
                key={i}
                onClick={() => setIndex(i)}
                sx={{
                  width: i === index ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  cursor: 'pointer',
                  bgcolor: i === index ? 'primary.main' : 'action.disabled',
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
