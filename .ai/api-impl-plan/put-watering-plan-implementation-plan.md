# API Endpoint Implementation Plan: PUT /api/plants/{plantId}/watering-plan

## 1. Przegląd punktu końcowego
- Umożliwia ustawienie bieżącego planu podlewania dla wskazanej rośliny poprzez utworzenie nowej wersji rekordu w `public.watering_plans`, dezaktywację poprzedniej wersji i regenerację przyszłych zadań w `public.watering_tasks`.
- Obsługuje zarówno ręczne konfiguracje, jak i plany zaakceptowane/odrzucone po rekomendacji AI (metryki `was_ai_*`, `ai_request_id`).
- Zwraca szczegóły nowego aktywnego planu oraz zakres i liczbę ponownie wygenerowanych zadań.

## 2. Szczegóły żądania
- Metoda HTTP: `PUT`
- Struktura URL: `/api/plants/{plantId}/watering-plan`
- Nagłówki: `Authorization: Bearer <JWT>` (wymagany), `Content-Type: application/json`
- Parametry:
  - Wymagane (path): `plantId` – UUID rośliny, walidowany przez `z.string().uuid()`.
- Request body (`SetWateringPlanCommand` odwzorowane na `SetWateringPlanPayloadSchema`):
  - `interval_days` *(required, int)* – 1..365 (`CHECK` w DB).
  - `horizon_days` *(optional, int)* – 1..365, domyślnie 90 jeśli brak w payload.
  - `schedule_basis` *(required, enum)* – wartości zgodne z `public.watering_schedule_basis` (np. `completed_on`, `due_on`); walidacja przez `z.enum`.
  - `start_from` *(required, enum)* – np. `today`, `custom_date`; gdy `custom_date`, `custom_start_on` staje się wymagane.
  - `custom_start_on` *(conditional, ISO date string)* – wymagane tylko dla `start_from="custom_date"`, w innym wypadku musi być `null`.
  - `overdue_policy` *(required, enum)* – zgodny z `public.watering_overdue_policy`.
  - `source` *(required, union `WateringPlanSourceCommand`)*:
    - `type="ai"` → wymagane `ai_request_id` (UUID istniejącego rekordu użytkownika) i `accepted_without_changes` (boolean).
    - `type="manual"` → `ai_request_id` musi być `null`, flaga `accepted_without_changes` niedozwolona.
- Walidacja dodatkowa:
  - `duplicate_index` / `species_name` zmianie nie podlegają – endpoint tylko odwołuje się do rośliny.
  - Spójność zakresów dat: `custom_start_on` w przeszłości/płaszczyźnie jest dozwolona zgodnie z regułami biznesowymi, ale dopasowana do typu `date`.

## 3. Szczegóły odpowiedzi
- Kod powodzenia: `200 OK`.
- Payload: standardowa obwiednia `{ data, error, meta }`.
  - `data.plan`: `SetWateringPlanResultDto['plan']` (czyli `WateringPlanSummaryDto`) – pola stanu + konfiguracja + metadane AI.
  - `data.tasks_regenerated`: `TasksRegeneratedSummary` – daty `from`, `to`, liczba wpisów.
  - `error`: `null` przy sukcesie, w pozostałych przypadkach obiekt błędu z `code`/`message`.
  - `meta`: rezerwowe (tu puste).
- Brak tworzenia nowego zasobu ⇒ status 200 zamiast 201.

## 4. Przepływ danych
1. **Middleware/auth** – `src/middleware/index.ts` zapewnia osadzenie `supabase` oraz `locals.session`. Endpoint rozpoczyna od walidacji obecności sesji.
2. **Parsowanie wejścia** – `plantId` z path, body walidowane przez Zod. Wszelkie błędy → `422`.
3. **Wyodrębnienie logiki serwisowej** – nowy moduł `src/lib/services/watering-plans/set-watering-plan.ts` wystawiający funkcję `setPlantWateringPlan(supabase, userId, plantId, command)`.
4. **Pobranie rośliny** – serwis wykonuje `select` na `plants` filtrując `id = plantId` i `user_id = userId`. Brak wyniku → `404`.
5. **Sprawdzenie aktywnego planu** – `select ... from watering_plans where plant_id = :plantId and is_active limit 1`.
6. **Transakcja** (wykonywana w Postgresie poprzez RPC lub dedykowaną funkcję SQL, np. `rpc('set_watering_plan_version', {...})`):
   - Aktualizacja poprzedniego planu: `is_active=false`, `valid_to=now()`.
   - Wstawienie nowego rekordu `watering_plans` z polami z `command` + `was_ai_suggested` (na podstawie `source.type`), `was_ai_accepted_without_changes`.
   - Zwrócenie nowego `plan_id`.
7. **Regeneracja zadań** – wywołanie `rpc('regenerate_watering_tasks', { plant_id, user_id, horizon_days })`, które:
   - Usuwa przyszłe `pending` zadania związane z rośliną.
   - Tworzy zadania zgodne z nowym planem na horyzont (90 dni domyślnie).
   - Zwraca zakres dat i liczbę wygenerowanych rekordów.
