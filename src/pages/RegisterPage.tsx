import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  MenuItem,
  Alert,
  InputAdornment,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Link,
  Divider,
  Chip,
} from '@mui/material';
// MUI 6 keeps the responsive `size` API on Grid2; the legacy Grid still uses item/xs/md.
import Grid from '@mui/material/Grid2';
import {
  AccountBalance,
  Domain,
  Email,
  PhoneIphone,
  Pin,
  Badge,
  Lock,
  CheckCircle,
  VerifiedUser,
  Person,
} from '@mui/icons-material';
import { errorMessage } from '@/api/client';
import {
  publicRegistrationApi,
  ENTITY_TYPE_LABELS,
  type GstTaxpayerDetails,
  type ExistingVendorSummary,
  type BankAccountType,
  type EntityType,
} from '@/api/publicRegistration';

const STEPS = ['Organisation', 'Verify email', 'GST & bank details', 'Done'];

const ACCOUNT_TYPE_OPTIONS: { value: BankAccountType; label: string }[] = [
  { value: 'Current', label: 'Current' },
  { value: 'Savings', label: 'Savings' },
  { value: 'CashCredit', label: 'Cash Credit' },
  { value: 'OverDraft', label: 'Overdraft' },
];

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public vendor self-registration. A wizard that walks an unauthenticated vendor from
 * picking their organisation, through email OTP verification, to a GSTN-backed profile with
 * bank details — ending with a portal login they can use to track verification.
 *
 * The GST-sourced fields (step 3) are shown read-only: the server re-fetches and trusts its
 * own copy, so the form presents them as confirmation, not as editable input.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Cross-step state the wizard threads through.
  const [organisationCode, setOrganisationCode] = useState('negd');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [registrationToken, setRegistrationToken] = useState('');
  const [completedVendor, setCompletedVendor] = useState('');

  const orgsQuery = useQuery({
    queryKey: ['public', 'organisations'],
    queryFn: publicRegistrationApi.organisations,
  });

  const startMutation = useMutation({
    mutationFn: publicRegistrationApi.start,
    onSuccess: (r) => {
      setSentTo(r.sentTo);
      setDevOtp(r.devOtp);
      setOtpSent(true);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: publicRegistrationApi.verifyOtp,
    onSuccess: (r) => {
      setRegistrationToken(r.registrationToken);
      setStep(2);
    },
  });

  const emailValid = EMAIL_RE.test(email);
  const mobileValid = MOBILE_RE.test(mobile);
  const otpValid = /^\d{6}$/.test(otp);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        background:
          'radial-gradient(1200px 600px at 10% -10%, rgba(11,79,108,0.25), transparent), radial-gradient(1000px 500px at 110% 110%, rgba(1,186,239,0.2), transparent)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ width: '100%', maxWidth: 640 }}
      >
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, width: '100%' }}>
          <Stack spacing={1} alignItems="center" sx={{ mb: 3 }}>
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 56,
                height: 56,
                borderRadius: 3,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              <AccountBalance fontSize="large" />
            </Box>
            <Typography variant="h5" fontWeight={800}>
              Vendor Registration
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Register to supply to a government organisation on the Vendor Payment System
            </Typography>
          </Stack>

          <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Step 0 — organisation */}
          {step === 0 && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Choose the government organisation you supply to. Your registration is reviewed
                and activated by that organisation.
              </Typography>
              <TextField
                select
                label="Organisation"
                value={organisationCode}
                onChange={(e) => setOrganisationCode(e.target.value)}
                fullWidth
                disabled={orgsQuery.isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Domain fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              >
                {(orgsQuery.data ?? []).map((o) => (
                  <MenuItem key={o.code} value={o.code}>
                    {o.name}
                  </MenuItem>
                ))}
              </TextField>
              {orgsQuery.isError && <Alert severity="error">{errorMessage(orgsQuery.error)}</Alert>}
              <Button
                variant="contained"
                size="large"
                disabled={!organisationCode || orgsQuery.isLoading}
                onClick={() => setStep(1)}
              >
                Continue
              </Button>
            </Stack>
          )}

          {/* Step 1 — email + OTP */}
          {step === 1 && (
            <Stack spacing={2}>
              {!otpSent ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    We'll email you a one-time code to confirm this address.
                  </Typography>
                  <TextField
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    autoFocus
                    error={!!email && !emailValid}
                    helperText={!!email && !emailValid ? 'Enter a valid email address.' : ' '}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="Mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    fullWidth
                    error={!!mobile && !mobileValid}
                    helperText={
                      !!mobile && !mobileValid ? 'Enter a valid 10-digit Indian mobile.' : ' '
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIphone fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  {startMutation.isError && (
                    <Alert severity="error">{errorMessage(startMutation.error)}</Alert>
                  )}
                  <Stack direction="row" spacing={1}>
                    <Button variant="text" onClick={() => setStep(0)}>
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      disabled={!emailValid || !mobileValid || startMutation.isPending}
                      onClick={() => startMutation.mutate({ organisationCode, email, mobile })}
                    >
                      {startMutation.isPending ? 'Sending code…' : 'Send code'}
                    </Button>
                  </Stack>
                </>
              ) : (
                <>
                  <Alert severity="success" icon={<Email fontSize="inherit" />}>
                    A 6-digit code was sent to <b>{sentTo}</b>.
                  </Alert>
                  {devOtp && (
                    <Alert severity="info">
                      Development mode — your code is <b>{devOtp}</b> (no live mail gateway).
                    </Alert>
                  )}
                  <TextField
                    label="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    fullWidth
                    autoFocus
                    inputProps={{
                      inputMode: 'numeric',
                      style: { letterSpacing: '0.4em', fontSize: 20 },
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Pin fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  {verifyMutation.isError && (
                    <Alert severity="error">{errorMessage(verifyMutation.error)}</Alert>
                  )}
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="text"
                      disabled={startMutation.isPending}
                      onClick={() => startMutation.mutate({ organisationCode, email, mobile })}
                    >
                      Resend
                    </Button>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      disabled={!otpValid || verifyMutation.isPending}
                      onClick={() =>
                        verifyMutation.mutate({ organisationCode, email, mobile, otp })
                      }
                    >
                      {verifyMutation.isPending ? 'Verifying…' : 'Verify & continue'}
                    </Button>
                  </Stack>
                </>
              )}
            </Stack>
          )}

          {/* Step 2 — GST fetch + bank details */}
          {step === 2 && (
            <GstAndBankStep
              registrationToken={registrationToken}
              primaryPhone={mobile}
              onComplete={(vendorCode) => {
                setCompletedVendor(vendorCode);
                setStep(3);
              }}
              onBack={() => setStep(1)}
            />
          )}

          {/* Step 3 — done */}
          {step === 3 && (
            <DoneStep
              vendorCode={completedVendor}
              email={email}
              onSignIn={() => navigate('/login')}
            />
          )}

          {step < 3 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Already registered?{' '}
                <Link component={RouterLink} to="/login" fontWeight={700}>
                  Sign in
                </Link>
              </Typography>
            </>
          )}
        </Paper>
      </motion.div>
    </Box>
  );
}

