# API Endpoint Implementation Plan: GET `/api/calendar/month`

## 1. Przegląd punktu końcowego
- Zwraca zagregowany kalendarz podlewań dla pojedynczego użytkownika na wskazany miesiąc (`YYYY-MM`), umożliwiając podgląd liczby roślin wymagających uwagi każdego dnia.
- Działa na danych z `watering_tasks`, respektując status zadania (`pending`, `completed`) i powiązania z `plants`.
- Przystosowany do integracji z istniejącym kontraktem odpowiedzi API (`{ data, error, meta }`), wykorzystuje DTO `CalendarMonthResponseDto`.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL: `/api/calendar/month`
- Parametry zapytania:
  - Wymagane:
    - `month` – string w formacie `YYYY-MM`; determinuje zakres dat (pierwszy dzień miesiąca do pierwszego dnia kolejnego miesiąca, zakres półotwarty).
  - Opcjonalne:
    - `status` – `pending | completed | all`, domyślnie `pending`.
- Body: brak.
- Nagłówki: standardowe uwierzytelnienie Supabase (sesja użytkownika w Astro, np. cookie `sb:token`). Brak dodatkowych nagłówków biznesowych.

## 3. Wykorzystywane typy
- `CalendarMonthResponseDto` – kształt `data` (`month: string`, `days: CalendarMonthDayDto[]`).
- `CalendarMonthDayDto` – `date: IsoDate`, `count: number`.
- Nowe typy pomocnicze (proponowane):
  - `GetCalendarMonthQuery` (service layer) z polami `userId: string`, `month: string`, `status: 'pending' | 'completed' | 'all'`.
  - `CalendarMonthRequestParams` (API layer) – wynik walidacji zapytania HTTP.
- Brak Command modeli (endpoint jest wyłącznie odczytowy).

## 4. Szczegóły odpowiedzi
- 200 OK: `{ data: CalendarMonthResponseDto, error: null, meta: {} }`.
  - `days` posortowane rosnąco po `date`, każdy element zawiera liczbę zadań (unikalnych roślin) na dany dzień.
  - `month` odpowiada parametrowi wejściowemu (zachowujemy oryginalną wartość).
- 400/422: `{ data: null, error: { code, message, details }, meta: {} }` dla błędnej walidacji (`InvalidMonthFormat`, `UnsupportedStatus` itp.).
- 401: brak/nieprawidłowy użytkownik (middleware powinien zawrócić przed logiką biznesową).
- 500: `error.code` np. `CALENDAR_QUERY_FAILED` z opisem.

## 5. Przepływ danych
1. Middleware (`src/middleware`) uwierzytelnia użytkownika; `locals.supabase` + `locals.user`.
2. Handler `/src/pages/api/calendar/month.ts`:
   - Importuje `zod` schema z `src/lib/api/calendar/get-calendar-month-request.ts` (nowy plik).
   - Waliduje `Astro.request.url`.
   - Buduje `GetCalendarMonthQuery` (dodaje `userId`).
3. Serwis `src/lib/services/calendar/get-calendar-month.ts`:
   - Przyjmuje `SupabaseClient<Database>`, `GetCalendarMonthQuery`.
   - Wyznacza `rangeStart` (np. `Temporal.PlainYearMonth` lub `DateTime`) i `rangeEnd`.
   - Buduje zapytanie:
     ```ts
     supabase
       .from('watering_tasks')
       .select('due_on, plant_id', { count: 'exact', head: false })
       .eq('user_id', userId)
       .gte('due_on', rangeStart)
       .lt('due_on', rangeEnd)
       .in('status', statusFilter) // ['pending'] / ['completed'] / ['pending','completed']
       .order('due_on', { ascending: true })
     ```
   - Używa agregacji po stronie DB (preferowane RPC): `select('due_on,count:count()').group('due_on')`.
   - Mapuje wynik do `CalendarMonthDayDto[]`. Licznik = liczba rekordów na dany dzień (unikalność zapewnia constraint `(plant_id, due_on)`).
4. Handler owija wynik w kontrakt `{ data, error, meta }`.

