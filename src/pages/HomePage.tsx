import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import {
  AccountBalance,
  AccountTree,
  ArrowForward,
  ArrowOutward,
  Assignment,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Description,
  FactCheck,
  Gavel,
  HowToReg,
  Login,
  Payments,
  Pause,
  PlayArrow,
  ReceiptLong,
  Rule,
  Security,
  Speed,
  Store,
  VerifiedUser,
  Visibility,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { useAuth } from '@/lib/useAuth';

// Brand palette: use Navy Blue as the single primary brand colour.
const BRAND_PRIMARY = '#000080';
const BRAND_PRIMARY_HOVER = '#000066';

const MODULE_AUTOPLAY_INTERVAL_MS = 3000;

const STATS = [
  {
    icon: <VerifiedUser />,
    value: 'GST-verified',
    label: 'Vendor onboarding from the GST network',
  },
  {
    icon: <Rule />,
    value: 'Rule-driven',
    label: 'Approval levels, thresholds and deductions',
  },
  {
    icon: <Visibility />,
    value: 'End-to-end',
    label: 'Visibility across every approval stage',
  },
  {
    icon: <Security />,
    value: 'Append-only',
    label: 'An audit record for every action',
  },
];

const MODULES = [
  {
    icon: <Store />,
    number: '01',
    eyebrow: 'START WITH CONFIDENCE',
    title: 'Vendor onboarding',
    body: 'A guided registration journey with email OTP, GST-network verification and officer review. Vendors can also raise bank-detail change requests through a controlled process.',
    points: ['Email OTP and GST fetch', 'Officer verification', 'Bank-detail change requests'],
  },
  {
    icon: <Description />,
    number: '02',
    eyebrow: 'FORMALISE THE ENGAGEMENT',
    title: 'Contracts',
    body: 'Create and review government-format contracts with parties, scope, cost, payment terms, legal clauses and supporting signed documents.',
    points: ['Structured contract details', 'Signed file attachments', 'Amendment history'],
  },
  {
    icon: <Assignment />,
    number: '03',
    eyebrow: 'AUTHORISE THE WORK',
    title: 'Purchase Orders / Work Orders',
    body: 'Raise orders against approved contracts, with deliverables, statutory-deduction terms and contract references governed by configured rules.',
    points: ['Linked to approved contracts', 'Deliverables and tax terms', 'Approval-ready records'],
  },
  {
    icon: <ReceiptLong />,
    number: '04',
    eyebrow: 'SUBMIT AND CERTIFY',
    title: 'Invoices',
    body: 'Vendors bill against published purchase orders or work orders. Technical certification and finance settlement calculate applicable deductions and capture service-level compliance.',
    points: ['Technical and finance review', 'Applicable deductions', 'SLA compliance capture'],
  },
  {
    icon: <FactCheck />,
    number: '05',
    eyebrow: 'MOVE WITH ACCOUNTABILITY',
    title: 'Approvals',
    body: 'A personal inbox helps each officer approve, reject or return assigned items through configured levels, with department-scoped routing and shared role queues.',
    points: ['Department-scoped routing', 'Shared role queues', 'Named next approver'],
  },
  {
    icon: <Payments />,
    number: '06',
    eyebrow: 'CLOSE THE LOOP',
    title: 'Payments',
    body: 'Record the payment mode, reference and date, then mark the invoice as paid. Each disbursement remains linked to its certified invoice.',
    points: ['NEFT / RTGS / Cheque / DD / PFMS', 'Payment recording', 'Auditable disbursements'],
  },
];

const FEATURES = [
  {
    icon: <VerifiedUser />,
    number: '01',
    title: 'GST-verified onboarding',
    body: 'Vendors register using an email OTP, and their particulars are fetched from the GST network to reduce manual entry and mismatched records.',
  },
  {
    icon: <Rule />,
    number: '02',
    title: 'Configurable approvals',
    body: 'A rule engine determines approval depth, thresholds and deductions from document values. Administrators can update rules without redeployment.',
  },
  {
    icon: <AccountTree />,
    number: '03',
    title: 'Transparent workflow',
    body: 'Each contract, purchase order, work order and invoice shows its current stage, pending officer and recorded decisions.',
  },
  {
    icon: <Gavel />,
    number: '04',
    title: 'Accountable settlement',
    body: 'Certification, service-level compliance decisions and disbursement leave an append-only record associated with the responsible officer.',
  },
];

const AUDIENCES = [
  {
    icon: <Store />,
    eyebrow: 'FOR SUPPLIERS',
    title: 'Vendors',
    body: 'Register, complete verification, track purchase orders or work orders, raise invoices and check their status.',
    action: 'Start vendor registration',
    to: '/register',
  },
  {
    icon: <FactCheck />,
    eyebrow: 'FOR DEPARTMENTS',
    title: 'Government officials',
    body: 'Review assigned items, approve, reject or return requests, and follow the complete approval trail.',
    action: 'Sign in to your workspace',
    to: '/login',
  },
  {
    icon: <Speed />,
    eyebrow: 'FOR PLATFORM TEAMS',
    title: 'Administrators',
    body: 'Configure business rules and approval routes, manage access and review the audit trail.',
    action: 'Access administration',
    to: '/login',
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  light = false,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  light?: boolean;
  centered?: boolean;
}) {
  return (
    <Stack
      spacing={1.25}
      sx={{
        mb: { xs: 3.5, md: 5 },
        maxWidth: centered ? 760 : 720,
        mx: centered ? 'auto' : 0,
        textAlign: centered ? 'center' : 'left',
        alignItems: centered ? 'center' : 'flex-start',
      }}
    >
      <Typography
        variant="overline"
        sx={{
          color: light ? '#d6e7fa' : '#000080',
          fontWeight: 800,
          letterSpacing: 1.5,
        }}
      >
        {eyebrow}
      </Typography>
      <Typography
        component="h2"
        variant="h3"
        sx={{
          color: light ? '#fff' : '#102a4c',
          fontWeight: 850,
          letterSpacing: '-0.035em',
          fontSize: { xs: '1.85rem', sm: '2.25rem', md: '2.7rem' },
          lineHeight: 1.12,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          color: light ? 'rgba(255,255,255,0.76)' : 'text.secondary',
          lineHeight: 1.8,
          fontSize: { xs: '0.98rem', md: '1.05rem' },
        }}
      >
        {description}
      </Typography>
    </Stack>
  );
}

function IconTile({
  children,
  size = 52,
  tone = 'blue',
}: {
  children: ReactNode;
  size?: number;
  tone?: 'blue' | 'white';
}) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        flex: '0 0 auto',
        display: 'grid',
        placeItems: 'center',
        borderRadius: size > 48 ? 3 : 2.5,
        color: tone === 'white' ? '#000080' : '#fff',
        background:
          tone === 'white'
            ? '#fff'
            : 'linear-gradient(145deg, #000080 0%, #000066 100%)',
        boxShadow:
          tone === 'white' ? '0 8px 22px rgba(0, 0, 80, 0.12)' : '0 9px 22px rgba(0, 0, 80, 0.20)',
        '& .MuiSvgIcon-root': { fontSize: size * 0.48 },
      }}
    >
      {children}
    </Box>
  );
}

