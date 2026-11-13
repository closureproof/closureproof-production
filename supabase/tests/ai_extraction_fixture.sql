-- TEST ONLY. Loaded by the isolated contract emulator, never the live migration.
create or replace function public.cpp_test_ai_report() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=gen_random_uuid(); payload jsonb; fields jsonb; result jsonb;
begin
 fields:=jsonb_build_object('title','Access reviews omitted privileged accounts','description','The quarterly access review omitted five privileged accounts.','control_reference','A.5.18','severity',null,'owner',null,'account_reference',null,'affected_systems',null,'resources',null,'approved_baseline',null,'root_cause',null,'corrective_action',null,'recurrence_prevention',null,'implementation_date',null,'deadline',null);
 result:=jsonb_build_object('coverage','readable_text','limitations','[]'::jsonb,'facts','[]'::jsonb,'findings',jsonb_build_array(jsonb_build_object('fields',fields,'sources',jsonb_build_array(jsonb_build_object('field','title','quote','The quarterly access review omitted five privileged accounts.','locator','Finding 1','page',2),jsonb_build_object('field','description','quote','The quarterly access review omitted five privileged accounts.','locator','Finding 1','page',2),jsonb_build_object('field','control_reference','quote','A.5.18','locator','Finding 1 control','page',2)))));
 insert into public.cpp_ai_runs(id,request_id,request_fingerprint,mode,filename,mime,byte_size,sha256,storage_path,status,model,result) values(uid,uid,'fixture','report','audit-report.pdf','application/pdf',24,repeat('a',64),'ai-sources/'||uid||'/original.pdf','ready','test-provider',result) returning to_jsonb(cpp_ai_runs.*) into payload;
 return payload||jsonb_build_object('confirmations','[]'::jsonb,'submissions','[]'::jsonb);
end; $$;
create or replace function public.cpp_test_ai_evidence() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=gen_random_uuid(); fid uuid; upload jsonb; payload jsonb; result jsonb;details jsonb;
begin
 details:=jsonb_build_object('title','AI evidence review fixture','description','The access population needs reconciliation.','owner','IT owner','severity','Medium','protocol_code','access','account_reference','Production identity service','affected_systems','Production','resources','Accounts A and B','control_reference','A.5.18','approved_baseline','','root_cause','','corrective_action','','recurrence_prevention','');
 fid:=public.cpp_create_scoped_finding('00000000-0000-4000-8000-000000000001'::uuid,details,'{"version":"1.0-control-scope","control_ids":["A.5.18"],"unknown_reason":"","additional_task_ids":[],"excluded_tasks":{},"additional_modules":[],"excluded_modules":{}}'::jsonb);
 upload:=public.cpp_begin_upload(fid,1,jsonb_build_object('filename','access-review.pdf','mime','application/pdf','size',24,'sha256',repeat('a',64)),jsonb_build_object('evidence_type','Access review','source_system','Identity platform','source_account','Production','covered_resources','User population','description','A source document for the selected access review.'));
 insert into storage.objects(bucket_id,name,metadata) values('closureproof-pilot-evidence',upload->>'path','{"size":24,"mimetype":"application/pdf"}'::jsonb);
 perform public.cpp_finalize_upload((upload->>'id')::uuid,1);
 result:='{"coverage":"readable_text","limitations":[],"findings":[],"facts":[{"label":"Reviewed population","value":"121 accounts","quote":"121 accounts were reviewed.","locator":"Access review summary","page":1}]}'::jsonb;
 insert into public.cpp_ai_runs(id,request_id,request_fingerprint,mode,finding_id,finding_revision,evidence_id,evidence_version,filename,mime,byte_size,sha256,storage_path,status,model,result) values(uid,uid,'fixture','evidence',fid,2,(upload->>'id')::uuid,1,'access-review.pdf','application/pdf',24,repeat('a',64),upload->>'path','ready','test-provider',result) returning to_jsonb(cpp_ai_runs.*) into payload;
 return payload||jsonb_build_object('confirmations','[]'::jsonb,'submissions','[]'::jsonb);
