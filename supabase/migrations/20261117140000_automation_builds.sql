-- Automations that act in a client's own account (Gmail, Calendar, Drive, Sheets…) run through
-- that client's flow in Activepieces, which the office builds. Until it is built the automation
-- waits ("pending") and does not run; when the office marks it built, the client is notified.
alter table public.automations add column build_status text not null default 'ready'
  check (build_status in ('ready', 'pending', 'built'));
alter table public.automations add column build_requested_at timestamptz;
alter table public.automations add column built_at timestamptz;
create index automations_build_pending on public.automations (build_requested_at) where build_status = 'pending';

-- Ready-made meeting templates (emails go out only when the client picks one of these).
insert into public.automation_templates (name, title, saves, category, spec, sort)
select v.name, v.title, v.saves, 'followup', v.spec::jsonb, v.sort
from (values
  ('meeting_confirm_email', 'אישור פגישה במייל ללקוח', 'הלקוח מקבל מייל עם מועד הפגישה מיד אחרי השיחה', 
   '{"trigger":{"type":"meeting_booked","config":{}},"hours":{"mode":"always"},"delay_minutes":0,"agent_id":null,"actions":[{"type":"email_contact","config":{"subject":"הפגישה שלך עם {{business}} נקבעה","text":"שלום {{name}},\nקבענו לך פגישה עם {{business}} ב{{meeting_at}}.\n{{meeting_note}}\nלשינוי או ביטול אפשר פשוט להתקשר אלינו."}}],"instruction":""}', 50),
  ('meeting_team_alert', 'התראה לצוות על פגישה חדשה', 'בעל העסק והצוות מקבלים מייל עם כל פרטי הפגישה', 
   '{"trigger":{"type":"meeting_booked","config":{}},"hours":{"mode":"always"},"delay_minutes":0,"agent_id":null,"actions":[{"type":"notify_team","config":{"text":"נקבעה פגישה עם {{name}} ({{meeting_phone}}) ב{{meeting_at}}.\nמייל: {{email}}\nנושא: {{meeting_note}}\nפרטים: {{meeting_details}}\nנקבע על ידי {{agent}}"}}],"instruction":""}', 51),
  ('meeting_cancel_alert', 'התראה לצוות על ביטול פגישה', 'בעל העסק והצוות מקבלים מייל כשלקוח מבטל פגישה בשיחה', 
   '{"trigger":{"type":"meeting_cancelled","config":{}},"hours":{"mode":"always"},"delay_minutes":0,"agent_id":null,"actions":[{"type":"notify_team","config":{"text":"{{name}} ({{phone}}) ביטל את הפגישה של {{meeting_at}}."}}],"instruction":""}', 52)
) as v(name, title, saves, spec, sort)
where not exists (select 1 from public.automation_templates t where t.name = v.name);
