export type Readiness = 'Not closure ready' | 'Implemented but evidence incomplete' | 'Ready for retest' | 'Closure ready';
export type CheckResult = 'pass' | 'fail' | 'unknown' | 'not_applicable';
export interface Check { id: string; label: string; result: CheckResult; explanation: string; nextAction: string }
export interface Action { id: string; title: string; owner: string; status: 'Planned' | 'In progress' | 'Implemented'; implementedAt?: string }
export interface Evidence { id: string; filename: string; type: string; size: number; scope: string; source: string; periodStart: string; periodEnd: string; status: 'Customer-submitted' | 'Pending scan'; uploadedBy: string; collectedAt: string; exceptions: string }
export interface Finding { id: string; title: string; description: string; severity: 'High' | 'Medium' | 'Low'; control: string; owner: string; dueDate: string; scope: string; protocolId: string; rootCause: string; state: Readiness; revision: number; actions: Action[]; evidence: Evidence[]; checks: Check[] }
export interface Protocol { id: string; name: string; description: string; days: number; cycles: number; actions: string[]; version: string }
export interface AuditEvent { id: string; findingId: string; title: string; detail: string; timestamp: string; actor: string; revision: number }
export interface Organisation { id: string; name: string; role: 'admin' | 'owner' | 'reviewer' | 'viewer' | 'pilot' }
export interface Member { id: string; name: string; email: string; role: string }
