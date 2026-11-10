-- Which widgets an admin sees on the admin home page, in order (null = the default set).
alter table public.profiles add column home_widgets text[];
