import { Link as RouterLink, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Container, Stack, Typography, Button, Paper, Divider, Chip } from '@mui/material';
// MUI 6 keeps the responsive `size` API on Grid2; the legacy Grid still uses item/xs/md.
import Grid from '@mui/material/Grid2';
import {
  AccountBalance,
  HowToReg,
  Login,
  VerifiedUser,
  Rule,
  AccountTree,
  Payments,
  ArrowForward,
  Store,
  Description,
  Assignment,
  ReceiptLong,
  FactCheck,
  Gavel,
  Security,
  Speed,
  Visibility,
} from '@mui/icons-material';
import { useAuth } from '@/lib/useAuth';
import { Carousel } from '@/components/Carousel';

// Rotating hero messages — each frames a different reason the platform exists.
const HERO_SLIDES = [
  {
    tag: 'Government Procurement-to-Payment Platform',
    title: 'Vendor payments, from registration to disbursement —',
    accent: 'transparent and rule-driven.',
    body: 'A single, auditable system for government organisations and their vendors — GST-verified onboarding, configurable multi-level approvals, and payments you can trace end to end.',
  },
  {
    tag: 'Configurable, not hard-coded',
    title: 'Change a threshold, and the very next document follows it —',
    accent: 'no redeployment.',
    body: 'A rule engine decides approval depth, deductions and routing from a document’s value. Administrators configure the rules; the system enforces them.',
  },
  {
    tag: 'Nothing hidden',
    title: 'Every contract, purchase order / work order and invoice shows exactly where it is —',
    accent: 'and with whom.',
    body: 'Full approval trails, statutory deductions, and an append-only audit record. Every rupee paid traces back to the rule and the officer behind it.',
  },
  {
    tag: 'One platform, many organisations',
    title: 'Built to be adopted by any department, office or ministry —',
    accent: 'each with its own brand.',
    body: 'Organisations run side by side on one platform, isolated from one another, each with its own users, rules, approval routes and theme.',
  },
];

const STATS = [
  { icon: <VerifiedUser />, value: 'GST-verified', label: 'vendor onboarding from the GST network' },
  { icon: <Rule />, value: 'Rule-driven', label: 'approval depth, thresholds & deductions' },
  { icon: <Visibility />, value: 'End-to-end', label: 'transparency of every approval' },
  { icon: <Security />, value: 'Append-only', label: 'audit trail on every action' },
];

const MODULES = [
  {
    icon: <Store />,
    title: 'Vendor onboarding',
    body: 'Self-registration with email OTP and GST-network verification, officer review, bank-detail change requests, ratings and blacklisting.',
    points: ['Email OTP + GST fetch', 'Officer approval', 'Change requests with sign-off'],
  },
  {
    icon: <Description />,
    title: 'Contracts',
    body: 'Full government-format contracts — parties, scope, cost & payment, term & termination, and the standard legal clauses — with signed documents attached for reviewers.',
    points: ['Legal clauses', 'File attachments', 'Amendment history'],
  },
  {
    icon: <Assignment />,
    title: 'Purchase Orders / Work Orders',
    body: 'Raised against approved contracts, in the standard public-sector layout, with deliverables, statutory-deduction terms and rule-decided contract citation.',
    points: ['Contract-linked', 'Deliverables & tax', 'Government format'],
  },
  {
    icon: <ReceiptLong />,
    title: 'Invoices',
    body: 'Vendors bill against published purchase orders / work orders; technical certification and finance settlement compute TDS, GST, retention and penalty deductions — and officers record a Compliant / Non-compliant verdict against each service level as they review.',
    points: ['Technical + finance review', 'Deductions engine', 'Per-SLA compliance capture'],
  },
  {
    icon: <FactCheck />,
    title: 'Approvals',
    body: 'A personal inbox for every officer — approve, reject or return through each rule-decided level. Steps can be scoped to the raising department and routed to a shared role queue, and every advance names the next officer.',
    points: ['Department-scoped routing', 'Shared role queue', 'Named next-officer'],
  },
  {
    icon: <Payments />,
    title: 'Payments',
    body: 'From a dedicated Record-Payment screen an officer captures the mode, reference and date and marks the invoice paid — each an append-only record so every disbursement traces back to its certified invoice.',
    points: ['NEFT / RTGS / Cheque / DD / PFMS', 'Mark-as-paid & settle', 'Fully audited'],
  },
];

