# API Endpoint Implementation Plan: PATCH /api/plants/{plantId}

## 1. Przegląd punktu końcowego
Endpoint aktualizuje opcjonalne pola rośliny należącej do zalogowanego użytkownika: `nickname`, `description`, `purchase_date`, `photo_path`. `species_name` jest niezmienne i próba jego modyfikacji powinna zostać odrzucona kodem 409. Po pomyślnej aktualizacji API odsyła zaktualizowany rekord rośliny (najlepiej w formacie `PlantDetailDto`, by zapewnić spójność z widokiem szczegółów).

## 2. Szczegóły żądania
- **Metoda HTTP:** `PATCH`
- **URL:** `/api/plants/{plantId}`
- **Parametry ścieżki (wymagane):** `plantId` – UUID rośliny.
- **Nagłówki:** `Authorization: Bearer <token>` (wymagany), `Content-Type: application/json`.
- **Body (JSON, wszystkie pola opcjonalne i nullable):**
  - `nickname`: string 1..80 lub `null`.
  - `description`: dowolny string (można ustalić max np. 10k) lub `null`.
  - `purchase_date`: `YYYY-MM-DD` lub `null`.
  - `photo_path`: niepusty string (ścieżka w Supabase Storage) lub `null`.
- **Walidacja wejścia:**
  - `plantId` → `z.string().uuid()`.
  - Body → `z
    .object({ ... })
    .strict()
    .refine(coerceNotEmpty)` aby zablokować nieobsługiwane pola i wymagać przynajmniej jednego pola.
  - Dodatkowe reguły: nickname length, purchase_date format (np. `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`), `photo_path` trim + max length.
  - Wyraźny check, że `species_name` nie występuje ani w body (dzięki `.strict()`), ani w serwisie.

## 3. Wykorzystywane typy
- **`UpdatePlantCommand`** (`src/types.ts`) – reprezentuje whitelisting pól przekazywanych do serwisu/DB.
- **`PlantDetailDto` / `PlantSummaryDto`** – struktura odpowiedzi. Jeśli reużywamy `getPlantDetail`, końcowy DTO to `PlantDetailDto`.
- **`PlantDetailRecord`** (`get-plant-detail.ts`) – wynik serwisu pobierającego dane do złożenia DTO.
- **`HttpError`** (`src/lib/http/errors.ts`) – do podnoszenia błędów z kodami statusu i kodami systemowymi.
- **Nowy lokalny typ** `UpdatePlantRequestDto` (pochodna schematu Zod) do opisania requestu w kodzie API.

## 4. Szczegóły odpowiedzi
- **Sukces 200**: JSON zawierający zaktualizowaną roślinę. Rekomendacja:
  ```json
  {
    "plant": {
      "id": "...",
      "species_name": "...",
      "duplicate_index": 0,
      "nickname": "Updated Nickname",
      "description": "Updated description",
      "purchase_date": "2025-12-12",
      "photo_path": "plants/uuid/photo.jpg",
      "display_name": "...",
      "created_source": "manual",
      "created_at": "...",
      "updated_at": "..."
    },
    "active_watering_plan": { ... } // lub null
  }
  ```
- **Błędy:**  
  - `401 Unauthorized` – brak ważnego tokenu / `locals.user`.
  - `404 Not Found` – roślina nie istnieje dla użytkownika.
  - `409 Conflict` – próba aktualizacji `species_name` (nawet jeśli Supabase by ją zignorował).
  - `422 Unprocessable Entity` – naruszenie reguł walidacji (długości, format daty, brak pól).
  - `500 Internal Server Error` – problem z bazą/Supabase.

## 5. Przepływ danych
1. Astro middleware uwierzytelnia żądanie i dołącza `locals.supabase` oraz `locals.user`.
2. Route handler (`src/pages/api/plants/[plantId].ts` lub podobny) odczytuje `plantId` z params, waliduje body Zodem.
3. Tworzy `UpdatePlantCommand` (filtruje `undefined`, normalizuje null vs undefined).
4. Wywołuje nowy serwis `updatePlant` (np. w `src/lib/services/plants/update-plant.ts`), przekazując `supabase`, `userId`, `plantId`, `payload`.
5. Serwis:
   - Pobiera plant (`select ... eq('id', plantId).eq('user_id', userId)`).
   - Jeśli brak → zwraca `null`.
   - Aktualizuje rekord `plants` (tylko przekazane pola) i wymusza `updated_at = now()` (Supabase trigger lub manualnie).
   - Po udanym update ponownie używa `getPlantDetail` (lub w tym samym serwisie) by uzyskać aktualne dane i aktywny plan.
