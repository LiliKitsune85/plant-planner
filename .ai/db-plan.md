# Plant Planner — PostgreSQL (Supabase) DB schema plan (MVP)

Poniższy dokument opisuje docelowy schemat bazy danych Postgres dla MVP (Supabase). Jest to plan gotowy jako podstawa do przygotowania migracji.

## 1. Lista tabel z ich kolumnami, typami danych i ograniczeniami

### 1.1 Wymagane rozszerzenia (extensions)

- `pgcrypto` — dla `gen_random_uuid()`

### 1.2 Typy (ENUM)

> Nazwy enum w `public`, aby dobrze działały z typami generowanymi przez Supabase.

- `public.plant_created_source`:
  - `'manual'`
  - `'import'` (na przyszłość; w MVP nieużywane)
- `public.watering_task_status`:
  - `'pending'`
  - `'completed'`
- `public.watering_task_source`:
  - `'scheduled'`
  - `'adhoc'`
- `public.watering_schedule_basis`:
  - `'due_on'` (kolejny termin liczony od planowanej daty)
  - `'completed_on'` (kolejny termin liczony od faktycznego wykonania)
- `public.watering_plan_start_from`:
  - `'today'`
  - `'purchase_date'`
  - `'custom_date'`
- `public.watering_overdue_policy`:
  - `'carry_forward'` (zadanie zaległe pozostaje aż do wykonania)
  - `'reschedule'` (system może przepinać zaległości na „dziś”; logika w RPC)
- `public.ai_request_status`:
  - `'success'`
  - `'error'`
  - `'rate_limited'`
  - `'skipped'` (np. użytkownik dodał roślinę bez generowania planu)

### 1.3 Funkcje pomocnicze (do constraints / generated columns)

#### `public.normalize_species_name(input text) returns text` (IMMUTABLE)

- Cel: spójna normalizacja nazwy gatunku (bez zależności od `unaccent`, aby wyrażenie mogło być IMMUTABLE i użyte w kolumnie GENERATED).
- Zalecana implementacja:
  - `lower(trim(input))`
  - zamiana wielokrotnych białych znaków na pojedynczą spację (`regexp_replace(..., '\s+', ' ', 'g')`)

### 1.4 Tabela `public.profiles` (1:1 z `auth.users`)

> Konto (e-mail/hasło) trzymane jest w `auth.users`. Profil w `public.profiles` przechowuje dane aplikacyjne.

- `user_id uuid` **PK**, **FK** → `auth.users(id)` **ON DELETE CASCADE**
- `nickname varchar(60)` NULL
  - pseudonim nie musi być unikalny (unikalny jest e-mail w Supabase Auth)
- `timezone varchar(64)` **NOT NULL** DEFAULT `'UTC'`
- `created_at timestamptz` **NOT NULL** DEFAULT `now()`
- `updated_at timestamptz` **NOT NULL** DEFAULT `now()`

Ograniczenia:
- `CHECK (char_length(timezone) BETWEEN 1 AND 64)`
- `CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 1 AND 60)`

Uwagi:
- Walidacja poprawności strefy czasowej (np. czy istnieje w `pg_timezone_names`) może być wymuszona w warstwie aplikacji lub przez dodatkową funkcję/constraint w migracji (opcjonalnie).

### 1.5 Tabela `public.plants` (kolekcja roślin użytkownika)

- `id uuid` **PK** DEFAULT `gen_random_uuid()`
- `user_id uuid` **NOT NULL**, **FK** → `auth.users(id)` **ON DELETE CASCADE**
- `species_name varchar(120)` **NOT NULL**
  - nazwa gatunku; w MVP **niezmienna po utworzeniu** (patrz: uwagi o triggerze)
- `species_name_normalized varchar(120)` **GENERATED ALWAYS AS** `(normalize_species_name(species_name)) STORED`
- `duplicate_index int` **NOT NULL** DEFAULT `0`
  - numer duplikatu tej samej znormalizowanej nazwy per użytkownik; może mieć „dziury”
- `nickname varchar(80)` NULL
- `description text` NULL
- `purchase_date date` NULL
- `photo_path text` NULL
  - ścieżka do pliku w Supabase Storage (bez metadanych zdjęcia w MVP)
- `created_source public.plant_created_source` **NOT NULL** DEFAULT `'manual'`
- `created_at timestamptz` **NOT NULL** DEFAULT `now()`
- `updated_at timestamptz` **NOT NULL** DEFAULT `now()`

Ograniczenia:
- `CHECK (duplicate_index >= 0)`
- `CHECK (char_length(species_name) BETWEEN 1 AND 120)`
- `CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 1 AND 80)`
- `UNIQUE (user_id, species_name_normalized, duplicate_index)`

