import {fireEvent,render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PreparedReviewSummary,preparationAttention} from './PreparedReviewSummary';
import type {ManualFinding} from '../lib/manual-api';
import type {ReviewProposal} from '../lib/ai-review-contract';
afterEach(cleanup);
const finding={protocol:{code:'aws-iam',checks:[{id:'iso-DOC-12',label:'Administrative activity logging'}]}} as unknown as ManualFinding;
function proposal(){return {prepared:{checks:[{},{}],sourceKeys:['a','b'],sourceWarnings:[]},output:{summary:'The evidence records partial population coverage.',limitations:[],conflicts:[]}} as unknown as ReviewProposal;}
it('distinguishes a prepared draft from assessment gaps and keeps adoption available',()=>{
 const p=proposal();p.output.limitations=['operation_required: uncited proposed value was left unknown.','operation_requirement: uncited proposed judgement was left unresolved.','iso-DOC-12: no supporting citation was supplied; retained as Not assessed.','The supporting CSV records were not included.'];p.output.conflicts=['Two records give different population counts.'];const apply=vi.fn();
 render(<PreparedReviewSummary finding={finding} proposal={p} disabled={false} onApply={apply}/>);
 expect(screen.getByRole('status').textContent).toBe('Draft prepared');
 expect(screen.getByText('Items needing attention')).toBeTruthy();
 expect(screen.getAllByText('Operating-history requirement: supporting evidence is needed before this can be assessed.')).toHaveLength(1);
 expect(screen.getByText('Administrative activity logging: supporting evidence is needed before this can be assessed.')).toBeTruthy();
 expect(screen.queryByText(/uncited proposed/)).toBeNull();
 expect(screen.getByText('Two records give different population counts.')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Use draft in review'}));expect(apply).toHaveBeenCalledOnce();
 expect(screen.queryByRole('alert')).toBeNull();
 expect(p.output.limitations[0]).toContain('operation_required');
});
it('does not imply closure readiness when preparation has no flagged gaps',()=>{
 render(<PreparedReviewSummary finding={finding} proposal={proposal()} disabled={true} onApply={()=>{}}/>);
 expect(screen.queryByText('Items needing attention')).toBeNull();
 expect(screen.getByText('Ready to use. Review the prepared answers before completing the assessment.')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Use draft in review'}).hasAttribute('disabled')).toBe(true);
});
it('preserves distinct source limitations and conflicts while removing exact duplicates',()=>{
 const p=proposal();p.output.limitations=['Missing attachment.','Missing attachment.','Evidence dates are incomplete.'];p.output.conflicts=['Conflicting dates.','Conflicting dates.'];
 expect(preparationAttention(p,finding)).toEqual({decisions:[],limitations:['Missing attachment.','Evidence dates are incomplete.'],conflicts:['Conflicting dates.']});
});
