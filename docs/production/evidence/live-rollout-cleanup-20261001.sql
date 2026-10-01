select
 (select count(*) from auth.users) as auth_users,
 (select count(*) from public.profiles) as profiles,
 (select count(*) from auth.users where email like 'twl-rollout-%@example.invalid' or raw_user_meta_data ? 'twl_rollout_run') as residual_test_users,
 (select count(*) from public.twl_accounts) as twl_accounts,
 (select count(*) from public.twl_request_receipts) as twl_receipts,
 (select count(*) from auth.users where raw_app_meta_data->>'twl_access' = 'closed-beta') as enrolled_accounts,
 (select jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'anon_select',has_table_privilege('anon',c.oid,'select'),'auth_select',has_table_privilege('authenticated',c.oid,'select'),'service_select',has_table_privilege('service_role',c.oid,'select')) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('twl_accounts','twl_request_receipts')) as twl_tables,
 (select jsonb_agg(jsonb_build_object('function',p.proname,'security_definer',p.prosecdef,'config',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'execute'),'auth_execute',has_function_privilege('authenticated',p.oid,'execute'),'service_execute',has_function_privilege('service_role',p.oid,'execute')) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('twl_read_account','twl_initialize_account','twl_commit_account')) as twl_functions;
