import { z } from 'zod';
import type { EngineDraft } from '@closureproof/assessment-engine/aws-iam';
import type { ManualCheck, ExceptionEntry } from './manual-api';
import type { ClosureJudgement } from '../features/review-judgement';
const refs=z.array(z.string().min(3).max(100));
const rationale=z.string().min(10).max(1500);
export const aiReviewSchema=z.object({
  checklist:z.array(z.object({check_id:z.string().max(150),applicability:z.enum(['yes','no','under_review']),implementation_status:z.enum(['not_assessed','not_implemented','partially_implemented','implemented','not_applicable']),rationale,source_refs:refs})).max(160),
  engine:z.array(z.object({field_id:z.string().max(100),value:z.string().max(200).nullable(),rationale,source_refs:refs})).max(40),
  judgements:z.array(z.object({field:z.string().max(100),value:z.string().max(2000).nullable(),source_refs:refs})).max(60),
  population:z.object({expected:z.number().int().nonnegative().nullable(),reviewed:z.number().int().nonnegative().nullable(),source_refs:refs}),
  exceptions:z.array(z.object({reference:z.string().max(200),description:z.string().max(1500),owner:z.string().max(200),disposition:z.enum(['open','resolved']),evidence_reference:z.string().max(500),closure_impact:z.string().max(1500),source_refs:refs})),
  summary:z.string().min(10).max(2000),next_actions:z.string().max(2000),limitations:z.array(z.string().max(500)).max(20),conflicts:z.array(z.string().max(500)).max(20),
}).strict();
export type AIReviewOutput=z.infer<typeof aiReviewSchema>;
export interface ProposalFact {key:string;runId:string;index:number;evidenceId:string;version:number;sha256:string;filename:string;label:string;value:string;quote:string;locator:string;page:number|null}
export interface PreparedReview {checks:ManualCheck[];engine:EngineDraft;judgement:ClosureJudgement;expected:number|null;reviewed:number|null;exceptions:ExceptionEntry[];conclusion:string;sourceWarnings:string[];nextActions:string;sourceKeys:string[]}
export interface ReviewProposal {id:string;finding_id:string;finding_revision:number;source_fingerprint:string;model:string;created_at:string;status:'ready';output:AIReviewOutput;prepared:PreparedReview;facts:ProposalFact[]}
export interface AppliedReviewProposal {id:string;source_fingerprint:string;reviewer:string;applied_at:string}
export interface ReviewProposalSnapshot extends AppliedReviewProposal {model:string;generated_at:string;proposal_hash:string;limitations:string[];conflicts:string[];source_keys:string[]}

export interface ReviewPreparationProgress {status:"processing";id:string;completedBatches:number;totalBatches:number}
export type ReviewPreparationResult=ReviewProposal|ReviewPreparationProgress;
