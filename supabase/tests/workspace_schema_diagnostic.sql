-- Read-only schema diagnostic. Does not return customer records or credentials.
select table_name, column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema='public' and table_name in (
 'cp_profiles','cp_organisations','cp_memberships','cp_protocols',
 'cp_findings','cp_evidence','cp_reviews','cp_events',
 'cpw_profiles','cpw_organisations','cpw_memberships','cpw_protocols',
 'cpw_findings','cpw_evidence','cpw_reviews','cpw_events','cpw_legacy_records')
order by table_name,ordinal_position;