function HoverCard({ children }: { children: ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 3.5,
        borderColor: '#dfe8f2',
        bgcolor: '#fff',
        transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
        '&:hover': {
          transform: 'translateY(-6px)',
          borderColor: '#9fb8d6',
          boxShadow: '0 18px 42px rgba(0, 0, 80, 0.12)',
        },
        '&:focus-within': {
          borderColor: '#315f98',
          boxShadow: '0 0 0 3px rgba(0, 0, 128, 0.13)',
        },
      }}
    >
      {children}
    </Paper>
  );
}

const JOURNEY_TICK_MS = 1100;
const JOURNEY_HOLD_MS = 3200;
const APPROVED_GREEN = '#16a34a';

type JourneyStage = {
  title: string;
  icon: ReactNode;
  color: string;
  tint: string;
  doneLabel: string;
  actors: { role: string; action: string; done: string }[];
};

// Stages and stakeholders follow the VPS BRD process flow (sections 6 and 7).
const JOURNEY: JourneyStage[] = [
  {
    title: 'Vendor registration',
    icon: <HowToReg />,
    color: '#1d4ed8',
    tint: '#eaf1ff',
    doneLabel: 'Activated',
    actors: [
      { role: 'Vendor', action: 'Registers with email OTP and GSTIN', done: 'Submitted' },
      { role: 'Verification Officer', action: 'Verifies and activates the vendor', done: 'Verified' },
    ],
  },
  {
    title: 'Contract creation',
    icon: <Description />,
    color: '#0f766e',
    tint: '#e6f6f4',
    doneLabel: 'Created',
    actors: [
      { role: 'Contract Officer', action: 'Captures value, period, SLA and penalty', done: 'Created' },
    ],
  },
  {
    title: 'Contract approval',
    icon: <Gavel />,
    color: '#7c3aed',
    tint: '#f3edff',
    doneLabel: 'Approved',
    actors: [
      { role: 'Approver · Level 1', action: 'Scrutinises the contract', done: 'Approved' },
      { role: 'Approver · Level 2', action: 'Gives final approval', done: 'Approved' },
    ],
  },
  {
    title: 'Work order creation',
    icon: <Assignment />,
    color: '#c2410c',
    tint: '#fff1e8',
    doneLabel: 'Created',
    actors: [
      { role: 'Purchase / Contract Officer', action: 'Raises the work order against the contract', done: 'Created' },
    ],
  },
  {
    title: 'Work order approval',
    icon: <FactCheck />,
    color: '#be185d',
    tint: '#fdecf4',
    doneLabel: 'Released',
    actors: [
      { role: 'Approver', action: 'Approves along the configured route', done: 'Approved' },
      { role: 'Vendor', action: 'Receives the released work order', done: 'Received' },
    ],
  },
  {
    title: 'Invoice submission',
    icon: <ReceiptLong />,
    color: '#0e7490',
    tint: '#e5f6fa',
    doneLabel: 'Submitted',
    actors: [
      { role: 'Vendor', action: 'Submits invoice, line items and bills', done: 'Submitted' },
    ],
  },
  {
    title: 'Review, compliance & sanction',
    icon: <VerifiedUser />,
    color: '#b45309',
    tint: '#fff6e0',
    doneLabel: 'Sanctioned',
    actors: [
      { role: 'Technical Officer', action: 'Certifies work and SLA compliance', done: 'Certified' },
      { role: 'Finance Officer', action: 'Applies deductions, net payable', done: 'Settled' },
      { role: 'Competent Authority', action: 'Sanctions the invoice', done: 'Sanctioned' },
    ],
  },
  {
    title: 'Payment',
    icon: <Payments />,
    color: BRAND_PRIMARY,
    tint: '#ebebff',
    doneLabel: 'Paid',
    actors: [
      { role: 'Payment / Accounts Officer', action: 'Initiates the payment instruction', done: 'Initiated' },
      { role: 'PFMS / Bank', action: 'Credits the vendor account', done: 'Credited' },
    ],
  },
];

// Index of each stage's first actor in the flat run of approvals.
const JOURNEY_OFFSETS = JOURNEY.reduce<number[]>(
  (offsets, _stage, i) => [...offsets, i === 0 ? 0 : offsets[i - 1] + JOURNEY[i - 1].actors.length],
  [],
);
const JOURNEY_TOTAL = JOURNEY.reduce((sum, stage) => sum + stage.actors.length, 0);

/**
 * Animated payment journey: each stakeholder's action is ticked green in turn,
 * stage by stage, while the section is on screen. Reduced motion shows the
 * completed journey.
 */
