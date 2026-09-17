-- Onda 2 — Secretaria: reuniões e atas (minuta, transcrição e anexos; áudio em app.attachments).

begin;

create table if not exists app.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null default '' check (char_length(title) <= 200),
  meeting_date date not null,
  place text not null default '' check (char_length(place) <= 200),
  chair text not null default '' check (char_length(chair) <= 160),
  secretary text not null default '' check (char_length(secretary) <= 160),
  status text not null,
  participants text not null default '' check (char_length(participants) <= 4000),
  agenda text not null default '' check (char_length(agenda) <= 4000),
  transcript text not null default '' check (char_length(transcript) <= 100000),
  decisions text not null default '' check (char_length(decisions) <= 8000),
  minutes text not null default '' check (char_length(minutes) <= 100000),
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.meetings to lar_app;

alter table app.meetings add constraint meetings_status_check check (status in ('Rascunho','Ata concluída'));
create index if not exists meetings_date on app.meetings (meeting_date desc);

commit;
