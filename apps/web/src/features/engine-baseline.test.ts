import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { assessmentMethods } from '@closureproof/assessment-engine/protocol-catalogue';

// Captured before moving shared contracts/rules out of aws-iam.ts. Changing a
// registered definition requires an explicit new version, never a silent rewrite.
const fingerprints = {
  'aws-iam': '0942cd857791d71bbf3f8dbe7e987d2574f5b1200cda359e58011a731947e985',
  access: '31356077af7aab630c59fce565cc2ed11ea4fb5d1ff289243d5a705a1dafcbf3',
  leavers: '1cd854e67f8c77d590636183f63992019ec1805a49bb8312461c5f7fb1e1e835',
  mfa: '8a5e558c41e6b54b5daf656440e7cfd18da5885c89bee82e07dea72533cf403f',
  patch: '940a3f1d8e6686034559d392b9c591c8a8354f55d10fd55321c625d141d48991',
  backup: 'b863493027595018e3f0bc8be21d9acfcc119afbdb3ecc72114a0d4f34292d61',
  supplier: 'ca860ccfdcf6752348b180d3f3bae3a51cfb29a87999b521905927cb013769a8',
  logging: 'e34565247e867b7c136613c71618c99c96fb162ce98bb9d87c728831305dff4a',
  changes: '6effa5097c87e2d727e849e056a84efac7fc7de8c9ae0098ca817277a7380c43',
  incidents: '213ad7c6e0ef493d496702d358f3dd69b62ce58c2350d159a2cc5a565b5973c3',
};
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
}
it('preserves every registered protocol, mapping, rule and field during the shared-core refactor', () => {
  expect(
    Object.fromEntries(
      assessmentMethods.map((method) => [
        method.protocol.code,
        createHash('sha256')
          .update(JSON.stringify(stable(method)))
          .digest('hex'),
      ]),
    ),
  ).toEqual(fingerprints);
});

it('keeps generic access methods free of AWS-specific input requirements', () => {
  for (const code of ['access', 'leavers', 'mfa']) {
    const method = assessmentMethods.find((method) => method.protocol.code === code)!;
    expect(JSON.stringify(method)).not.toMatch(/AWS|aws-iam|IAM users|root account/i);
  }
});