const FEATURES = [
  {
    icon: <VerifiedUser />,
    title: 'GST-verified onboarding',
    body: 'Vendors self-register with an email OTP, then their particulars are fetched straight from the GST network — no manual data entry, no mismatched records.',
  },
  {
    icon: <Rule />,
    title: 'Configurable approvals',
    body: 'A rule engine decides approval depth, thresholds and deductions from a document’s value — change a threshold and the next document follows it, with no redeployment.',
  },
  {
    icon: <AccountTree />,
    title: 'Transparent workflow',
    body: 'Every contract, purchase order / work order and invoice shows exactly where it is pending, with whom, and what each approver decided — the full trail, end to end.',
  },
  {
    icon: <Gavel />,
    title: 'Accountable settlement',
    body: 'Certification, per-SLA compliance verdicts and disbursement each leave an append-only record — with the officer’s name against every Compliant / Non-compliant call — so every rupee traces back to a rule and a person.',
  },
];

const STEPS = [
  { n: '01', title: 'Register', body: 'Vendor signs up and verifies email + GSTIN.' },
  { n: '02', title: 'Verify', body: 'The organisation reviews and activates the vendor.' },
  { n: '03', title: 'Award', body: 'Contracts and purchase orders / work orders clear multi-level approval.' },
  { n: '04', title: 'Pay', body: 'Invoices are certified, settled and disbursed.' },
];

/**
 * Public landing page. The front door for both audiences the system serves: vendors who
 * register and track their work, and government officials who sign in to run procurement and
 * payments. A signed-in user is sent straight to their dashboard.
 */
