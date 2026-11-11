import { Server } from 'lucide-react';
const logos: Record<string, { file: string; alt: string }> = {
  AWS: { file: 'aws.svg', alt: 'AWS logo' },
  'Microsoft Azure': { file: 'azure.svg', alt: 'Microsoft Azure logo' },
  'Azure / Entra ID': { file: 'azure.svg', alt: 'Microsoft Azure logo' },
  'Google Cloud': { file: 'google-cloud.svg', alt: 'Google Cloud logo' },
  'Okta': { file: 'okta.svg', alt: 'Okta logo' },
  'GitHub': { file: 'github.svg', alt: 'GitHub logo' },
  'Jira': { file: 'jira.svg', alt: 'Jira logo' },
  'ServiceNow': { file: 'servicenow.png', alt: 'ServiceNow logo' },
  'Tenable': { file: 'tenable.svg', alt: 'Tenable logo' },
  'Qualys': { file: 'qualys.svg', alt: 'Qualys logo' },
  'CrowdStrike': { file: 'crowdstrike.svg', alt: 'CrowdStrike logo' },
  'Microsoft Defender': { file: 'microsoftdefender.svg', alt: 'Microsoft Defender logo' },
  'Veeam': { file: 'veeam.svg', alt: 'Veeam logo' },
  'Rubrik': { file: 'rubrik.png', alt: 'Rubrik logo' },
};
export function ProviderLogo({ name, compact = false }: { name: string; compact?: boolean }) {
  const logo = logos[name];
  const size = compact ? 'h-6 w-8' : 'h-10 w-12';
  return logo ? <img src={`/brand/providers/${logo.file}`} alt={logo.alt} width="48" height="40" className={`${size} shrink-0 object-contain object-left`} /> : <Server aria-hidden="true" className={`${size} text-accent`} strokeWidth={1.5} />;
}
