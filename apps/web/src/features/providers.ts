export const providerGroups = [
  { name: 'AWS', brands: ['AWS'], description: 'Read-only cloud evidence collection' },
  { name: 'Azure / Entra ID', brands: ['Microsoft Azure'], description: 'Identity and cloud control observations' },
  { name: 'Google Cloud', brands: ['Google Cloud'], description: 'Cloud security control observations' },
  { name: 'Okta', brands: ['Okta'], description: 'Identity and access review evidence' },
  { name: 'GitHub', brands: ['GitHub'], description: 'Repository access and change-control evidence' },
  { name: 'Jira / ServiceNow', brands: ['Jira', 'ServiceNow'], description: 'Corrective actions and service-management records' },
  { name: 'Tenable / Qualys', brands: ['Tenable', 'Qualys'], description: 'Vulnerability and remediation records' },
  { name: 'CrowdStrike / Defender', brands: ['CrowdStrike', 'Microsoft Defender'], description: 'Endpoint protection and response evidence' },
  { name: 'Veeam / Rubrik', brands: ['Veeam', 'Rubrik'], description: 'Backup and recovery evidence' },
  { name: 'On-premises Collector', brands: ['On-premises'], description: 'Customer-hosted collection; offline transfer needs a separate design' },
];
export const providerNames = providerGroups.flatMap(group => group.brands);