export function HomePage() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top bar */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backdropFilter: 'blur(8px)',
          bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(18,18,18,0.7)' : 'rgba(255,255,255,0.7)'),
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                }}
              >
                <AccountBalance />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1}>
                  Vendor Payment System
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  National eGovernance Division
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button component={RouterLink} to="/register" startIcon={<HowToReg />} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                Register
              </Button>
              <Button component={RouterLink} to="/login" variant="contained" startIcon={<Login />}>
                Login
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Hero carousel */}
      <Box
        sx={{
          background:
            'radial-gradient(1200px 600px at 10% -10%, rgba(11,79,108,0.22), transparent), radial-gradient(1000px 500px at 110% 10%, rgba(1,186,239,0.18), transparent)',
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
          <Carousel
            interval={6000}
            slides={HERO_SLIDES.map((s) => (
              <Stack key={s.title} spacing={3} alignItems="flex-start" sx={{ maxWidth: 820, px: { xs: 1, md: 5 } }}>
                <Chip label={s.tag} sx={{ fontWeight: 700, bgcolor: 'action.hover' }} />
                <Typography variant="h2" fontWeight={900} sx={{ fontSize: { xs: 30, sm: 44, md: 52 }, lineHeight: 1.06 }}>
                  {s.title}{' '}
                  <Box component="span" sx={{ color: 'primary.main' }}>
                    {s.accent}
                  </Box>
                </Typography>
                <Typography variant="h6" color="text.secondary" fontWeight={400} sx={{ maxWidth: 680 }}>
                  {s.body}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
                  <Button component={RouterLink} to="/register" variant="contained" size="large" startIcon={<HowToReg />} endIcon={<ArrowForward />}>
                    Register as a vendor
                  </Button>
                  <Button component={RouterLink} to="/login" variant="outlined" size="large" startIcon={<Login />}>
                    Official / vendor login
                  </Button>
                </Stack>
              </Stack>
            ))}
          />
        </Container>
      </Box>

      {/* Stats band */}
      <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
          <Grid container spacing={2}>
            {STATS.map((s) => (
              <Grid size={{ xs: 6, md: 3 }} key={s.label}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ opacity: 0.9 }}>{s.icon}</Box>
                  <Box>
                    <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
                      {s.value}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.85 }}>
                      {s.label}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Modules carousel */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Stack spacing={1} alignItems="center" sx={{ mb: 4 }} textAlign="center">
          <Typography variant="overline" color="primary" fontWeight={800} letterSpacing={1}>
            One platform, every stage
          </Typography>
          <Typography variant="h4" fontWeight={800}>
            From onboarding to disbursement
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640 }}>
            Every step of the procurement-to-payment journey, in one connected system.
          </Typography>
        </Stack>

        <Carousel
          interval={4500}
          slides={MODULES.map((m) => (
            <Box key={m.title} sx={{ px: { xs: 1, md: 6 } }}>
              <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 4 }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 64,
                        height: 64,
                        borderRadius: 3,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        mb: 2,
                      }}
                    >
                      {m.icon}
                    </Box>
                    <Typography variant="h5" fontWeight={800} gutterBottom>
                      {m.title}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {m.body}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <Stack spacing={1.5}>
                      {m.points.map((p) => (
                        <Stack key={p} direction="row" spacing={1.5} alignItems="center">
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 2,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: 'action.hover',
                              color: 'primary.main',
                            }}
                          >
                            <VerifiedUser fontSize="small" />
                          </Box>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {p}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          ))}
        />
      </Container>

      {/* Features grid */}
      <Box sx={{ bgcolor: 'action.hover' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
          <Grid container spacing={2.5}>
            {FEATURES.map((f, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={f.title}>
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                >
                  <Paper variant="outlined" sx={{ p: 2.5, height: '100%', borderRadius: 3, bgcolor: 'background.paper' }}>
                    <Box
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        mb: 1.5,
                      }}
                    >
                      {f.icon}
                    </Box>
                    <Typography variant="subtitle1" fontWeight={800} gutterBottom>
                      {f.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {f.body}
                    </Typography>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* How it works */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Typography variant="h4" fontWeight={800} textAlign="center" gutterBottom>
          How it works
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
          Four stages, each governed by the rules the administrator configures.
        </Typography>
        <Grid container spacing={2.5}>
          {STEPS.map((s) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={s.n}>
              <Stack spacing={1}>
                <Typography variant="h3" fontWeight={900} sx={{ color: 'primary.main', opacity: 0.35 }}>
                  {s.n}
                </Typography>
                <Typography variant="h6" fontWeight={800}>
                  {s.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {s.body}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Who it's for */}
      <Box sx={{ bgcolor: 'action.hover' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
          <Typography variant="h4" fontWeight={800} textAlign="center" gutterBottom>
            Built for everyone in the chain
          </Typography>
          <Grid container spacing={2.5} sx={{ mt: 1 }}>
            {[
              { icon: <Store />, who: 'Vendors', body: 'Register, get verified, track purchase orders / work orders and raise invoices — and see exactly where each one stands.' },
              { icon: <FactCheck />, who: 'Officers', body: 'A personal approvals inbox: approve, reject or return at each level, with the full context in front of you.' },
              { icon: <Speed />, who: 'Administrators', body: 'Configure rules and approval routes without code, control who sees what, and audit every action.' },
            ].map((r) => (
              <Grid size={{ xs: 12, md: 4 }} key={r.who}>
                <Paper sx={{ p: 3, height: '100%', borderRadius: 3 }}>
                  <Box sx={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', mb: 1.5 }}>
                    {r.icon}
                  </Box>
                  <Typography variant="h6" fontWeight={800} gutterBottom>
                    {r.who}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {r.body}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Paper
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            textAlign: 'center',
            background: 'linear-gradient(120deg, rgba(11,79,108,0.10), rgba(1,186,239,0.08))',
          }}
        >
          <Typography variant="h4" fontWeight={900} gutterBottom>
            Ready to get started?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            New vendors can register in minutes. Officials sign in to manage procurement and payments.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
            <Button component={RouterLink} to="/register" variant="contained" size="large" startIcon={<HowToReg />}>
              Register as a vendor
            </Button>
            <Button component={RouterLink} to="/login" variant="outlined" size="large" startIcon={<Login />}>
              Login
            </Button>
          </Stack>
        </Paper>
      </Container>

      {/* Footer */}
      <Divider />
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="caption" color="text.secondary">
            National eGovernance Division · Ministry of Electronics and Information Technology
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Vendor Payment System — demonstration environment
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
