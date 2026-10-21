// Enum option lists mirrored from the backend. The API serialises enums as their names
// (JsonStringEnumConverter), so the client sends and receives the string forms below.

export const RuleTriggers = [
  'OnVendorRegistration',
  'OnContractCreate',
  'OnContractSubmit',
  'OnWorkOrderCreate',
  'OnWorkOrderSubmit',
  'OnInvoiceSubmit',
  'OnTechnicalReview',
  'OnFinanceReview',
  'OnPaymentQueue',
  'OnPaymentApproval',
  'OnApprovalOverdue',
  'OnScheduledReminder',
] as const;

export const WorkflowEntityTypes = [
  'Contract',
  'WorkOrder',
  'Invoice',
  'Payment',
  'Vendor',
  'ContractAmendment',
] as const;

export const RuleEvaluationModes = ['FirstMatch', 'AllMatches'] as const;

// The comparison operators an authored leaf condition offers, with human labels.
export const ComparisonOperators: { value: string; label: string }[] = [
  { value: 'Equals', label: '= equals' },
  { value: 'NotEquals', label: '≠ not equals' },
  { value: 'GreaterThan', label: '> greater than' },
  { value: 'GreaterThanOrEqual', label: '≥ at least' },
  { value: 'LessThan', label: '< less than' },
  { value: 'LessThanOrEqual', label: '≤ at most' },
  { value: 'Between', label: 'between (two values)' },
  { value: 'In', label: 'in list' },
  { value: 'Contains', label: 'contains' },
  { value: 'IsTrue', label: 'is true' },
  { value: 'IsFalse', label: 'is false' },
];

// The action types a rule can emit, with a hint of the parameters each expects so the
// editor can pre-fill a sensible JSON skeleton.
export const RuleActionTypes: { value: string; label: string; sample: string }[] = [
  { value: 'SetApprovalLevels', label: 'Set approval levels', sample: '{"levels":3}' },
  { value: 'SetApprovalSla', label: 'Set approval SLA (hours)', sample: '{"hours":48}' },
  { value: 'RequireContract', label: 'Require a contract', sample: '{}' },
  { value: 'RequireDocument', label: 'Require a document', sample: '{"category":"TaxInvoice"}' },
  { value: 'ApplyDeduction', label: 'Apply deduction', sample: '{"type":"TDS","percentage":2}' },
  { value: 'ApplyPenalty', label: 'Apply penalty', sample: '{"perDay":0.5,"capPercentage":10}' },
  { value: 'SetMilestoneSchedule', label: 'Set milestone schedule', sample: '{"percentages":[20,40,60,80,100]}' },
  { value: 'SetWorkflow', label: 'Bind a workflow', sample: '{"workflowCode":"WO_HIGH_VALUE"}' },
  { value: 'SetEscalation', label: 'Set escalation', sample: '{"afterHours":24}' },
  { value: 'SetReminder', label: 'Set reminder', sample: '{"beforeHours":12}' },
  { value: 'Notify', label: 'Notify', sample: '{"roleCode":"FINANCE_OFFICER"}' },
  { value: 'BlockSubmission', label: 'Block submission', sample: '{"message":"Not allowed"}' },
];

export const WorkflowStepModes = ['Sequential', 'Parallel', 'Conditional'] as const;
export const ParallelCompletions = ['Any', 'All', 'Majority'] as const;

export const DeductionTypes = [
  { value: 'Tds', label: 'TDS (Income Tax)' },
  { value: 'GstTds', label: 'GST-TDS' },
  { value: 'RetentionMoney', label: 'Retention money' },
  { value: 'SecurityDeposit', label: 'Security deposit' },
  { value: 'LiquidatedDamages', label: 'Liquidated damages' },
  { value: 'Penalty', label: 'Penalty' },
  { value: 'AdvanceAdjustment', label: 'Advance adjustment' },
  { value: 'QualityShortfall', label: 'Quality shortfall' },
  { value: 'SlaBreach', label: 'SLA breach' },
  { value: 'Other', label: 'Other' },
] as const;
