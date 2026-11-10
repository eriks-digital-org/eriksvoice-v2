-- Voice mode: '' = custom pipeline (LLM + speech model), otherwise an Eleven Realtime model.
alter table public.agent_types
  add column realtime_model text not null default ''
    check (realtime_model in ('', 'eleven_realtime_v1_mini', 'eleven_realtime_v1_max'));

-- Per-agent override: null = follow the type, 'custom' = force the custom pipeline.
alter table public.agents
  add column realtime_model_override text
    check (realtime_model_override in ('custom', 'eleven_realtime_v1_mini', 'eleven_realtime_v1_max'));
-- (No client grant: the voice mode is admin-only.)
