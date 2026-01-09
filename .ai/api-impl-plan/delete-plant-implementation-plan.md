# API Endpoint Implementation Plan: DELETE /api/plants/{plantId}

## 1. Przegląd punktu końcowego
- Usuwa wskazaną roślinę wyłącznie dla uwierzytelnionego użytkownika i zwraca wynik w spójnym envelope `data/error/meta`.
- Operacja wymaga jawnego potwierdzenia (`confirm=true`) oraz poprawnego identyfikatora `plantId` (UUID) przekazanego w ścieżce.
- Supabase wymusza kaskadowe usunięcie powiązanych rekordów (`watering_plans`, `watering_tasks`), dzięki czemu nie trzeba ręcznie porządkować danych wtórnych.

## 2. Szczegóły żądania
- Metoda HTTP: `DELETE`
- Struktura URL: `/api/plants/{plantId}`
- Parametry:
  - Wymagane path params: `plantId` (`UUID`, walidowany przez `z.string().uuid()`).
  - Wymagane query params: `confirm` (musi równać się dokładnie `'true'`; wykorzystaj `z.literal('true')`).
- Nagłówki: `Authorization: Bearer <access_token>` (Supabase session), `Content-Type` nie dotyczy (brak body).
- Request body: brak (żądanie nie przenosi danych w treści).
- Walidacja:
  - Użyj Zod z `astro:content`/`astro/zod` do walidacji zarówno path, jak i query (`params`, `url.searchParams`).
  - W przypadku niepoprawnych danych wejściowych natychmiast zwróć `400` z kodem np. `INVALID_DELETE_PLANT_REQUEST`.

## 3. Szczegóły odpowiedzi
- Sukces `200 OK` z payloadem zgodnym z `DeletePlantResultDto`:
  ```json
  {
    "data": { "deleted": true, "plant_id": "uuid" },
    "error": null,
    "meta": {}
  }
  ```
- DTO i modele:
  - `DeletePlantResultDto` (z `src/types.ts`) – zwracany w envelope.
  - Nowy wewnętrzny `DeletePlantCommand` (np. `{ plantId: string; userId: string }`) przekazywany do serwisu.
  - `DeletionResultDto` baza dla spójności sygnatury.
- Błędy wykorzystują ten sam envelope i strukturę `error` (`code`, `message`), z odpowiednim statusem HTTP (400/401/404/500).

## 4. Przepływ danych
1. Klient wysyła `DELETE` wraz z access tokenem Supabase oraz `confirm=true`.
2. Astro API route (`src/pages/api/plants/[plantId]/index.ts`) pobiera `locals.supabase` (zgodnie z regułami backend.mdc) i użytkownika (`const { data: { user } } = await supabase.auth.getUser()`).
3. Zod waliduje parametry (`plantId`, `confirm`); w razie błędu zwracany jest `HttpError(400, ...)`.
4. Z route wywoływany jest nowy serwis `deletePlant(supabase, { plantId, userId })` umieszczony w `src/lib/services/plants/delete-plant.ts`.
5. Serwis wykonuje `delete` na tabeli `plants` z filtrami `.eq('id', plantId).eq('user_id', userId)` oraz `.select('id').single()` by odebrać usunięty rekord.
6. W przypadku sukcesu serwis zwraca `DeletePlantResultDto` (lub dane potrzebne do jego złożenia), a route buduje envelope i odsyła `200`. Kaskady w DB automatycznie usuwają plany/powiązane zadania.

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie**: wszystkie wywołania wymagają ważnego access tokena Supabase; brak użytkownika => `401`.
- **Autoryzacja/IDOR**: filtruj po `user_id` w `delete` – dzięki temu użytkownik nie usunie cudzej rośliny nawet przy poprawnym UUID.
- **Potwierdzenie**: `confirm=true` działa jako tarcza przed przypadkowymi/skryptowymi wywołaniami; brak lub inne wartości odrzucaj.
- **Walidacja UUID**: chroni przed błędami SQL i ewentualnym logowaniem stack trace.
- **CSRF**: endpoint wymaga bearer tokena; jeśli aplikacja działa w przeglądarce, dodatkowo korzysta z fetch wymagającego pochodzenia; można rozważyć `SameSite` + `POST/DELETE` wykonywane z `fetch` (obecne).
- **Rejestrowanie błędów**: w przypadku `HttpError` loguj do standardowego loggera (`console.error` albo planowany `error_logs` table) z kontekstem `userId`, `plantId`, `code`.

## 6. Obsługa błędów
| Sytuacja | Status | Działanie |
| --- | --- | --- |
| Brak tokena / użytkownika | 401 | Zwróć `HttpError(401, 'Unauthenticated', 'UNAUTHENTICATED')`. |
| `confirm` nieobecny / różny od `'true'` lub nieprawidłowy UUID | 400 | `HttpError(400, 'Confirmation required', 'CONFIRMATION_REQUIRED')`. |
| Roślina nie istnieje lub nie należy do użytkownika | 404 | `HttpError(404, 'Plant not found', 'PLANT_NOT_FOUND')`. |
| Błąd Supabase przy usuwaniu | 500 | `HttpError(500, 'Failed to delete plant', 'PLANT_DELETE_FAILED')` oraz log wpisany do loggera/tabeli błędów. |
| Nieprzewidziane wyjątki | 500 | Złap w route, zamień na `HttpError` i zaloguj (zawiera requestId/userId). |

## 7. Rozważania dotyczące wydajności
- Operacja dotyczy pojedynczego wiersza `plants`; indeks po `id`/`user_id` zapewnia O(1) selekcję.
- Kaskada Supabase odciąża backend – nie ma dodatkowych zapytań czyszczących.
- Upewnij się, że `.select('id')` w `delete` ogranicza payload.
- Route jest bezstanowy – skalowanie horyzontalne nie wymaga dodatkowych cache’y.

## 8. Etapy wdrożenia
1. **Definicje schematów**: przygotuj wspólne helpery Zod dla `plantId` i `confirm` (np. w `src/lib/utils.ts`), aby ułatwić wielokrotne użycie.
2. **Serwis domenowy**: dodaj `src/lib/services/plants/delete-plant.ts` implementujący logikę Supabase + mapowanie do `DeletePlantResultDto`.
3. **Warstwa HTTP**: utwórz route `src/pages/api/plants/[plantId]/index.ts` (jeśli nie istnieje) z eksportem `DELETE`, ustaw `export const prerender = false`, pobierz supabase z `locals`.
4. **Walidacja i autoryzacja**: w route zweryfikuj token (`supabase.auth.getUser()`), przemapuj błędy na `HttpError`.
5. **Obsługa błędów i envelope**: użyj istniejącego helpera (jeśli jest) lub dodaj util budujący odpowiedź `{ data, error, meta }`, aby zachować jednolitość API.
6. **Logowanie błędów**: w bloku `catch` loguj szczegóły (userId, plantId, kod błędu); jeżeli istnieje tabela błędów, wstaw tam rekord – w innym wypadku użyj `console.error`.