/** A GSTN field, shown read-only with a "from GST" badge so the vendor sees it's verified. */
function GstField({ label, value }: { label: string; value?: string | null }) {
  return (
    <TextField
      label={label}
      value={value ?? '—'}
      fullWidth
      InputProps={{
        readOnly: true,
        endAdornment: (
          <InputAdornment position="end">
            <VerifiedUser fontSize="small" color="success" />
          </InputAdornment>
        ),
      }}
      variant="filled"
    />
  );
}

interface GstAndBankStepProps {
  registrationToken: string;
  /** The OTP-verified mobile from step 1, shown read-only as the primary phone. */
  primaryPhone: string;
  onComplete: (vendorCode: string) => void;
  onBack: () => void;
}

/**
 * Step 3: fetch the GSTIN's particulars (presented read-only), then collect the fields GST
 * cannot supply — contact person, entity type, bank account, and a portal password.
 */
function GstAndBankStep({ registrationToken, primaryPhone, onComplete, onBack }: GstAndBankStepProps) {
  const [gstin, setGstin] = useState('');
  const [gst, setGst] = useState<GstTaxpayerDetails | null>(null);
  const [existingReg, setExistingReg] = useState<ExistingVendorSummary | null>(null);

  const [contactPersonName, setContactPersonName] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [website, setWebsite] = useState('');
  const [entityType, setEntityType] = useState<EntityType | ''>('');

  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountType, setAccountType] = useState<BankAccountType>('Current');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const lookupMutation = useMutation({
    mutationFn: () => publicRegistrationApi.lookupGstin(registrationToken, gstin),
    onSuccess: (r) => {
      setGst(r.gst);
      setExistingReg(r.alreadyRegistered);
      // Seed the account holder with the legal name; the vendor can correct it.
      setAccountHolderName((prev) => prev || r.gst?.legalName || '');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      publicRegistrationApi.complete({
        registrationToken,
        gstin,
        contactPersonName,
        alternatePhone: alternatePhone || undefined,
        website: website || undefined,
        entityType: entityType || undefined,
        bankAccount: {
          accountHolderName,
          accountNumber,
          ifscCode,
          bankName,
          branchName: branchName || undefined,
          accountType,
        },
        password,
      }),
    onSuccess: (r) => onComplete(r.vendorCode),
  });

  const gstinValid = GSTIN_RE.test(gstin.toUpperCase());
  const accountNumberValid = /^\d{9,18}$/.test(accountNumber);
  const ifscValid = IFSC_RE.test(ifscCode.toUpperCase());
  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirm;

  const canSubmit =
    !!gst &&
    !existingReg &&
    !!entityType &&
    contactPersonName.trim().length > 0 &&
    accountHolderName.trim().length > 0 &&
    accountNumberValid &&
    ifscValid &&
    bankName.trim().length > 0 &&
    passwordValid &&
    passwordsMatch;

  return (
    <Stack spacing={2}>
      {/* GSTIN lookup */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
        <TextField
          label="GSTIN"
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 15))}
          fullWidth
          autoFocus
          error={!!gstin && !gstinValid}
          helperText={!!gstin && !gstinValid ? 'A GSTIN is 15 characters.' : 'e.g. 27AAACR5055K1Z7'}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Badge fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="outlined"
          size="large"
          sx={{ mt: 0.5, minWidth: 120, height: 56 }}
          disabled={!gstinValid || lookupMutation.isPending}
          onClick={() => lookupMutation.mutate()}
        >
          {lookupMutation.isPending ? 'Fetching…' : 'Fetch'}
        </Button>
      </Stack>

      {lookupMutation.isError && (
        <Alert severity="error">{errorMessage(lookupMutation.error)}</Alert>
      )}

      {existingReg && (
        <Alert severity="warning">
          <strong>{existingReg.legalName}</strong> is already registered under this GSTIN
          (vendor code {existingReg.vendorCode}, status {existingReg.status}). If this is your
          organisation, please sign in instead of registering again.
        </Alert>
      )}

      {gst && (
        <>
          <Divider>
            <Chip
              icon={<VerifiedUser />}
              label="Fetched from GSTN — verified, non-editable"
              color="success"
              size="small"
            />
          </Divider>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <GstField label="Legal name" value={gst.legalName} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <GstField label="Trade name" value={gst.tradeName} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <GstField label="PAN" value={gst.pan} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <GstField label="Constitution" value={gst.constitutionText ?? gst.constitution} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <GstField label="GST status" value={gst.status} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <GstField
                label="Registered address"
                value={[gst.addressLine1, gst.addressLine2, gst.city, gst.state, gst.pincode]
                  .filter(Boolean)
                  .join(', ')}
              />
            </Grid>
          </Grid>

          {!gst.isActive && (
            <Alert severity="warning">
              This GSTIN is not active on GSTN and cannot be registered.
            </Alert>
          )}

          {/* Vendor-supplied details */}
          <Divider sx={{ mt: 1 }}>
            <Chip label="Your details" size="small" />
          </Divider>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Contact person"
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
                fullWidth
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Primary phone"
                value={primaryPhone}
                fullWidth
                InputProps={{ readOnly: true }}
                helperText="Verified during OTP — your login number"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Alternate phone"
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Website (optional)"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Entity type"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as EntityType)}
                fullWidth
                required
                error={!entityType}
                helperText={!entityType ? 'Select the legal form of your organisation.' : ' '}
              >
                {(Object.keys(ENTITY_TYPE_LABELS) as EntityType[]).map((v) => (
                  <MenuItem key={v} value={v}>
                    {ENTITY_TYPE_LABELS[v]}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          {/* Bank account */}
          <Divider sx={{ mt: 1 }}>
            <Chip icon={<AccountBalance />} label="Bank account" size="small" />
          </Divider>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Account holder name"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Account number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
                fullWidth
                required
                error={!!accountNumber && !accountNumberValid}
                helperText={
                  !!accountNumber && !accountNumberValid ? '9 to 18 digits.' : ' '
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="IFSC code"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 11))}
                fullWidth
                required
                error={!!ifscCode && !ifscValid}
                helperText={!!ifscCode && !ifscValid ? 'An IFSC is 11 characters.' : ' '}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Account type"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as BankAccountType)}
                fullWidth
              >
                {ACCOUNT_TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Bank name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Branch (optional)"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>

          {/* Portal password */}
          <Divider sx={{ mt: 1 }}>
            <Chip icon={<Lock />} label="Portal login" size="small" />
          </Divider>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                required
                error={!!password && !passwordValid}
                helperText={!!password && !passwordValid ? 'At least 8 characters.' : ' '}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                fullWidth
                required
                error={!!confirm && !passwordsMatch}
                helperText={!!confirm && !passwordsMatch ? 'Passwords do not match.' : ' '}
              />
            </Grid>
          </Grid>

          {completeMutation.isError && (
            <Alert severity="error">{errorMessage(completeMutation.error)}</Alert>
          )}
        </>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button variant="text" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!canSubmit || completeMutation.isPending}
          onClick={() => completeMutation.mutate()}
        >
          {completeMutation.isPending ? 'Submitting…' : 'Submit registration'}
        </Button>
      </Stack>
    </Stack>
  );
}

interface DoneStepProps {
  vendorCode: string;
  email: string;
  onSignIn: () => void;
}

/** Success screen — confirms the vendor code and points the vendor at sign-in. */
function DoneStep({ vendorCode, email, onSignIn }: DoneStepProps) {
  return (
    <Stack spacing={2} alignItems="center" textAlign="center" sx={{ py: 2 }}>
      <CheckCircle color="success" sx={{ fontSize: 64 }} />
      <Typography variant="h6" fontWeight={800}>
        Registration submitted
      </Typography>
      <Chip label={vendorCode} color="primary" sx={{ fontWeight: 700 }} />
      <Typography variant="body2" color="text.secondary">
        Your registration is pending verification by the organisation. Sign in with your email
        (<b>{email}</b>) and the password you just set to track its progress.
      </Typography>
      <Button variant="contained" size="large" fullWidth onClick={onSignIn}>
        Go to sign in
      </Button>
    </Stack>
  );
}
