import type { Protocol } from '../lib/types';
export const protocols: Protocol[] = [
  {
    "id": "access",
    "name": "Privileged access reviews",
    "description": "Complete account population and repeat reviews",
    "days": 90,
    "cycles": 2,
    "actions": [
      "Register privileged accounts",
      "Assign review ownership",
      "Resolve inappropriate access"
    ],
    "version": "0.1"
  },
  {
    "id": "leavers",
    "name": "Joiners and leavers",
    "description": "Leaver population reconciled against access removal",
    "days": 30,
    "cycles": 2,
    "actions": [
      "Reconcile HR and identity records",
      "Assign removal ownership",
      "Resolve residual access"
    ],
    "version": "0.1"
  },
  {
    "id": "mfa",
    "name": "MFA enforcement",
    "description": "In-scope identities protected and exclusions resolved",
    "days": 30,
    "cycles": 2,
    "actions": [
      "Define identity scope",
      "Enforce MFA policy",
      "Resolve bypass exceptions"
    ],
    "version": "0.1"
  },
  {
    "id": "patch",
    "name": "Security patching",
    "description": "Assets reconciled and overdue vulnerabilities addressed",
    "days": 30,
    "cycles": 2,
    "actions": [
      "Reconcile asset inventory",
      "Assign patch ownership",
      "Resolve overdue vulnerabilities"
    ],
    "version": "0.1"
  },
  {
    "id": "backup",
    "name": "Backup restoration",
    "description": "In-scope services restored and failures remediated",
    "days": 30,
    "cycles": 2,
    "actions": [
      "Define recovery scope",
      "Assign restore ownership",
      "Resolve failed restores"
    ],
    "version": "0.1"
  },
  {
    "id": "supplier",
    "name": "Supplier reviews",
    "description": "Supplier population covered and risk actions verified",
    "days": 60,
    "cycles": 2,
    "actions": [
      "Reconcile supplier register",
      "Assign review ownership",
      "Resolve risk actions"
    ],
    "version": "0.1"
  },
  {
    "id": "logging",
    "name": "Security logging",
    "description": "Systems covered and monitoring gaps addressed",
    "days": 30,
    "cycles": 2,
    "actions": [
      "Define logging scope",
      "Assign monitoring ownership",
      "Resolve collection gaps"
    ],
    "version": "0.1"
  },
  {
    "id": "changes",
    "name": "Change control",
    "description": "Changes reconciled with authorisation and testing",
    "days": 30,
    "cycles": 2,
    "actions": [
      "Reconcile production changes",
      "Assign approval ownership",
      "Resolve unauthorised changes"
    ],
    "version": "0.1"
  },
  {
    "id": "incidents",
    "name": "Incident response",
    "description": "Incident population reconciled and response tested",
    "days": 30,
    "cycles": 2,
    "actions": [
      "Reconcile incident register",
      "Assign response ownership",
      "Resolve response failures"
    ],
    "version": "0.1"
  },
  {
    "id": "training",
    "name": "Security training",
    "description": "Staff population reconciled and completion evidenced",
    "days": 30,
    "cycles": 2,
    "actions": [
      "Reconcile staff register",
      "Assign training ownership",
      "Resolve incomplete training"
    ],
    "version": "0.1"
  }
];
