begin;

drop index if exists app.mfa_recovery_user_idx;
drop table if exists app.mfa_recovery_codes;

commit;
