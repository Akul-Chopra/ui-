import { api } from './client';

// The public self-registration surface is anonymous: none of these calls carry a session
// bearer token. The one piece of state that must survive between steps — proof that the
// email was OTP-verified — is a short-lived registration token the server issues at
// verify-otp and the client echoes back in the body of the later steps.

const PUBLIC = '/api/v1/public';

export interface PublicOrganisation {
  code: string;
  name: string;
  ministryName: string;
  primaryColor: string | null;
}

/** A development-only demo account for the login-page picker. */
export interface DemoAccount {
  orgCode: string;
  orgName: string;
  userName: string;
  fullName: string;
  designation?: string;
  roles?: string;
  isVendor: boolean;
}

export interface StartRegistrationRequest {
  organisationCode: string;
  email: string;
  mobile: string;
}

export interface StartRegistrationResult {
  sentTo: string;
  expiresInSeconds: number;
  /** Present in development only, where there is no live mail gateway. */
  devOtp: string | null;
}

export interface VerifyOtpRequest {
  organisationCode: string;
  email: string;
  mobile: string;
  otp: string;
}

export interface VerifyOtpResult {
  registrationToken: string;
}

/** GSTN-sourced particulars, presented read-only — the vendor cannot edit these. */
export interface GstTaxpayerDetails {
  gstin: string;
  pan: string;
  legalName: string;
  tradeName: string | null;
  constitution: string;
  constitutionText: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  registrationDate: string | null;
  status: string | null;
  isActive: boolean;
  taxpayerType: string | null;
  stateJurisdiction: string | null;
  centreJurisdiction: string | null;
}

export type MsmeCategory = 'NotRegistered' | 'Micro' | 'Small' | 'Medium';
export type EntityType = 'Company' | 'Llp' | 'Society' | 'PartnershipFirm' | 'ProprietaryFirm';
export type BankAccountType = 'Savings' | 'Current' | 'CashCredit' | 'OverDraft';

/** Display labels for the vendor legal-form dropdown. */
export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  Company: 'Company',
  Llp: 'LLP',
  Society: 'Society',
  PartnershipFirm: 'Partnership Firm',
  ProprietaryFirm: 'Proprietary Firm',
};

export interface RegistrationBankAccount {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  accountType: BankAccountType;
}

export interface CompleteRegistrationRequest {
  registrationToken: string;
  gstin: string;
  contactPersonName: string;
  alternatePhone?: string;
  website?: string;
  entityType?: EntityType;
  msmeCategory?: MsmeCategory;
  udyamRegistrationNumber?: string;
  bankAccount: RegistrationBankAccount;
  password: string;
}

export interface CompleteRegistrationResult {
  vendorCode: string;
  status: string;
  userName: string;
  message: string;
}

/** An existing vendor already registered under a looked-up GSTIN. */
export interface ExistingVendorSummary {
  vendorId: string;
  vendorCode: string;
  legalName: string;
  status: string;
}

/** GSTIN lookup result: the GSTN particulars plus any existing registration for this GSTIN. */
export interface GstinLookupResult {
  gst: GstTaxpayerDetails | null;
  alreadyRegistered: ExistingVendorSummary | null;
}

export const publicRegistrationApi = {
  organisations: () =>
    api.get<PublicOrganisation[]>(`${PUBLIC}/organisations`).then((r) => r.data),
  /** Development-only: all accounts for the login demo picker (empty in production). */
  devAccounts: () => api.get<DemoAccount[]>(`${PUBLIC}/dev-accounts`).then((r) => r.data),

  start: (body: StartRegistrationRequest) =>
    api.post<StartRegistrationResult>(`${PUBLIC}/registration/start`, body).then((r) => r.data),

  verifyOtp: (body: VerifyOtpRequest) =>
    api.post<VerifyOtpResult>(`${PUBLIC}/registration/verify-otp`, body).then((r) => r.data),

  lookupGstin: (registrationToken: string, gstin: string) =>
    api
      .post<GstinLookupResult>(`${PUBLIC}/registration/gstin`, { registrationToken, gstin })
      .then((r) => r.data),

  complete: (body: CompleteRegistrationRequest) =>
    api
      .post<CompleteRegistrationResult>(`${PUBLIC}/registration/complete`, body)
      .then((r) => r.data),
};
