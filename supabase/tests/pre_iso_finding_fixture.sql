-- TEST FIXTURE ONLY. Never run this file in the live project.
-- Two separate earlier-version findings support independent desktop/mobile browser checks.
insert into public.cpp_findings(id,organisation_id,created_by,updated_by,lifecycle,details,protocol)
select fixture.id::uuid,'00000000-0000-4000-8000-000000000001',
 '00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','under_review',
 jsonb_build_object('title','Earlier access finding — '||fixture.device,'description','Earlier review created before the ISO checklist was installed.','owner','Fixture owner','severity','Medium','protocol_code','access','account_reference','Test environment','affected_systems','Test identity system','resources','Accounts A and B','approved_baseline','Approved register','root_cause','Missing review','corrective_action','Review all accounts','recurrence_prevention','Assign a review owner','control_reference','','implementation_date',null,'deadline',null),p.definition
from (values('44444444-4444-4444-8444-444444444441','desktop'),('44444444-4444-4444-8444-444444444442','mobile')) fixture(id,device)
cross join public.cpp_protocols p where p.code='access' and p.version='0.1-draft';
insert into public.cpp_reviews(finding_id,organisation_id,finding_revision,reviewer_id,reviewer_name,status,data)
select f.id,f.organisation_id,1,f.created_by,'Prior reviewer','published',
 jsonb_build_object('checks',(select jsonb_agg(jsonb_build_object('check_id',c->>'id','result','unknown','reason','Earlier observation retained for the fixture.','evidence_ids','[]'::jsonb,'source_location','')) from jsonb_array_elements(f.protocol->'checks') c),'recommendation','Not closure ready','recommendation_reason','Earlier evidence was incomplete.','next_status','under_review','independent',false,'independence_notes','','protocol_snapshot',f.protocol,'finding_snapshot',f.details,'evidence_snapshot','[]'::jsonb,'authorship','Earlier fixture review')
from public.cpp_findings f where f.id in ('44444444-4444-4444-8444-444444444441','44444444-4444-4444-8444-444444444442');