8. **Złożenie DTO** – mapowanie rekordów DB na `WateringPlanSummaryDto`/`TasksRegeneratedSummary`.
9. **Zwrócenie odpowiedzi** – 200 + envelope; ewentualne błędy transakcji mapowane na `409` (konflikt planów) lub `500`.

## 5. Względy bezpieczeństwa
- Uwierzytelnienie: wymagane ważne JWT Supabase; brak sesji → `401`.
- Autoryzacja zasobów: dodatkowa walidacja `user_id` rośliny oraz ewentualnego `ai_request_id` (musi należeć do tego samego użytkownika), mimo że RLS w Supabase również zabezpiecza odczyty/zapisy.
- Walidacja parametrów zapobiega SQL injection (używamy zapytań parametryzowanych Supabase) oraz błędom logiki harmonogramu.
- Sterowanie konkurencją: korzystamy z `unique (plant_id) where is_active` + transakcji/locków, aby uniknąć dwóch aktywnych planów.
- Dane wrażliwe (np. `ai_request_id`) nie są ujawniane poza autoryzowanym użytkownikiem.
- Logowanie błędów: przy `catch` odwołujemy się do wspólnego loggera (np. `logger.error` lub `supabase.rpc('log_api_error', {...})` jeśli istnieje tabela audytowa) z informacjami o użytkowniku, plantId i kodzie błędu bez danych payloadu.

## 6. Obsługa błędów
- `401 UNAUTHENTICATED` – brak/niepoprawny token; zwracany przed walidacją body.
- `404 NOT_FOUND` – roślina nie istnieje lub nie należy do użytkownika; jednolity komunikat.
- `422 VALIDATION_ERROR` – naruszenie ograniczeń (np. `interval_days` poza zakresem, `custom_start_on` niespójne, brak `ai_request_id` dla typu `ai`). Komunikat zawiera listę pól.
- `409 PLAN_CONFLICT` – konflikt wersjonowania (np. partial unique violation, równoległa aktualizacja); sugerujemy ponowną próbę.
- `500 INTERNAL_SERVER_ERROR` – nieoczekiwane błędy RPC/DB; logowane i maskowane usterki.
- Każdy błąd logowany w systemie obserwowalności/tabeli błędów (jeśli istnieje `public.api_errors`, insert z `user_id`, `route`, `payload_hash`, `message`, `stack`).

## 7. Rozważania dotyczące wydajności
- Minimalizacja zapytań: pojedyncze zapytanie SELECT rośliny + transakcja planu + pojedynczy RPC regeneracji.
- Indeksy: korzystamy z istniejących indeksów (`unique (plant_id) where is_active`, `unique (plant_id, due_on)`) – brak nowych wymagań.
- Regeneracja zadań ograniczona do `horizon_days` (default 90) – nie zwiększać domyślnej wartości w API bez dodatkowych zabezpieczeń.
- Asynchroniczne operacje: jeśli RPC generowania zadań jest kosztowne, rozważyć queue/worker; na ten moment wykonujemy inline, ale z timeout guard (np. 5s) i ewentualnym fallbackiem `202 Accepted`.
- Cache: brak, ponieważ dane są użytkownik-specyficzne i natychmiast wykorzystywane.

## 8. Etapy wdrożenia
1. **Zdefiniuj schemat walidacji** – utwórz `SetWateringPlanPayloadSchema` w `src/lib/api/plants/set-watering-plan-request.ts`, odwzorowujący `SetWateringPlanCommand`.
2. **Dodaj serwis** – zaimplementuj `setPlantWateringPlan` w `src/lib/services/watering-plans/set-watering-plan.ts`, odpowiedzialny za całą logikę DB i regenerację zadań.
3. **Warstwa danych** – przygotuj funkcję SQL/RPC (np. `set_watering_plan_version`, `regenerate_watering_tasks`) lub użyj istniejącej, zapewniając atomowość operacji na planach i zadaniach.
4. **Endpoint HTTP** – utwórz plik `src/pages/api/plants/[plantId]/watering-plan.ts`, który:
   - pozyskuje `supabase` z `locals`,
   - waliduje wejście,
   - wywołuje serwis i mapuje wynik na DTO,
   - przechwytuje `HttpError` i inne wyjątki.
5. **Testy jednostkowe/integracyjne** – dodaj testy serwisu (np. mock Supabase) i e2e kontrakty (schemat 422, 404, 200).
6. **Logowanie i monitoring** – upewnij się, że błędy są raportowane (np. Sentry/logger + tabela audytowa).
7. **Dokumentacja/PRD** – zaktualizuj `.ai/api-plan.md` lub wiki, jeśli endpoint otrzymał dodatkowe reguły biznesowe, oraz opisz wpływ na klienta.