6. Handler mapuje wynik na DTO i zwraca JSON 200.

## 6. Względy bezpieczeństwa
- Autoryzacja: wymagaj aktywnej sesji; `userId` z `locals.user.id`.
- Własność danych: wszystkie zapytania do `plants` muszą zawierać `.eq('user_id', userId)`; brak globalnych aktualizacji.
- Ograniczenie pól: używać `UpdatePlantCommand` i `bodySchema.strict()` by uniknąć mass assignmentu (np. `user_id`, `species_name`).
- Walidacja wejścia: Zod + dodatkowe kontrole (trim, length) chronią przed wstrzyknięciem i złymi danymi.
- Logging: w przypadku 500 logować `planError`/`updateError` (np. `console.error` obecny w HttpError middleware). Brak dedykowanej tabeli błędów w MVP – dokumentujemy to.
- Rate limiting / CSRF: endpoint jest autoryzowany (Bearer), a Astro API jest serwerowe; brak dodatkowego CSRF z powodu braku cookies.

## 7. Obsługa błędów
- **401**: brak `locals.user` → rzuć `HttpError(401, 'Unauthenticated', 'UNAUTHENTICATED')`.
- **404**: serwis zwraca `null` gdy `select` nie znajdzie rośliny → handler rzuca `HttpError(404, 'Plant not found', 'PLANT_NOT_FOUND')`.
- **409**: jeśli request zawiera `species_name` (wykryte przez `.strict()` lub manualny check), rzuć `HttpError(409, 'Species name is immutable', 'IMMUTABLE_FIELD')`.
- **422**: `ZodError` mapowany do 422 + szczegóły pola (można użyć helpera walidacji jeśli istnieje).
- **500**: każdy błąd Supabase (update/select) – rzuć `HttpError(500, 'Failed to update plant', 'PLANT_UPDATE_FAILED')` lub specyficzne kody.
- W razie potrzeby w serwisie logować oryginalne `error.message` dla diagnostyki; brak dedykowanej tabeli -> `logger.error`.

## 8. Rozważania dotyczące wydajności
- Operacja dotyczy pojedynczego rekordu; maksymalnie dwa zapytania (`select` + `update` + ewentualnie `getPlantDetail` który robi dodatkowe `select`). To akceptowalne przy tak niskim wolumenie.
- Można zminimalizować liczbę zapytań, łącząc `update` z `select` (Supabase `update().select().single()`), ale i tak potrzebujemy aktywnego planu, więc reuse `getPlantDetail`.
- Dodaj indeks `plants(user_id, id)` – prawdopodobnie już istnieje dzięki PK. Nic więcej nie trzeba.
- Upewnij się, że `getPlantDetail` jest tylko raz wywoływany (po update), aby ograniczyć latency.

## 9. Etapy wdrożenia
1. **Przygotowanie schematów** – utwórz `updatePlantBodySchema` i `PlantIdParamSchema` (np. w `src/lib/api/plants/update-plant-request.ts`).
2. **Serwis** – dodaj `src/lib/services/plants/update-plant.ts`:
   - funkcja `updatePlant` przyjmująca `supabase`, `{ plantId, userId }`, `UpdatePlantCommand`.
   - zawiera selekcję rośliny + update + reuse `getPlantDetail`.
3. **Endpoint** – utwórz/uzupełnij `src/pages/api/plants/[plantId].ts` z `export const PATCH: APIRoute`:
   - pobierz autoryzację, waliduj wejście, zbuduj `UpdatePlantCommand`, wywołaj serwis, mapuj wynik na DTO.
4. **Obsługa błędów** – zapewnij, że `HttpError` jest używany konsekwentnie, a Zod błędy są mapowane do 422.
5. **Testy/QA** – jednostkowe dla schematu (np. daty, brak pól), integracyjne (patch on existing plant), przypadki błędów (401, 404, 409, 422).
6. **Dokumentacja** – zaktualizuj README/AI plan (jeśli konieczne) i ustaw monitorowanie logów dla 500.
7. **Weryfikacja** – ręcznie przetestuj w Devtools lub `curl`, zapewniając, że `species_name` pozostaje niezmienne i `updated_at` się zmienia.