function PaymentJourney() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  // Number of stakeholder actions completed so far (0..JOURNEY_TOTAL).
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.2,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduceMotion || !visible) return;
    const timer = window.setTimeout(
      () => setCompleted((c) => (c >= JOURNEY_TOTAL ? 0 : c + 1)),
      completed >= JOURNEY_TOTAL ? JOURNEY_HOLD_MS : completed === 0 ? 600 : JOURNEY_TICK_MS,
    );
    return () => window.clearTimeout(timer);
  }, [completed, visible, reduceMotion]);

  const done = reduceMotion ? JOURNEY_TOTAL : completed;
  const finished = done >= JOURNEY_TOTAL;
  const activeStage = finished
    ? -1
    : JOURNEY.findIndex((stage, i) => done < JOURNEY_OFFSETS[i] + stage.actors.length);

  return (
    <Box
      ref={rootRef}
      sx={{
        position: 'relative',
        mt: { xs: 0, md: 1.5 },
        '@keyframes journeyPulse': {
          '0%': { boxShadow: '0 0 0 0 var(--pulse)' },
          '100%': { boxShadow: '0 0 0 9px transparent' },
        },
        '@keyframes journeyTickIn': {
          '0%': { transform: 'scale(0.3)', opacity: 0 },
          '70%': { transform: 'scale(1.18)', opacity: 1 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        '@keyframes journeyFadeUp': {
          from: { transform: 'translateY(4px)', opacity: 0 },
          to: { transform: 'none', opacity: 1 },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& *': { animation: 'none !important', transition: 'none !important' },
        },
      }}
    >
      {/* Progress track: one marker per stage, filled as each stage completes. */}
      <Box sx={{ position: 'relative', mx: { xs: 1, md: 4 }, mb: { xs: 3.5, md: 4.5 }, height: 40 }}>
        <Box
          sx={{
            position: 'absolute',
            left: 20,
            right: 20,
            top: 18,
            height: 4,
            borderRadius: 2,
            bgcolor: '#dbe5f3',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${(done / JOURNEY_TOTAL) * 100}%`,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${JOURNEY.map((s) => s.color).join(', ')})`,
              backgroundSize: `${(JOURNEY_TOTAL / Math.max(done, 1)) * 100}% 100%`,
              transition: 'width 700ms cubic-bezier(.4,0,.2,1)',
            }}
          />
        </Box>
        <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative' }}>
          {JOURNEY.map((stage, i) => {
            const stageDone = done >= JOURNEY_OFFSETS[i] + stage.actors.length;
            const active = i === activeStage;
            return (
              <Box
                key={stage.title}
                title={stage.title}
                sx={{
                  width: 40,
                  height: 40,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  fontSize: 13,
                  fontWeight: 850,
                  color: stageDone || active ? '#fff' : '#6b7f9c',
                  bgcolor: stageDone ? APPROVED_GREEN : active ? stage.color : '#fff',
                  border: '2px solid',
                  borderColor: stageDone ? APPROVED_GREEN : active ? stage.color : '#cfdbeb',
                  transition: 'background-color 300ms ease, border-color 300ms ease, transform 300ms ease',
                  transform: active ? 'scale(1.12)' : 'none',
                  '--pulse': `${stage.color}66`,
                  animation: active ? 'journeyPulse 1.3s ease-out infinite' : 'none',
                  '& svg': { fontSize: 22, animation: 'journeyTickIn 420ms ease-out' },
                }}
              >
                {stageDone ? <Check /> : i + 1}
              </Box>
            );
          })}
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
          gap: { xs: 2, sm: 2.5, md: 3 },
        }}
      >
        {JOURNEY.map((stage, i) => {
          const start = JOURNEY_OFFSETS[i];
          const stageDone = done >= start + stage.actors.length;
          const active = i === activeStage;
          return (
            <Paper
              key={stage.title}
              variant="outlined"
              sx={{
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                p: { xs: 2.25, md: 2.5 },
                borderRadius: 3.5,
                bgcolor: '#fff',
                borderColor: active ? stage.color : stageDone ? '#bfe5cc' : '#dfe8f2',
                boxShadow: active ? `0 16px 38px ${stage.color}2e` : 'none',
                transform: active ? 'translateY(-6px)' : 'none',
                transition: 'transform 320ms ease, box-shadow 320ms ease, border-color 320ms ease',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  bgcolor: stage.color,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  right: -56,
                  bottom: -64,
                  bgcolor: stage.tint,
                  pointerEvents: 'none',
                },
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.75 }}>
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 2.5,
                    color: active ? '#fff' : stage.color,
                    bgcolor: active ? stage.color : stage.tint,
                    transition: 'background-color 300ms ease, color 300ms ease',
                    '& svg': { fontSize: 24 },
                  }}
                >
                  {stage.icon}
                </Box>
                <Chip
                  size="small"
                  icon={stageDone ? <CheckCircle /> : undefined}
                  label={stageDone ? stage.doneLabel : active ? 'In progress' : `Step ${i + 1} / ${JOURNEY.length}`}
                  sx={{
                    fontWeight: 800,
                    fontSize: 11.5,
                    color: stageDone ? APPROVED_GREEN : active ? stage.color : '#536b8c',
                    bgcolor: stageDone ? '#e7f7ed' : active ? stage.tint : '#f1f5fb',
                    '& .MuiChip-icon': { color: APPROVED_GREEN, fontSize: 16 },
                  }}
                />
              </Stack>

              <Typography
                variant="subtitle1"
                sx={{ color: '#102a4c', fontWeight: 850, letterSpacing: '-0.01em', mb: 1.5, lineHeight: 1.3 }}
              >
                {stage.title}
              </Typography>

              <Stack spacing={1.25} sx={{ position: 'relative', zIndex: 1 }}>
                {stage.actors.map((actor, a) => {
                  const actorDone = done > start + a;
                  const actorActive = done === start + a && !reduceMotion;
                  return (
                    <Stack key={actor.role} direction="row" spacing={1.25} alignItems="flex-start">
                      <Box
                        sx={{
                          flex: '0 0 auto',
                          width: 24,
                          height: 24,
                          mt: 0.25,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: actorDone ? APPROVED_GREEN : actorActive ? stage.color : '#d3deec',
                          bgcolor: actorDone ? APPROVED_GREEN : '#fff',
                          color: '#fff',
                          '--pulse': `${stage.color}55`,
                          animation: actorActive ? 'journeyPulse 1.1s ease-out infinite' : 'none',
                          transition: 'background-color 250ms ease, border-color 250ms ease',
                        }}
                      >
                        {actorDone ? (
                          <Check sx={{ fontSize: 16, animation: 'journeyTickIn 420ms ease-out' }} />
                        ) : (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: actorActive ? stage.color : '#d3deec',
                            }}
                          />
                        )}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#1b3355', lineHeight: 1.35 }}>
                            {actor.role}
                          </Typography>
                          {actorDone && (
                            <Typography
                              component="span"
                              sx={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: APPROVED_GREEN,
                                animation: 'journeyFadeUp 300ms ease-out',
                              }}
                            >
                              {actor.done}
                            </Typography>
                          )}
                        </Stack>
                        <Typography variant="caption" sx={{ display: 'block', color: '#5b6f8c', lineHeight: 1.45 }}>
                          {actor.action}
                        </Typography>
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * Single-slide carousel with autoplay, manual controls, keyboard support,
 * swipe gestures and reduced-motion support.
 */
function ModulesCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  const touchStartX = useRef<number | null>(null);
  const activeModule = MODULES[activeIndex];

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.('change', updatePreference);
    return () => mediaQuery.removeEventListener?.('change', updatePreference);
  }, []);

  useEffect(() => {
    const updateVisibility = () => {
      setIsDocumentVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', updateVisibility);
    updateVisibility();
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (
      isPaused
      || isHovered
      || isFocusWithin
      || reducedMotion
      || !isDocumentVisible
      || MODULES.length < 2
    ) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % MODULES.length);
    }, MODULE_AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [activeIndex, isPaused, isHovered, isFocusWithin, reducedMotion, isDocumentVisible]);

  const previous = () =>
    setActiveIndex((current) => (current - 1 + MODULES.length) % MODULES.length);
  const next = () =>
    setActiveIndex((current) => (current + 1) % MODULES.length);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    if (Math.abs(delta) > 48) {
      if (delta < 0) next();
      else previous();
    }
    touchStartX.current = null;
  };

  return (
    <Box
      component="section"
      id="modules"
      aria-labelledby="modules-heading"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsFocusWithin(false);
        }
      }}
      sx={{
        py: { xs: 7, md: 11 },
        scrollMarginTop: 88,
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%)',
        borderTop: '1px solid #d6e3f1',
        borderBottom: '1px solid #d6e3f1',
        '&::before': {
          content: '""',
          position: 'absolute',
          width: 260,
          height: 260,
          borderRadius: '50%',
          border: '1px solid rgba(0, 0, 128, 0.09)',
          right: { xs: -150, md: -80 },
          top: 35,
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative' }}>
        <SectionHeading
          eyebrow="One platform, every stage"
          title="A connected journey. One clear view."
          description="From the first vendor registration to the final disbursement, each stage is connected through a structured and traceable workflow."
          centered
        />

        <Box
          role="region"
          aria-roledescription="carousel"
          aria-label="Platform service modules"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') previous();
            if (event.key === 'ArrowRight') next();
          }}
          tabIndex={0}
          sx={{
            maxWidth: 980,
            mx: 'auto',
            outline: 'none',
            '&:focus-visible': {
              outline: '3px solid #000080',
              outlineOffset: 6,
              borderRadius: 4,
            },
          }}
        >
          <Paper
            key={activeModule.title}
            elevation={0}
            aria-live={isPaused || isHovered || isFocusWithin ? 'polite' : 'off'}
            sx={{
              minHeight: { xs: 470, sm: 365, md: 350 },
              p: { xs: 2.5, sm: 4, md: 5 },
              borderRadius: { xs: 3, md: 4 },
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid rgba(190, 190, 225, 0.85)',
              background:
                'linear-gradient(115deg, #ffffff 0%, #ffffff 62%, #eef5ff 100%)',
              boxShadow: '0 24px 60px rgba(0, 0, 80, 0.12)',
              animation: reducedMotion ? 'none' : 'moduleReveal 420ms ease both',
              '@keyframes moduleReveal': {
                from: { opacity: 0.55, transform: 'translateY(12px)' },
                to: { opacity: 1, transform: 'translateY(0)' },
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: 7,
                height: '100%',
                background: 'linear-gradient(180deg, #1d5fa8, #000080)',
              },
            }}
          >
            <Grid container spacing={{ xs: 3, md: 4 }} alignItems="stretch">
              <Grid size={{ xs: 12, md: 6.5 }}>
                <Stack spacing={2.25} sx={{ height: '100%', justifyContent: 'center' }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <IconTile size={58}>{activeModule.icon}</IconTile>
                    <Box>
                      <Typography variant="overline" sx={{ color: BRAND_PRIMARY }} fontWeight={850} letterSpacing={1.1}>
                        {activeModule.eyebrow}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ display: 'block' }}>
                        STAGE {activeModule.number} OF 06
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    component="h3"
                    sx={{
                      color: '#102a4c',
                      fontWeight: 900,
                      letterSpacing: '-0.035em',
                      fontSize: { xs: '1.65rem', sm: '2rem', md: '2.3rem' },
                      lineHeight: 1.14,
                    }}
                  >
                    {activeModule.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.85, fontSize: { xs: '0.96rem', md: '1.02rem' }, maxWidth: 620 }}>
                    {activeModule.body}
                  </Typography>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 5.5 }}>
                <Box
                  sx={{
                    height: '100%',
                    minHeight: { xs: 190, md: 235 },
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 3,
                    bgcolor: '#eef5ff',
                    border: '1px solid #d6e3f1',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="overline" sx={{ color: BRAND_PRIMARY, fontWeight: 900, letterSpacing: 1.2, mb: 2 }}>
                    KEY CAPABILITIES
                  </Typography>
                  <Stack spacing={2}>
                    {activeModule.points.map((point) => (
                      <Stack key={point} direction="row" spacing={1.25} alignItems="center">
                        <Box sx={{ width: 30, height: 30, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 2, color: BRAND_PRIMARY, bgcolor: '#e8f2ff' }}>
                          <CheckCircle sx={{ fontSize: 18 }} aria-hidden="true" />
                        </Box>
                        <Typography variant="body2" sx={{ color: '#435873', fontWeight: 700, lineHeight: 1.5 }}>
                          {point}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Divider sx={{ my: 2.25, borderColor: '#d6e3f1' }} />
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      PROCUREMENT TO PAYMENT
                    </Typography>
                    <Typography variant="caption" sx={{ color: BRAND_PRIMARY }} fontWeight={900}>
                      {String(activeIndex + 1).padStart(2, '0')} / {String(MODULES.length).padStart(2, '0')}
                    </Typography>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => setIsPaused((current) => !current)}
              aria-label={isPaused ? 'Resume automatic carousel rotation' : 'Pause automatic carousel rotation'}
              sx={{
                width: 42,
                height: 42,
                minWidth: 42,
                p: 0,
                borderRadius: '50%',
                bgcolor: '#fff',
                borderColor: '#c5d7eb',
                color: BRAND_PRIMARY,
                '&:hover': { bgcolor: '#eaf2ff', borderColor: '#4776a8' },
              }}
            >
              {isPaused ? <PlayArrow /> : <Pause />}
            </Button>
            <Button
              variant="outlined"
              onClick={previous}
              aria-label="Previous module"
              sx={{
                width: 46,
                height: 46,
                minWidth: 46,
                p: 0,
                borderRadius: '50%',
                bgcolor: '#fff',
                borderColor: '#c5d7eb',
                color: BRAND_PRIMARY,
                '&:hover': { bgcolor: '#eaf2ff', borderColor: '#4776a8' },
              }}
            >
              <ChevronLeft />
            </Button>
            <Stack direction="row" alignItems="center" spacing={1}>
              {MODULES.map((module, index) => (
                <Box
                  key={module.number}
                  component="button"
                  type="button"
                  aria-label={`Show ${module.title}`}
                  aria-current={activeIndex === index ? 'true' : undefined}
                  onClick={() => setActiveIndex(index)}
                  sx={{
                    border: 0,
                    cursor: 'pointer',
                    width: activeIndex === index ? 30 : 8,
                    height: 8,
                    p: 0,
                    borderRadius: 10,
                    bgcolor: activeIndex === index ? '#000080' : '#b7c8df',
                    transition: 'all 200ms ease',
                    '&:hover': { bgcolor: BRAND_PRIMARY },
                    '&:focus-visible': {
                      outline: '3px solid #4776a8',
                      outlineOffset: 3,
                    },
                  }}
                />
              ))}
            </Stack>
            <Button
              variant="contained"
              onClick={next}
              aria-label="Next module"
              sx={{
                width: 46,
                height: 46,
                minWidth: 46,
                p: 0,
                borderRadius: '50%',
                boxShadow: '0 7px 16px rgba(0,0,80,0.2)',
              }}
            >
              <ChevronRight />
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1.5 }}>
            {reducedMotion
              ? 'Automatic motion is reduced by your device setting · Use the controls to explore each stage'
              : isPaused
                ? 'Automatic rotation paused · Select play to resume'
                : 'Auto-advances every 3 seconds · Hover or focus to pause · Swipe on mobile'}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

function HeroWorkflowPreview() {
  const items = [
    { icon: <HowToReg />, label: 'Vendor registration', detail: 'Email OTP and GST verification', status: 'STAGE 01' },
    { icon: <Description />, label: 'Contract & work order', detail: 'Terms, scope and deliverables', status: 'STAGE 02' },
    { icon: <FactCheck />, label: 'Review & certification', detail: 'Department and finance review', status: 'STAGE 03' },
    { icon: <Payments />, label: 'Invoice payment', detail: 'Payment reference and settlement', status: 'STAGE 04' },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        maxWidth: 470,
        mx: 'auto',
        p: { xs: 2.25, sm: 3 },
        borderRadius: 4,
        color: '#fff',
        background: 'linear-gradient(145deg, rgba(0,0,80,0.50), rgba(0,0,42,0.36))',
        border: '1px solid rgba(220,236,255,0.28)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 26px 70px rgba(0, 8, 30, 0.38)',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="overline" sx={{ color: '#d6e7fa', fontWeight: 800, letterSpacing: 1.3 }}>
            ILLUSTRATIVE WORKFLOW
          </Typography>
          <Typography variant="h6" fontWeight={800}>
            Procurement to payment
          </Typography>
        </Box>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(255,255,255,0.13)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          <AccountBalance />
        </Box>
      </Stack>

      <Stack spacing={0}>
        {items.map((item, index) => (
          <Stack key={item.label} direction="row" spacing={1.5} sx={{ position: 'relative', pb: index === items.length - 1 ? 0 : 2.25 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  zIndex: 1,
                  borderRadius: 2.25,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(190,190,235,0.32)',
                }}
              >
                {item.icon}
              </Box>
              {index !== items.length - 1 && (
                <Box sx={{ width: 1, flex: 1, minHeight: 20, bgcolor: 'rgba(186,213,243,0.32)', mt: 0.5 }} />
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, pt: 0.15 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Typography variant="body2" fontWeight={800}>
                  {item.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#d6e7fa',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    px: 1,
                    py: 0.35,
                    borderRadius: 5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.status}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.66)', mt: 0.3 }}>
                {item.detail}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.16)', my: 2.25 }} />
      <Stack direction="row" alignItems="center" spacing={1}>
        <Security sx={{ color: '#d6e7fa', fontSize: 18 }} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.76)' }}>
          Role-based access · Configurable approvals · Traceable actions
        </Typography>
      </Stack>
    </Paper>
  );
}

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    return typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.('change', updatePreference);
    return () => mediaQuery.removeEventListener?.('change', updatePreference);
  }, []);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#fff',
        overflowX: 'clip',
        '& a:focus-visible, & button:focus-visible': {
          outline: '3px solid #4776a8',
          outlineOffset: 3,
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& *, & *::before, & *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            scrollBehavior: 'auto !important',
            transitionDuration: '0.01ms !important',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          bgcolor: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #e6edf5',
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={{ xs: 1, md: 2.5, lg: 3.5 }}
            sx={{ minHeight: { xs: 70, md: 84 }, width: '100%' }}
          >
            <Stack
              component={RouterLink}
              to="/"
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ minWidth: 0, color: '#102a4c', textDecoration: 'none' }}
              aria-label="Vendor Payment System home"
            >
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  flex: '0 0 auto',
                  borderRadius: 2.5,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  background: 'linear-gradient(145deg, #000080, #000066)',
                  boxShadow: '0 7px 16px rgba(0, 0, 80, 0.20)',
                  '& svg': { fontSize: 26 },
                }}
              >
                <AccountBalance />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ display: 'block', fontWeight: 850, lineHeight: 1.2, fontSize: { xs: '0.9rem', sm: '1.02rem' } }}>
                  Vendor Payment System
                </Typography>
                <Typography sx={{ display: 'block', color: '#62748a', lineHeight: 1.35, fontSize: '0.72rem' }}>
                  National eGovernance Division
                </Typography>
              </Box>
            </Stack>

            {/* Primary section navigation stays visually separate from account actions. */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="center"
              spacing={{ md: 1.25, lg: 2.25 }}
              sx={{
                display: { xs: 'none', lg: 'flex' },
                flex: '1 1 auto',
                minWidth: 0,
                mx: { md: 1.5, lg: 3.5 },
              }}
            >
              {[
                { label: 'Home', href: '#home' },
                { label: 'Features', href: '#features' },
                { label: 'How VPS Works', href: '#process' },
                { label: 'Who VPS Is For', href: '#audiences' },
              ].map((item) => (
                  <Button
                    key={item.href}
                    component="a"
                    href={item.href}
                    color="inherit"
                    sx={{
                      position: 'relative',
                      minHeight: 46,
                      minWidth: 'auto',
                      px: { md: 0.85, lg: 1.1 },
                      borderRadius: 1,
                      color: '#40546c',
                      fontWeight: 650,
                      bgcolor: 'transparent',
                      transition: 'color 180ms ease',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        left: 10,
                        right: 10,
                        bottom: 5,
                        height: 2,
                        borderRadius: 99,
                        bgcolor: BRAND_PRIMARY,
                        transform: 'scaleX(0)',
                        transformOrigin: 'left center',
                        transition: 'transform 200ms ease',
                      },
                      '&:hover': {
                        color: BRAND_PRIMARY,
                        bgcolor: 'transparent',
                      },
                      '&:hover::after, &:focus-visible::after': {
                        transform: 'scaleX(1)',
                      },
                    }}
                  >
                    {item.label}
                  </Button>
              ))}
            </Stack>

            {/* Account actions: intentionally separated from the section links. */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={{ xs: 0.75, sm: 1.5, lg: 2 }}
              sx={{ flex: '0 0 auto', ml: { xs: 0, md: 1 } }}
            >
              <Divider
                orientation="vertical"
                flexItem
                sx={{
                  display: { xs: 'none', md: 'block' },
                  height: 25,
                  alignSelf: 'center',
                  borderColor: '#dce5ef',
                  mr: { md: 1, lg: 1.5 },
                }}
              />
              <Button
                component={RouterLink}
                to="/register"
                variant="text"
                disableRipple
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  minHeight: 44,
                  minWidth: 'auto',
                  px: { sm: 0.75, lg: 1 },
                  borderRadius: 1,
                  color: '#40546c',
                  fontWeight: 750,
                  whiteSpace: 'nowrap',
                  bgcolor: 'transparent',
                  '&:hover': {
                    color: '#40546c',
                    bgcolor: 'transparent',
                    boxShadow: 'none',
                  },
                }}
              >
                Vendor registration
              </Button>
              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                startIcon={<Login />}
                sx={{
                  minHeight: 44,
                  px: { xs: 1.75, sm: 2.5 },
                  borderRadius: 2.5,
                  fontWeight: 750,
                  boxShadow: '0 7px 16px rgba(0, 0, 80, 0.18)',
                }}
              >
                Login
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <main>
        {/* Hero */}
        <Box
          aria-hidden="true"
          sx={{
            height: 3,
            background: 'linear-gradient(90deg, #FF9933 0%, #FF9933 33.33%, #ffffff 33.33%, #ffffff 66.66%, #138808 66.66%, #138808 100%)',
          }}
        />
        <Box
          component="section"
          id="home"
          aria-labelledby="home-hero-title"
          sx={{
            position: 'relative',
            overflow: 'hidden',
            color: '#fff',
            minHeight: { md: 650 },
            bgcolor: BRAND_PRIMARY,
            // Static poster remains visible while the video loads and when motion is reduced.
            backgroundImage: 'url("/videos/digital-earth-poster.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center right',
          }}
        >
          {!prefersReducedMotion && (
            <Box
              component="video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/videos/digital-earth-poster.jpg"
              aria-hidden="true"
              disablePictureInPicture
              tabIndex={-1}
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: { xs: '58% center', md: 'center right' },
                pointerEvents: 'none',
                // Keep the original cool white-blue highlights of the Earth animation.
                filter: 'brightness(1.34) saturate(0.92) contrast(1.04)',
              }}
            >
              <source src="/videos/digital-earth.mp4" type="video/mp4" />
            </Box>
          )}
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              background: {
                // Keep the text side darker, then progressively reveal the Earth toward the right.
                xs: 'linear-gradient(180deg, rgba(0,0,80,0.88) 0%, rgba(0,0,80,0.78) 48%, rgba(0,0,65,0.60) 100%)',
                md: 'linear-gradient(90deg, rgba(0,0,80,0.88) 0%, rgba(0,0,80,0.76) 30%, rgba(0,0,80,0.44) 58%, rgba(0,0,45,0.14) 100%)',
              },
            }}
          />
          <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2 }}>
            <Grid
              container
              spacing={{ xs: 5, md: 7 }}
              alignItems="center"
              sx={{ py: { xs: 7, sm: 9, md: 12 } }}
            >
              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={{ xs: 2.25, md: 3 }} alignItems="flex-start">
                  <Chip
                    icon={<VerifiedUser sx={{ color: '#d8e9ff !important' }} />}
                    label="Secure. Transparent. Accountable."
                    sx={{
                      color: '#fff',
                      bgcolor: 'rgba(255,255,255,0.10)',
                      border: '1px solid rgba(220,236,255,0.30)',
                      backdropFilter: 'blur(8px)',
                      fontWeight: 750,
                      '& .MuiChip-label': { px: 1.2 },
                    }}
                  />
                  <Typography
                    id="home-hero-title"
                    component="h1"
                    sx={{
                      fontSize: {
                        xs: '2.3rem',
                        sm: '2.9rem',
                        md: '2.85rem',
                        lg: '3.6rem',
                        xl: '3.85rem',
                      },
                      lineHeight: { xs: 1.1, md: 1.08 },
                      letterSpacing: '-0.045em',
                      fontWeight: 900,
                      maxWidth: '100%',
                      textWrap: 'balance',
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        display: 'block',
                        whiteSpace: { md: 'nowrap' },
                      }}
                    >
                      Vendor Payments for
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        display: 'block',
                        whiteSpace: { md: 'nowrap' },
                        color: '#cfe3ff',
                        mt: 0.35,
                      }}
                    >
                      Stronger Governance.
                    </Box>
                  </Typography>
                  <Typography
                    sx={{
                      color: 'rgba(241,247,255,0.82)',
                      fontSize: { xs: '1rem', sm: '1.1rem' },
                      lineHeight: 1.85,
                      maxWidth: 660,
                    }}
                  >
                    One connected platform for government organisations and their vendors —
                    bringing registration, contracts, orders, approvals, invoices and payments
                    into a structured, auditable journey.
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{ pt: 0.75, width: { xs: '100%', sm: 'auto' } }}
                  >
                    <Button
                      component={RouterLink}
                      to="/register"
                      variant="contained"
                      size="large"
                      endIcon={<ArrowForward />}
                      sx={{
                        minHeight: 54,
                        px: 3,
                        borderRadius: 2.5,
                        color: BRAND_PRIMARY,
                        bgcolor: '#fff',
                        fontWeight: 850,
                        boxShadow: '0 12px 26px rgba(0, 0, 20, 0.28)',
                        '&:hover': { bgcolor: '#eaf2ff', transform: 'translateY(-2px)' },
                      }}
                    >
                      Register as a vendor
                    </Button>
                    <Button
                      component={RouterLink}
                      to="/login"
                      variant="outlined"
                      size="large"
                      startIcon={<Login />}
                      sx={{
                        minHeight: 54,
                        px: 3,
                        borderRadius: 2.5,
                        color: '#fff',
                        borderColor: 'rgba(235,245,255,0.62)',
                        fontWeight: 750,
                        '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.10)' },
                      }}
                    >
                      Official / vendor login
                    </Button>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ pt: 0.5 }}>
                    <Security sx={{ fontSize: 17, color: '#cfe3ff' }} />
                    <Typography variant="caption" sx={{ color: 'rgba(235,245,255,0.78)' }}>
                      Secure access for registered vendors and authorised officials
                    </Typography>
                  </Stack>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <HeroWorkflowPreview />
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Platform principles */}
        <Box
          component="section"
          aria-label="Platform principles"
          sx={{
            bgcolor: '#fff',
            borderBottom: '1px solid #e7edf5',
            py: { xs: 3, md: 3.5 },
          }}
        >
          <Container maxWidth="lg">
            <Grid container spacing={{ xs: 2.5, md: 2 }}>
              {STATS.map((stat, index) => (
                <Grid size={{ xs: 6, md: 3 }} key={stat.label}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 1, sm: 1.5 }}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    sx={{
                      height: '100%',
                      pl: { md: index === 0 ? 0 : 2.5 },
                      borderLeft: { md: index === 0 ? 0 : '1px solid #e6edf5' },
                    }}
                  >
                    <Box sx={{ color: BRAND_PRIMARY, '& svg': { fontSize: 25 } }}>{stat.icon}</Box>
                    <Box>
                      <Typography sx={{ color: '#102a4c', fontWeight: 850, lineHeight: 1.25 }}>
                        {stat.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5, mt: 0.25 }}>
                        {stat.label}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        <ModulesCarousel />

        {/* Capabilities */}
        <Box
          component="section"
          id="features"
          sx={{
            py: { xs: 7, md: 11 },
            scrollMarginTop: 88,
            background: 'linear-gradient(125deg, #000066 0%, #000080 56%, #000066 100%)',
          }}
        >
          <Container maxWidth="lg">
            <SectionHeading
              eyebrow="Built for trust and accountability"
              title="Designed for transparent payments."
              description="Practical capabilities help vendors and government teams move work forward while keeping decisions, responsibilities and records visible."
              light
              centered
            />
            <Grid container spacing={2.5}>
              {FEATURES.map((feature) => (
                <Grid size={{ xs: 12, sm: 6 }} key={feature.title}>
                  <HoverCard>
                    <Stack direction="row" spacing={2.25} sx={{ p: { xs: 2.5, md: 3.25 } }}>
                      <IconTile size={50}>{feature.icon}</IconTile>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                          <Typography variant="caption" sx={{ color: '#7a91aa', fontWeight: 850, letterSpacing: 1 }}>
                            {feature.number}
                          </Typography>
                          <Box sx={{ width: 22, height: 1, bgcolor: '#c9d9eb' }} />
                        </Stack>
                        <Typography variant="h6" sx={{ color: '#102a4c', fontWeight: 850, mb: 0.75 }}>
                          {feature.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                          {feature.body}
                        </Typography>
                      </Box>
                    </Stack>
                  </HoverCard>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Process */}
        <Box
          component="section"
          id="process"
          sx={{
            py: { xs: 7, md: 11 },
            scrollMarginTop: 88,
            bgcolor: '#f2f7ff',
            borderTop: '1px solid #d6e3f1',
            borderBottom: '1px solid #d6e3f1',
          }}
        >
          <Container maxWidth="lg">
            <SectionHeading
              eyebrow="The payment journey"
              title="Eight stages. Every approval on record."
              description="From vendor registration to payment, each stakeholder signs off in turn along the organisation's configured approval routes."
              centered
            />

            <PaymentJourney />
          </Container>
        </Box>

        {/* Audiences */}
        <Box
          component="section"
          id="audiences"
          sx={{ py: { xs: 7, md: 11 }, scrollMarginTop: 88, bgcolor: '#f5f9ff' }}
        >
          <Container maxWidth="lg">
            <SectionHeading
              eyebrow="Who it is for"
              title="Targeted audiences."
              description="A shared process with role-appropriate tasks for vendors, government officials and administrators."
              centered
            />

            {/* Centered, curved relationship diagram inspired by the reference layout. */}
            <Box
              aria-hidden="true"
              sx={{
                display: { xs: 'none', md: 'block' },
                position: 'relative',
                width: '100%',
                maxWidth: 1120,
                height: 150,
                mx: 'auto',
                mt: { md: -0.5 },
                mb: 0,
              }}
            >
              <svg
                viewBox="0 0 1000 154"
                preserveAspectRatio="none"
                width="100%"
                height="100%"
                style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
              >
                <path
                  d="M500 0 V10 M500 48 V68 M166 150 V108 Q166 68 206 68 H794 Q834 68 834 108 V150 M500 68 V150"
                  fill="none"
                  stroke="#7d9bd4"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  minWidth: 220,
                  px: 3.5,
                  py: 1.25,
                  textAlign: 'center',
                  color: '#102a4c',
                  bgcolor: '#fff',
                  border: '1px solid #cbdcf3',
                  borderRadius: 99,
                  boxShadow: '0 7px 20px rgba(0,0,80,0.08)',
                  fontSize: '0.92rem',
                  lineHeight: 1.35,
                  fontWeight: 850,
                  whiteSpace: 'nowrap',
                  zIndex: 1,
                }}
              >
                Our Key Users
              </Box>
            </Box>

            <Grid container spacing={2.5}>
              {AUDIENCES.map((audience) => (
                <Grid size={{ xs: 12, md: 4 }} key={audience.title}>
                  <HoverCard>
                    <Stack
                      sx={{
                        p: { xs: 2.75, md: 3.25 },
                        height: '100%',
                        minHeight: { xs: 285, md: 340 },
                      }}
                      alignItems="flex-start"
                    >
                      <IconTile size={54}>{audience.icon}</IconTile>
                      <Typography
                        variant="overline"
                        sx={{
                          color: BRAND_PRIMARY,
                          fontWeight: 850,
                          letterSpacing: 1.1,
                          mt: 2.5,
                        }}
                      >
                        {audience.eyebrow}
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{
                          color: '#102a4c',
                          fontWeight: 850,
                          mt: 0.5,
                          mb: 1,
                        }}
                      >
                        {audience.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.8, flexGrow: 1 }}
                      >
                        {audience.body}
                      </Typography>
                      <Button
                        component={RouterLink}
                        to={audience.to}
                        endIcon={<ArrowOutward />}
                        sx={{
                          mt: 2.5,
                          px: 0,
                          fontWeight: 800,
                          '&:hover': { bgcolor: 'transparent', gap: 0.5 },
                        }}
                      >
                        {audience.action}
                      </Button>
                    </Stack>
                  </HoverCard>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Closing call to action */}
        <Box
          component="section"
          sx={{
            px: 0,
            py: { xs: 6, md: 9 },
            background:
              'radial-gradient(ellipse at 85% 10%, rgba(70, 135, 205, 0.22), transparent 34%), linear-gradient(120deg, #000066 0%, #000080 100%)',
          }}
        >
          <Container maxWidth="lg">
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, sm: 4, md: 5.5 },
                borderRadius: 4,
                textAlign: 'center',
                color: '#fff',
                background: 'rgba(255,255,255,0.075)',
                border: '1px solid rgba(213,232,255,0.2)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Chip
                label="Get started"
                sx={{
                  color: '#dce8f7',
                  bgcolor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  fontWeight: 800,
                  mb: 2,
                }}
              />
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: '1.9rem', sm: '2.4rem', md: '2.8rem' },
                  lineHeight: 1.12,
                  fontWeight: 900,
                  letterSpacing: '-0.035em',
                  mb: 1.5,
                }}
              >
                Bring every stage into view.
              </Typography>
              <Typography sx={{ color: 'rgba(239,246,255,0.76)', maxWidth: 660, mx: 'auto', lineHeight: 1.8, mb: 3.25 }}>
                Vendors can begin registration. Government officials can sign in to manage procurement, approvals and payments.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForward />}
                  sx={{
                    minHeight: 52,
                    px: 3,
                    borderRadius: 2.5,
                    color: BRAND_PRIMARY_HOVER,
                    bgcolor: '#fff',
                    fontWeight: 850,
                    '&:hover': { bgcolor: '#eaf2ff' },
                  }}
                >
                  Register as a vendor
                </Button>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  size="large"
                  startIcon={<Login />}
                  sx={{
                    minHeight: 52,
                    px: 3,
                    borderRadius: 2.5,
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.45)',
                    fontWeight: 800,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: '#fff' },
                  }}
                >
                  Login
                </Button>
              </Stack>
            </Paper>
          </Container>
        </Box>
      </main>

      {/* Institutional footer */}
      <Box component="footer" sx={{ bgcolor: '#061a34', color: '#fff' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 5 } }}>
          <Grid container spacing={4} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 2.25,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  <AccountBalance />
                </Box>
                <Box>
                  <Typography fontWeight={850}>Vendor Payment System</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(232,242,255,0.6)' }}>
                    National eGovernance Division
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2" sx={{ color: 'rgba(232,242,255,0.65)', lineHeight: 1.8, mt: 2, maxWidth: 520 }}>
                A connected procurement-to-payment platform for vendors and government organisations.
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="overline" sx={{ color: '#b8cee8', fontWeight: 850, letterSpacing: 1.2 }}>
                EXPLORE
              </Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {[
                  { label: 'Platform modules', href: '#modules' },
                  { label: 'Capabilities', href: '#features' },
                  { label: 'How it works', href: '#process' },
                ].map((item) => (
                  <Typography
                    key={item.href}
                    component="a"
                    href={item.href}
                    variant="body2"
                    sx={{
                      width: 'fit-content',
                      color: 'rgba(232,242,255,0.72)',
                      textDecoration: 'none',
                      '&:hover': { color: '#fff', textDecoration: 'underline' },
                    }}
                  >
                    {item.label}
                  </Typography>
                ))}
              </Stack>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="overline" sx={{ color: '#b8cee8', fontWeight: 850, letterSpacing: 1.2 }}>
                ACCESS
              </Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                <Typography
                  component={RouterLink}
                  to="/register"
                  variant="body2"
                  sx={{ width: 'fit-content', color: 'rgba(232,242,255,0.72)', textDecoration: 'none', '&:hover': { color: '#fff' } }}
                >
                  Vendor registration
                </Typography>
                <Typography
                  component={RouterLink}
                  to="/login"
                  variant="body2"
                  sx={{ width: 'fit-content', color: 'rgba(232,242,255,0.72)', textDecoration: 'none', '&:hover': { color: '#fff' } }}
                >
                  Login
                </Typography>
              </Stack>
            </Grid>
          </Grid>
          <Divider sx={{ borderColor: 'rgba(218,235,255,0.14)', my: 3 }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
            <Typography variant="caption" sx={{ color: 'rgba(232,242,255,0.58)', lineHeight: 1.6 }}>
              National eGovernance Division · Ministry of Electronics and Information Technology
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(232,242,255,0.58)' }}>
              Vendor Payment System — demonstration environment
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