### 1.6 Tabela `public.watering_plans` (wersjonowane plany podlewania)

> Reguła cykliczności jest w `watering_plans`, a kalendarz to materializowane zadania w `watering_tasks`.

- `id uuid` **PK** DEFAULT `gen_random_uuid()`
- `user_id uuid` **NOT NULL**, **FK** → `auth.users(id)` **ON DELETE CASCADE**
- `plant_id uuid` **NOT NULL**, **FK** → `public.plants(id)` **ON DELETE CASCADE**

Parametry harmonogramu (MVP):
- `interval_days int` **NOT NULL**
- `horizon_days smallint` **NOT NULL** DEFAULT `90`
- `schedule_basis public.watering_schedule_basis` **NOT NULL** DEFAULT `'completed_on'`
- `start_from public.watering_plan_start_from` **NOT NULL** DEFAULT `'today'`
- `custom_start_on date` NULL
- `overdue_policy public.watering_overdue_policy` **NOT NULL** DEFAULT `'carry_forward'`

Wersjonowanie i stan:
- `is_active boolean` **NOT NULL** DEFAULT `true`
- `valid_from timestamptz` **NOT NULL** DEFAULT `now()`
- `valid_to timestamptz` NULL

Metryki AI (bez przechowywania uzasadnienia/źródeł z LLM):
- `was_ai_suggested boolean` **NOT NULL** DEFAULT `false`
- `was_ai_accepted_without_changes boolean` NULL
- `ai_request_id uuid` NULL, **FK** → `public.ai_requests(id)` **ON DELETE SET NULL**

Systemowe:
- `created_at timestamptz` **NOT NULL** DEFAULT `now()`
- `updated_at timestamptz` **NOT NULL** DEFAULT `now()`

Ograniczenia:
- `CHECK (interval_days BETWEEN 1 AND 365)`
- `CHECK (horizon_days BETWEEN 1 AND 365)`
- `CHECK ((start_from = 'custom_date' AND custom_start_on IS NOT NULL) OR (start_from <> 'custom_date' AND custom_start_on IS NULL))`
- `CHECK ((is_active AND valid_to IS NULL) OR (NOT is_active AND valid_to IS NOT NULL))`
- Wymuszenie maks. jednego aktywnego planu na roślinę:
  - **PARTIAL UNIQUE**: `UNIQUE (plant_id) WHERE (is_active)`

Uwagi:
- Zmiana planu w MVP powinna tworzyć nowy rekord planu (wersja), wyłączać poprzedni (`is_active=false`, `valid_to=now()`) i regenerować przyszłe niewykonane zadania w transakcji (RPC).

### 1.7 Tabela `public.watering_tasks` (materializowane zadania podlewania)

> Zadania generowane na 90 dni do przodu dla aktywnego planu; edycje/uzupełnianie/regeneracja wyłącznie „przyszłych niewykonanych”.

- `id uuid` **PK** DEFAULT `gen_random_uuid()`
- `user_id uuid` **NOT NULL**, **FK** → `auth.users(id)` **ON DELETE CASCADE**
- `plant_id uuid` **NOT NULL**, **FK** → `public.plants(id)` **ON DELETE CASCADE**
- `plan_id uuid` NULL, **FK** → `public.watering_plans(id)` **ON DELETE CASCADE**
  - `NULL` dopuszczalne dla `source='adhoc'`
- `due_on date` **NOT NULL**
  - termin jako „dzień” (bez godziny), w lokalnym kalendarzu użytkownika
- `status public.watering_task_status` **NOT NULL** DEFAULT `'pending'`
- `source public.watering_task_source` **NOT NULL** DEFAULT `'scheduled'`
- `note text` NULL
- `completed_at timestamptz` NULL
- `completed_on date` NULL
  - lokalny dzień w momencie potwierdzenia (deterministyczny zapis do przeliczeń)
- `created_at timestamptz` **NOT NULL** DEFAULT `now()`
- `updated_at timestamptz` **NOT NULL** DEFAULT `now()`

Ograniczenia:
- Unikalność: max 1 zadanie na roślinę na dzień:
  - `UNIQUE (plant_id, due_on)`
- Spójność statusu i pól completion:
  - `CHECK ((status = 'completed' AND completed_at IS NOT NULL AND completed_on IS NOT NULL) OR (status = 'pending' AND completed_at IS NULL AND completed_on IS NULL))`
- Spójność źródła:
  - `CHECK (source <> 'adhoc' OR status = 'completed')`
  - `CHECK (source <> 'scheduled' OR plan_id IS NOT NULL)`
  - `CHECK (source <> 'adhoc' OR due_on = completed_on)`

