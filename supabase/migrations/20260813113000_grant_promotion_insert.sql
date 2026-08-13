-- The promotion RPC is SECURITY INVOKER and its final audit insert must remain
-- subject to the existing owner RLS policy. Grant only the missing table privilege.

grant insert on public.training_session_prescription_promotions to authenticated;
