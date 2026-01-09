# API Endpoint Implementation Plan: GET `/api/plants/{plantId}`

## 1. Przegląd punktu końcowego
- Dostarcza szczegółów pojedynczej rośliny należącej do zalogowanego użytkownika wraz z aktywnym planem podlewania (jeśli istnieje).
- Reużywa DTO `PlantDetailDto`, co gwarantuje zgodność pól między frontendem a backendem.
- Odpowiedź opakowana w standardowy format `{ data, error, meta }`, aby zachować spójność z innymi endpointami.

## 2. Szczegóły żądania
- **Metoda HTTP:** `GET`
- **URL:** `/api/plants/{plantId}`
- **Nagłówki:**
  - `Authorization: Bearer <access_token>` (wymagany — Supabase session).
- **Parametry path:**
  - `plantId` *(wymagany)* — `uuid` identyfikujący roślinę.
- **Parametry query / body:** brak.
- **Walidacja wejścia:**
  - Zod schema `z.object({ plantId: z.string().uuid() })`.
  - Odmowa żądań bez uwierzytelnionego użytkownika (`locals.supabase.auth.getUser()`).

## 3. Wykorzystywane typy
- `PlantDetailDto`, `PlantDetailCore`, `WateringPlanSummaryDto` z `src/types.ts` jako DTO odpowiedzi.
- Nowy serwisowy kontrakt `GetPlantDetailQuery` `{ plantId: string; userId: string; }`.
- Ewentualny helper `mapWateringPlanToSummary(row: WateringPlanRow): WateringPlanSummaryDto`.
- Typy bazodanowe z `Tables<'plants'>` i `Tables<'watering_plans'>` zapewniające ścisłe typowanie przy zapytaniach Supabase.

## 4. Szczegóły odpowiedzi
- **Kod 200:** 
  - `data.plant` zawiera pola: `id`, `species_name`, `duplicate_index`, `display_name`, `nickname`, `description`, `purchase_date`, `photo_path`.
  - `data.active_watering_plan` zawiera aktywną wersję planu (`interval_days`, `horizon_days`, `schedule_basis`, `start_from`, `custom_start_on`, `overdue_policy`, `was_ai_*`, `ai_request_id`, `valid_from`, `valid_to`, `is_active`, `id`); `null`, jeśli brak planu.
  - `error` zawsze `null` przy sukcesie; `meta` puste `{}`.
- **Kody błędów:** `400`, `401`, `404`, `500` z komunikatem w polu `error`.

## 5. Przepływ danych
1. Middleware gwarantuje `locals.supabase` oraz `locals.user`.
2. Handler:
   - Waliduje `plantId`, odrzuca brak sesji.
   - Buduje `GetPlantDetailQuery` z `plantId` i `user.id`.
3. Serwis `getPlantDetail`:
   - Wywołuje Supabase `from('plants')` z filtrami `id = plantId` i `user_id = userId`, ograniczając kolumny do tych wymaganych w DTO.
   - Na bazie `species_name` i `duplicate_index` konstruuje `display_name` (np. helper `buildPlantDisplayName`).
   - Równolegle (lub po stronie Supabase `select`) pobiera aktywny plan z `watering_plans` (`is_active = true`, `plant_id = plantId`), ograniczając kolumny do `WateringPlanSummaryDto`.
4. Serwis mapuje rekordy do DTO i zwraca do handlera.
5. Handler pakuje wynik w `{ data, error: null, meta: {} }` i zwraca `200`.

## 6. Względy bezpieczeństwa
- Wymagane uwierzytelnianie przez Supabase; brak tokenu → `401`.
- Filtr po `user_id` eliminuje wyciek danych między użytkownikami nawet przy znajomości UUID.
- Jeśli Supabase RLS jest aktywne, zapytania nadal powinny mieć jawne filtry (obrona w głąb).
- Unikać ujawniania szczegółów wewnętrznych w komunikatach błędów; logować pełne szczegóły tylko po stronie serwera.
- Brak potrzeby dodatkowych ról, ale należy respektować limit rate (obsłużony wyżej w stacku, np. middleware).

## 7. Obsługa błędów
- `400 Bad Request`: niepoprawny UUID — komunikat „Invalid plantId”.
- `401 Unauthorized`: brak lub wygasła sesja; handler kończy zanim wywoła serwis.
- `404 Not Found`: brak rekordu dla `(plantId, userId)` → komunikat „Plant not found”.
- `500 Internal Server Error`: błąd Supabase lub mapowania; log do centralnego loggera (`src/lib/utils.ts` lub dedykowany `logger`), opcjonalnie insert do przyszłej tabeli błędów (`error_logs`) gdy zostanie wdrożona.
- Wszystkie błędy zwracają `error: { code, message }`, `data: null`.

## 8. Rozważania dotyczące wydajności
- Ograniczyć wybierane kolumny (`select('id,species_name,...')`) zamiast `*`.
- Użyć pojedynczego zapytania z `maybeSingle()`; dla planu wykorzystać `limit(1)` i indeks `UNIQUE (plant_id) WHERE is_active`.
- Cache aplikacyjny niekonieczny, ale można dodać HTTP caching (ETag) w przyszłości — na razie SSE/SSR.
- Rozważyć `Promise.all` dla równoległych zapytań plant + plan, ale preferowane pojedyncze zapytanie z `select('*, watering_plans!inner(...)')` jeśli Supabase RLS pozwala.

## 9. Kroki implementacji
1. **Utwórz schemat walidacyjny** w handlerze (`zod`) oraz helper do odczytu użytkownika z `locals`.
2. **Dodaj serwis** `src/lib/services/plants/get-plant-detail.ts` (lub podobny) z funkcją `getPlantDetail(supabase, query)`.
3. **Zaimplementuj zapytanie Supabase** dla `plants` z filtrem `user_id` i joinem/pod-zapytaniem `watering_plans` (`is_active = true`).
4. **Zmapuj rekordy** na `PlantDetailDto` (w tym `display_name` i null-safe `active_watering_plan`).
5. **Obsłuż brak rekordu** w serwisie (zwróć `null`) i zamień na `404` w handlerze.
6. **Dodaj logging** dla wyjątków (np. `logger.error('getPlantDetail failed', error, { plantId, userId })`).
7. **Zbuduj handler API** w `src/pages/api/plants/[plantId].ts` lub `.astro`: importuje walidację, serwis, zwraca ustandaryzowaną odpowiedź, ustawia `export const prerender = false`.