Uwagi:
- Ad-hoc podlewanie: zapis jako rekord `source='adhoc'`, `status='completed'`, z ustawionym `completed_at`/`completed_on` i `due_on=completed_on`. Taki wpis stanowi nową bazę do przeliczeń harmonogramu.

### 1.8 Tabela `public.ai_requests` (audyt i limitowanie AI)

> Źródło prawdy do limitu 20 zapytań/h per użytkownik. INSERT wyłącznie serwerowo (edge/backend), nie z klienta.

- `id uuid` **PK** DEFAULT `gen_random_uuid()`
- `user_id uuid` **NOT NULL**, **FK** → `auth.users(id)` **ON DELETE CASCADE**
- `plant_id uuid` NULL, **FK** → `public.plants(id)` **ON DELETE SET NULL**
- `requested_at timestamptz` **NOT NULL** DEFAULT `now()`
- `provider text` **NOT NULL** DEFAULT `'openrouter'`
- `model text` NULL
- `status public.ai_request_status` **NOT NULL**
- `latency_ms int` NULL
- `prompt_tokens int` NULL
- `completion_tokens int` NULL
- `total_tokens int` NULL
- `error_code text` NULL
- `error_message text` NULL
- `created_at timestamptz` **NOT NULL** DEFAULT `now()`

Ograniczenia:
- `CHECK (latency_ms IS NULL OR latency_ms >= 0)`
- `CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0)`
- `CHECK (completion_tokens IS NULL OR completion_tokens >= 0)`
- `CHECK (total_tokens IS NULL OR total_tokens >= 0)`

## 2. Relacje między tabelami

- `auth.users (1) — (1) public.profiles`
  - `profiles.user_id` PK/FK → `auth.users.id`
- `auth.users (1) — (N) public.plants`
  - `plants.user_id` → `auth.users.id`
- `public.plants (1) — (N) public.watering_plans`
  - `watering_plans.plant_id` → `plants.id`
- `public.plants (1) — (N) public.watering_tasks`
  - `watering_tasks.plant_id` → `plants.id`
- `public.watering_plans (1) — (N) public.watering_tasks`
  - `watering_tasks.plan_id` → `watering_plans.id` (NULL dla ad-hoc)
- `auth.users (1) — (N) public.ai_requests`
  - `ai_requests.user_id` → `auth.users.id`
- `public.plants (1) — (N) public.ai_requests` (opcjonalnie)
  - `ai_requests.plant_id` → `plants.id` (NULL przy braku kontekstu rośliny)
- `public.ai_requests (1) — (N) public.watering_plans` (opcjonalnie)
  - `watering_plans.ai_request_id` → `ai_requests.id` (ON DELETE SET NULL)

Kardynalność:
- 1 użytkownik ma wiele roślin.
- 1 roślina ma wiele planów (wersje), ale **maksymalnie 1 aktywny plan naraz**.
- 1 roślina ma wiele zadań, ale **maksymalnie 1 zadanie na dzień**.

## 3. Indeksy

### 3.1 `public.plants`

- Wyszukiwanie i listowanie kolekcji:
  - `INDEX plants_user_created_at_idx ON plants (user_id, created_at DESC)`
- Duplikaty nazw / filtrowanie po gatunku:
  - `INDEX plants_user_species_norm_idx ON plants (user_id, species_name_normalized)`
- Unikalność duplikatów (constraint):
  - `UNIQUE (user_id, species_name_normalized, duplicate_index)`

### 3.2 `public.watering_plans`

- Szybkie pobieranie aktywnego planu rośliny:
  - `INDEX watering_plans_plant_active_idx ON watering_plans (plant_id) WHERE (is_active)`
- Historia wersji:
  - `INDEX watering_plans_plant_valid_from_idx ON watering_plans (plant_id, valid_from DESC)`
- Wymuszenie 1 aktywnego planu:
  - `UNIQUE (plant_id) WHERE (is_active)`

### 3.3 `public.watering_tasks`

> Indeksy pod kalendarz (widok miesięczny: count(*) grupowane po `due_on`, oraz widok dzienny: lista zadań na dzień).

- `INDEX watering_tasks_user_due_on_idx ON watering_tasks (user_id, due_on)`
- `INDEX watering_tasks_plant_due_on_idx ON watering_tasks (plant_id, due_on)`
- `INDEX watering_tasks_user_status_due_on_idx ON watering_tasks (user_id, status, due_on)`
- (opcjonalnie) szybkie pobieranie „do zrobienia”:
  - `INDEX watering_tasks_user_due_on_pending_idx ON watering_tasks (user_id, due_on) WHERE (status = 'pending')`

### 3.4 `public.ai_requests`