## 6. Względy bezpieczeństwa
- Autoryzacja: każdy query ograniczony przez `user_id = locals.user.id`.
- Weryfikacja parametrów zapobiega SQL injection (zod + enumeracje).
- Brak ekspozycji danych innych użytkowników dzięki filtracji `user_id`.
- Kontrola zakresu dat – ograniczamy się do pojedynczego miesiąca (maks. 31 dni) aby uniknąć over-fetching oraz DoS.
- Wdrożyć limit statusu do dozwolonego zestawu; odrzucać inne wartości.
- Observability: logować błędy (Astro logger / Sentry) bez ujawniania danych użytkownika.

## 7. Obsługa błędów
- Walidacja:
  - `InvalidMonthFormat` (`400/422`) – month nie spełnia `^\d{4}-(0[1-9]|1[0-2])$`.
  - `MonthOutOfRange` – opcjonalnie ograniczyć do +/- 1 roku od bieżącej daty (zapobiega kosztownym zapytaniom).
  - `InvalidStatus` – spoza enumeracji.
- Supabase errors:
  - zapytanie `.from('watering_tasks')` zwraca `error` → rzucamy `HttpError(500, 'Failed to load calendar', 'CALENDAR_QUERY_FAILED')`.
- Brak danych: dozwolone, zwracamy `days: []`.
- Nieautoryzowany dostęp: rely on middleware (401).
- Logowanie do tabeli błędów – brak dedykowanej tabeli; wykorzystać globalny logger + ewentualne Sentry (do potwierdzenia). Jeśli w przyszłości powstanie `public.error_logs`, handler `catch` może wykonywać `supabase.from('error_logs').insert(...)`.

## 8. Rozważania dotyczące wydajności
- Indeksy:
  - Wykorzystać istniejący unikalny indeks `(plant_id, due_on)` plus dodać indeks złożony `(user_id, due_on)` jeśli nie istnieje (sprawdzić w migracji; w razie braku – zaplanować).
- Agregacja w SQL zmniejsza transfer (zamiast liczyć w JS).
- Zakres miesięczny zapewnia max 31 grup → brak potrzeby stronicowania.
- Używać `head: true` + RPC `count`? Lepiej `select('due_on, count:count()')` – minimalny payload.
- Możliwość cache (revalidate w CDN) – rozważyć w przyszłości; na razie SSR per-user, brak dzielenia odpowiedzi.

## 9. Etapy wdrożenia
1. **Schema & DTOs**
   - Utworzyć `src/lib/api/calendar/get-calendar-month-request.ts` z zod schema (`month`, `status`), eksportować `parseGetCalendarMonthParams`.
   - Dodać typ `GetCalendarMonthQuery` i ewentualne helpery w `src/lib/services/calendar/types.ts` (nowy folder `calendar`).
2. **Service Layer**
   - Dodać `src/lib/services/calendar/get-calendar-month.ts`.
   - Funkcja `getCalendarMonthSummary(supabase, query): Promise<CalendarMonthResponseDto>`.
   - Implementować logikę zakresu dat oraz zapytanie do `watering_tasks` z `group('due_on')`.
3. **API Route**
   - Dodać `src/pages/api/calendar/month.ts`.
   - `export const prerender = false`.
   - Handler `GET`: pobiera `locals.supabase`, `locals.user`.
   - Waliduje query, wywołuje serwis, zwraca `return new Response(JSON.stringify({ data, error: null, meta: {} }), { status: 200 })`.
   - Obsługa błędów: `HttpError` → `status`, `code`; inaczej `500`.
4. **Utilities**
   - Dodać helper do obliczenia `rangeStart/rangeEnd` (np. `src/lib/utils/date.ts` jeśli brak). Użyć `Temporal`/`Date` + `utc`. Zapewnić testy jednostkowe (np. `monthToDateRange`).
5. **Testing**
   - Napisać testy jednostkowe dla walidacji (zod) oraz funkcji zakresu dat.
   - Test integracyjny serwisu: mock Supabase client (lub test e2e z lokalną bazą) weryfikujący filtr statusu i agregację.
6. **Docs**
   - Zaktualizować `.ai/api-plan.md` lub README jeśli konieczne (np. opis parametru `status` – już istnieje).
7. **Verification**
   - Uruchomić `npm test` i `npm run lint`.
   - Manualny smoke test via `curl` / Thunder Client z różnymi parametrami.