end; $$;
create or replace function public.cpp_test_ai_confirmation(p_run uuid,p_confirmation jsonb) returns jsonb language sql security definer set search_path='' as $$select public.cpp_ai_record_confirmation(p_run,p_confirmation)$$;
grant execute on function public.cpp_test_ai_report(),public.cpp_test_ai_evidence(),public.cpp_test_ai_confirmation(uuid,jsonb) to anon;
-- TEST ONLY: a report with two independent extracted findings.
create or replace function public.cpp_test_ai_multi_report() returns jsonb language plpgsql security definer set search_path='' as $$
declare seed jsonb; uid uuid:=gen_random_uuid(); first_finding jsonb; second_finding jsonb; result jsonb; payload jsonb;
begin
 seed:=public.cpp_test_ai_report();first_finding:=seed#>'{result,findings,0}';
 second_finding:=jsonb_set(jsonb_set(jsonb_set(first_finding,'{fields,title}','"Backup restoration test omitted a workload"'),'{fields,description}','"The reporting workload has no restoration test evidence."'),'{fields,control_reference}','"A.8.13"');
 second_finding:=jsonb_set(second_finding,'{sources}','[{"field":"title","quote":"Backup restoration test omitted a workload","locator":"Finding 2","page":3},{"field":"description","quote":"The reporting workload has no restoration test evidence.","locator":"Finding 2","page":3},{"field":"control_reference","quote":"A.8.13","locator":"Finding 2 control","page":3}]'::jsonb);
 result:=jsonb_set(seed->'result','{findings}',jsonb_build_array(first_finding,second_finding));
 insert into public.cpp_ai_runs(id,request_id,request_fingerprint,mode,filename,mime,byte_size,sha256,storage_path,status,model,result) values(uid,uid,'fixture','report','two-findings-audit.pdf','application/pdf',24,repeat('a',64),'ai-sources/'||uid||'/original.pdf','ready','test-provider',result) returning to_jsonb(cpp_ai_runs.*) into payload;
 return payload||jsonb_build_object('confirmations','[]'::jsonb,'submissions','[]'::jsonb);
end$$;
grant execute on function public.cpp_test_ai_multi_report() to anon;

-- TEST ONLY: cited claims supporting a complete prepared review, without real data.
create or replace function public.cpp_test_ai_prepared_review(p_title text default 'AI prepared access review') returns jsonb language plpgsql security definer set search_path='' as $$
declare seed jsonb;r public.cpp_ai_runs;result jsonb;
begin
 seed:=public.cpp_test_ai_evidence();select * into r from public.cpp_ai_runs where id=(seed->>'id')::uuid;
 -- Replace only this new synthetic seed before test exposure; production immutability stays enforced.
 delete from public.cpp_ai_runs where id=r.id;
 result:=jsonb_set(r.result,'{facts,0,value}','"Synthetic records establish 121 expected and reviewed accounts, approved entitlements, completed corrective actions, no outstanding exceptions, and a documented basis for no operating-history or independent-retest requirement."');
 result:=jsonb_set(result,'{facts,0,quote}','"121 accounts reviewed against approved entitlements; corrective access changes completed; no outstanding exceptions; documented one-time correction requires no further operating period or independent retest."');
 update public.cpp_findings set details=jsonb_set(details,'{title}',to_jsonb(p_title)) where id=r.finding_id;
 insert into public.cpp_ai_runs(id,request_id,request_fingerprint,mode,finding_id,finding_revision,evidence_id,evidence_version,filename,mime,byte_size,sha256,storage_path,status,model,result) values(r.id,r.request_id,r.request_fingerprint,r.mode,r.finding_id,r.finding_revision,r.evidence_id,r.evidence_version,r.filename,r.mime,r.byte_size,r.sha256,r.storage_path,'ready','test-provider',result);
 return (select to_jsonb(x.*)||jsonb_build_object('confirmations','[]'::jsonb,'submissions','[]'::jsonb) from public.cpp_ai_runs x where x.id=r.id);
end$$;
grant execute on function public.cpp_test_ai_prepared_review(text) to anon;
