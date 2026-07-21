-- Storage for uploaded .gcode / .3mf / .stl files attached to a job.
--
-- Private bucket. These are student coursework and the dashboard is staff-only;
-- nothing here should be reachable without a session.

insert into storage.buckets (id, name, public, file_size_limit)
values ('job-files', 'job-files', false, 209715200)  -- 200 MB
on conflict (id) do nothing;

-- No allowed_mime_types filter on purpose: browsers report .gcode and .3mf
-- inconsistently (often application/octet-stream or an empty string), so a
-- mime allowlist rejects legitimate uploads. The size cap is the real guard.

-- Same rule as every other table: any active staff member, nobody else.
-- storage.objects already has RLS enabled by Supabase.
create policy "staff read job files" on storage.objects
  for select using (bucket_id = 'job-files' and public.is_staff());

create policy "staff upload job files" on storage.objects
  for insert with check (bucket_id = 'job-files' and public.is_staff());

create policy "staff update job files" on storage.objects
  for update using (bucket_id = 'job-files' and public.is_staff())
  with check (bucket_id = 'job-files' and public.is_staff());

-- Deleting the file does not delete the job or its attempts. The job keeps its
-- file_path, which will simply resolve to nothing -- acceptable, because the
-- print history is the record that matters, not the source file.
create policy "staff delete job files" on storage.objects
  for delete using (bucket_id = 'job-files' and public.is_staff());