- Limitowanie 20/h i raportowanie:
  - `INDEX ai_requests_user_requested_at_idx ON ai_requests (user_id, requested_at DESC)`
  - (opcjonalnie) `INDEX ai_requests_user_status_requested_at_idx ON ai_requests (user_id, status, requested_at DESC)`

## 4. Zasady PostgreSQL (RLS) — Supabase

Zasada: **default deny** (włączyć RLS na tabelach tenantowych i dodać tylko konieczne polityki). `user_id` jest zdenormalizowane w każdej tabeli tenantowej dla prostych i szybkich polityk.

> Uwaga: decyzje projektowe zakładają, że **mutacje krytyczne** (w szczególności `watering_tasks`, a docelowo także `watering_plans`) są wykonywane przez **RPC** (funkcje w transakcjach, idempotencja), a klient ma ograniczony dostęp.

### 4.1 `public.profiles`

- **SELECT**: tylko właściciel
- **INSERT/UPDATE**: tylko właściciel (jeśli pozwalamy klientowi zarządzać profilem)

Przykładowe polityki (do migracji):

```sql
alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = user_id);

create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### 4.2 `public.plants`

- **SELECT**: tylko właściciel
- **INSERT**: tylko właściciel
- **UPDATE**: tylko właściciel (z zastrzeżeniem: `species_name` w MVP niezmienne — wymusić triggerem)
- **DELETE**: tylko właściciel (lub przez RPC)

```sql
alter table public.plants enable row level security;

create policy "plants_select_own"
on public.plants for select
using (auth.uid() = user_id);

create policy "plants_insert_own"
on public.plants for insert
with check (auth.uid() = user_id);

create policy "plants_update_own"
on public.plants for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "plants_delete_own"
on public.plants for delete
using (auth.uid() = user_id);
```

### 4.3 `public.watering_plans`

- **SELECT**: tylko właściciel
- **INSERT/UPDATE/DELETE**: zalecane wyłącznie przez RPC (brak polityk dla klienta)

```sql
alter table public.watering_plans enable row level security;

create policy "watering_plans_select_own"
on public.watering_plans for select
using (auth.uid() = user_id);
```

### 4.4 `public.watering_tasks`

- **SELECT**: tylko właściciel
- **INSERT/UPDATE/DELETE**: brak bezpośredniego dostępu z klienta (tylko RPC / service role)

```sql
alter table public.watering_tasks enable row level security;

create policy "watering_tasks_select_own"
on public.watering_tasks for select
using (auth.uid() = user_id);
```

### 4.5 `public.ai_requests`

- **INSERT**: wyłącznie serwerowo (brak polityki INSERT dla klienta)
- **SELECT**: opcjonalnie tylko właściciel (jeśli UI ma pokazywać wykorzystanie / czas odblokowania)

```sql
alter table public.ai_requests enable row level security;

create policy "ai_requests_select_own"
on public.ai_requests for select
using (auth.uid() = user_id);
```

## 5. Dodatkowe uwagi / decyzje projektowe

- **Uzasadnienie/źródło z LLM**: PRD zakłada, że rekomendacja ma krótkie uzasadnienie/źródło, ale decyzja architektoniczna MVP to **nie przechowywać** tego w DB. Uzasadnienie może być wyświetlone użytkownikowi z odpowiedzi AI, a następnie odrzucone; w DB zapisujemy tylko metryki (`was_ai_suggested`, `was_ai_accepted_without_changes`) i ewentualnie referencję do `ai_requests`.
- **Duplikaty nazw gatunku**: numerowanie per użytkownik przez `duplicate_index` + unikalność `(user_id, species_name_normalized, duplicate_index)`; dopuszczalne „dziury” (bez renumeracji).
- **Czas**: zadania są „na dzień” → `due_on date`; wykonanie → `completed_at timestamptz` + `completed_on date` (lokalny dzień w momencie potwierdzenia) dla deterministycznych przeliczeń.
- **Regeneracja harmonogramu**: po zmianie planu lub po ad-hoc / edycji ostatniego wykonanego zadania system usuwa i odtwarza **tylko przyszłe niewykonane** zadania w transakcji, dla horyzontu `horizon_days` (domyślnie 90).
- **Integralność tenantowa**: zalecane jest dopięcie triggerów, które:
  - ustawiają/egzekwują `user_id` w `watering_plans` i `watering_tasks` na podstawie `plant_id`,
  - uniemożliwiają zmianę `plants.species_name` (w MVP),
  - utrzymują `updated_at` (standardowy trigger).
- **Usuwanie danych (RODO)**: twarde kasowanie z FK `ON DELETE CASCADE` spełnia wymóg „natychmiast”. Pliki w Supabase Storage należy czyścić serwisowo (RPC/service role).

