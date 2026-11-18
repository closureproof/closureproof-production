import { z } from 'zod';
import { assessmentMethod } from '@closureproof/assessment-engine/protocol-catalogue';
import { activeSections } from '../../features/control-scope';
import { JUDGEMENT_VERSION } from '../../features/review-judgement';
import { aiReviewSchema } from '../ai-review-contract';
import type { ReviewContext } from './ai-review-preparation';

// Constrain the provider's actual output grammar to the pinned review. Prompt
// instructions alone cannot prevent invented IDs, references or choice values.
export function providerReviewSchema(context: ReviewContext) {
  const schema = z.toJSONSchema(aiReviewSchema) as Record<string, any>;
  delete schema.$schema;
  const method = assessmentMethod(context.finding.protocol.code);
  if (!method) throw Error('No assessment method is available.');
  const properties = schema.properties;
  const checklistItem = properties.checklist.items;
  const checkIds = context.finding.protocol.checks.map((check) => check.id);
  if (checkIds.length) checklistItem.properties.check_id = { type: 'string', enum: checkIds };
  const engineItem = properties.engine.items;
  properties.engine.items = {
    anyOf: method.fields.map((field) => {
      const value =
        field.type === 'boolean'
          ? { type: ['string', 'null'], enum: ['true', 'false', null] }
          : field.type === 'retest'
            ? {
                type: ['string', 'null'],
                enum: ['pending', 'satisfactory', 'unsatisfactory', null],
              }
            : field.type === 'integer'
              ? { anyOf: [{ type: 'string', pattern: '^(0|[1-9][0-9]{0,4})$' }, { type: 'null' }] }
              : {
                  anyOf: [
                    { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' },
                    { type: 'null' },
                  ],
                };
      return {
        ...engineItem,
        properties: {
          ...engineItem.properties,
          field_id: { type: 'string', enum: [field.id] },
          value,
        },
      };
    }),
  };
  const judgementItem = properties.judgements.items;
  const fields = activeSections(context.finding.protocol, { version: JUDGEMENT_VERSION }).flatMap(
    (section) => section.fields,
  );
  properties.judgements.items = {
    anyOf: fields.map((field) => {
      const value = field.options
        ? { type: ['string', 'null'], enum: [...field.options, null] }
        : field.type === 'date'
          ? {
              anyOf: [
                { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' },
                { type: 'null' },
              ],
            }
          : field.type === 'number'
            ? { anyOf: [{ type: 'string', pattern: '^[0-9]+$' }, { type: 'null' }] }
            : judgementItem.properties.value;
      return {
        ...judgementItem,
        properties: {
          ...judgementItem.properties,
          field: { type: 'string', enum: [field.key] },
          value,
        },
      };
    }),
  };
  const keys = [...new Set(context.facts.map((fact) => fact.key))];
  schema.$defs = {
    ...schema.$defs,
    sourceKey:
      keys.length <= 200
        ? { type: 'string', enum: keys }
        : {
            type: 'string',
            pattern:
              '^(?:' +
              keys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
              ')$',
          },
  };
  function constrainReferences(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const value = node as Record<string, any>;
    if (value.properties?.source_refs && keys.length)
      value.properties.source_refs.items = { $ref: '#/$defs/sourceKey' };
    for (const child of Object.values(value)) constrainReferences(child);
  }
  constrainReferences(schema);
  return schema;
}
