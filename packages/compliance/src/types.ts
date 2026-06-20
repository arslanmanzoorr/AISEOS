export type Framework = "soc2" | "gdpr" | "hipaa" | "pci";

export interface SystemControls {
  encryptionAtRest?: boolean;
  encryptionInTransit?: boolean;
  accessControl?: boolean;
  auditLogging?: boolean;
  dataRetentionPolicy?: boolean;
  incidentResponsePlan?: boolean;
  dataSubjectRights?: boolean; // GDPR
  cardholderDataIsolation?: boolean; // PCI
  phiSafeguards?: boolean; // HIPAA
}

export interface ComplianceResult {
  framework: Framework;
  compliant: boolean;
  gaps: string[]; // names of required controls not satisfied
}

export interface AuditEvent {
  actor: string;
  action: string;
  timestamp: string;
}

export interface AuditEntry extends AuditEvent {
  index: number;
  prevHash: string;
  hash: string;
}

export interface AuditVerifyResult {
  valid: boolean;
  brokenAt?: number; // index of the first tampered/invalid entry
}
