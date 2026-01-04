<conversation_summary>
<decisions>
1. Nawigacja MVP: Kalendarz (domyślnie) → Rośliny → Ustawienia + globalne CTA „Dodaj roślinę” na desktop i mobile (mobile: dolna nawigacja).
2. Dodawanie rośliny: flow dwufazowy w jednej ścieżce UI: POST /api/plants → ekran „Sugerowanie planu” + możliwość ponowienia POST /api/plants/{plantId}/watering-plan/suggest.
3. Limity AI: przed pierwszym użyciem komunikat o limicie; przełącznik „Generuj plan AI” (domyślnie włączony) automatycznie wyłączany przy rate-limit + prezentacja unlock_at; w MVP quota pokazywana tylko kontekstowo.
4. Akceptacja planu: ekran „Proponowany plan” z akcjami Akceptuj / Edytuj i zapisz / Odrzuć i ustaw ręcznie; zapis zawsze przez PUT /api/plants/{plantId}/watering-plan z source i accepted_without_changes.
5. Edycja planu w MVP: minimum — interval_days + data startu („od dziś” vs „wybierz datę”); reszta ukryta jako zaawansowane z domyślnymi wartościami.
6. Kalendarz: nawigacja miesiąc → dzień → lista zadań; skrót „Dziś” w miesiącu i dniu; domyślne filtry: miesiąc pending, dzień all + segment „Do zrobienia / Wykonane / Wszystkie”.
7. Potwierdzanie/edycja podlewania: brak akcji masowych w MVP; edycja wpisu dotyczy tylko statusu, completed_on, notatki (bez edycji due_on).
8. Rozróżnienie wpisów: w dniu oznaczać „z planu” vs „dodatkowe (adhoc)”; usuwanie zawsze z dialogiem potwierdzenia (różna treść dla adhoc vs zaplanowane).
9. Rośliny: lista z wyszukiwaniem q + sort (bez filtrów) + paginacja „Załaduj więcej” (cursor); szczegóły rośliny pokazują tylko aktywny plan + „Zobacz w kalendarzu”; historia planów poza MVP; stan „Brak planu” z CTA: „Wygeneruj AI” / „Ustaw ręcznie”.
10. Zdjęcia roślin: opcjonalne i realizowane jako osobna akcja w szczegółach: POST /api/plants/{plantId}/photo/upload-url → upload z paskiem postępu → PATCH /api/plants/{plantId} z photo_path.
11. Nazewnictwo duplikatów: w UI zawsze bazować na display_name jako głównej nazwie; nickname jako przydomek; species_name zablokowane w edycji (immutable) + jasne wyjaśnienie duplikatów.
12. Routing (deep-linking): stabilne trasy kalendarza: /calendar, /calendar/YYYY-MM, /calendar/day/YYYY-MM-DD; po zapisaniu planu przekierowanie do dnia (najbliższe podlewanie lub dziś) + toast „Plan zapisany” + link „Zobacz roślinę”.
13. Konflikty 409: komunikat „Na ten dzień istnieje już wpis podlewania” + propozycja przejścia do widoku dnia z wyróżnioną rośliną.
14. Standaryzacja mutacji: przyciski blokowane na czas submit (anti double-submit); po błędzie odzyskanie akcji + komunikat.
15. Integracja API: jeden adapter API mapujący error.code → komunikaty PL + typ prezentacji (inline/toast/fullscreen) oraz obsługa 401 (komunikat + przekierowanie do logowania).
16. Session/auth: preferowane SSR cookies + middleware do ochrony widoków; przechwytywanie 401 w UI.
17. Strefa czasowa: daty interpretowane w timezone profilu; domyślnie strefa przeglądarki + sugestia ustawienia w „Ustawieniach”.
18. Cache/stan: standard pobierania danych (np. TanStack Query); po mutacjach invalidacja tylko zależnych query (dzień/miesiąc/szczegóły rośliny); optymistyczne aktualizacje w widoku dnia.
19. Sieć: bez offline; globalny komunikat „Brak połączenia” + „Spróbuj ponownie” dla kluczowych ekranów.
20. Dostępność i responsywność: minimum WCAG dla MVP (klawiatura, focus w dialogach, etykiety, kontrast) + mobile-first (bottom nav, duże akcje „Potwierdź/Cofnij”, stałe CTA).
21. „Dodaj roślinę”: jako osobna podstrona (nie modal) na MVP.
22. Telemetria/analytka: poza MVP.
23. Język: tylko PL, ale przygotować strukturę pod przyszłe i18n (teksty w jednym miejscu, formattery dat).
</decisions>
<matched_recommendations>
1. Prosta, stała nawigacja (Kalendarz/Rośliny/Ustawienia) z globalnym CTA oraz dopasowaniem do mobile (bottom nav).
2. Jedna ścieżka „Dodaj roślinę” z dwufazowym procesem (create → suggest) i retry sugestii.
3. Komunikacja i fallback limitów AI: przełącznik „Generuj plan AI”, automatyczne wyłączenie przy rate-limit, pokazanie unlock_at, możliwość kontynuacji bez AI.
4. Ekran propozycji planu z trzema akcjami i jednoznacznym mapowaniem na PUT /watering-plan + flagi akceptacji.
5. Minimalny formularz planu (interval + start) oraz ukrycie zaawansowanych parametrów w MVP.
6. Hierarchia kalendarza miesiąc→dzień z filtrami statusu i skrótem „Dziś”; mutacje per task z natychmiastową aktualizacją UI.
7. Rozróżnienie scheduled vs adhoc w UI + bezpieczne, spójne dialogi potwierdzeń dla akcji destrukcyjnych.
8. Zakres ekranów roślin: lista z q i sort + szczegóły z aktywnym planem; brak historii planów w MVP; stan „Brak planu” z CTA.
9. Spójny system obsługi stanów: loading/skeleton, toasty, inline errors (422), pełnoekranowe stany dla AI (timeout/rate-limit) i globalne „Brak połączenia”.
10. Standard integracji danych: adapter API + TanStack Query (cache/invalidation/optimistic) + globalna obsługa 401 i ochrona widoków middleware.
</matched_recommendations>
<ui_architecture_planning_summary>
a) Główne wymagania dotyczące architektury UI
MVP ma wspierać: dodanie rośliny (manualnie), wygenerowanie sugestii AI (do 5s), akceptację/odrzucenie/edycję planu, kalendarz miesięczny i dzienny, potwierdzanie/edycję podlewań, edycję danych rośliny, usuwanie rośliny, ustawienia profilu i usunięcie konta (2 kroki), obsługę limitów AI i błędów.
UI ma działać responsywnie (web), z priorytetem na szybkie dzienne „odhaczanie” zadań.
UX musi być czytelny w warunkach ograniczeń API: limit AI, błędy walidacji/konflikty, sesje/401.
b) Kluczowe widoki, ekrany i przepływy użytkownika
Auth: logowanie/rejestracja (niezalogowany zawsze tu), po zalogowaniu start w Kalendarzu.
Kalendarz / Month (/calendar lub /calendar/YYYY-MM): siatka miesiąca + liczba zadań/dzień, skrót „Dziś”, puste stany (CTA „Dodaj roślinę”).
Kalendarz / Day (/calendar/day/YYYY-MM-DD): lista zadań (scheduled/adhoc), segment statusu, duże akcje Potwierdź/Cofnij, edycja wpisu (status, completed_on, notatka), usuwanie z potwierdzeniem, opcja „Dodaj wpis adhoc” (wybór rośliny).
Dodaj roślinę (osobna podstrona): formularz minimalny + przełącznik „Generuj plan AI”; po POST /api/plants przejście do „Sugerowanie planu”.
Sugerowanie planu / Proponowany plan: stan pełnoekranowy podczas AI (fallback/timeout/rate-limit), następnie karta propozycji + akcje Akceptuj / Edytuj / Odrzuć; finalnie PUT /watering-plan.
Rośliny / Lista: wyszukiwarka q, sort, „Załaduj więcej” (cursor), wejście w szczegóły.
Roślina / Szczegóły: display_name + nickname, tylko aktywny plan, „Zmień plan”, „Zobacz w kalendarzu”, „Podlej dzisiaj” (adhoc), zdjęcie (upload flow), edycja pól opcjonalnych (bez species_name), usuwanie z potwierdzeniem.
Ustawienia: profil (nickname, timezone), stan sesji, proces usunięcia konta (delete-intent → delete).
c) Strategia integracji z API i zarządzania stanem
Jeden adapter API obsługujący envelope, mapowanie error.code, globalne reguły prezentacji błędów i obsługę 401.
Warstwa cache (np. TanStack Query): query per widok (month/day/plants/plant detail), po mutacjach invalidacja minimalna (dzień, miesiąc, szczegóły rośliny), optymistyczne aktualizacje dla potwierdzeń podlewania.
Anti double-submit jako standard komponentów akcji.
Trasy kalendarza jako deep-link (stabilne i udostępnialne); przekierowania po zapisaniu planu do docelowego dnia.
d) Responsywność, dostępność i bezpieczeństwo
Responsywność: mobile bottom nav + stałe CTA, priorytet dużych akcji w dniu, szybki skrót „Dziś”.
Dostępność: klawiatura, focus management w dialogach, poprawne etykiety, kontrast; spójne dialogi potwierdzeń dla akcji destrukcyjnych.
Bezpieczeństwo: SSR cookies + middleware do ochrony widoków; obsługa wygaśnięcia sesji (401 → komunikat + redirect).
Prywatność/usuwanie: dedykowany, dwustopniowy flow usunięcia konta (hasło + zgoda) zakończony wylogowaniem i potwierdzeniem.
e) Nierozwiązane kwestie / wymagające doprecyzowania
Zasadnicza architektura UI jest uzgodniona; dalsze prace powinny przejść do rozpisania szczegółowych map podróży użytkownika, komponentów i kontraktów danych per ekran.
</ui_architecture_planning_summary>
<unresolved_issues_recommendations>
1. „Najbliższa data podlewania” po PUT /api/plants/{plantId}/watering-plan
Rekomendacja: Po udanym PUT wykonać 1 dodatkowy odczyt read-modelu kalendarza (żeby wskazać konkretną datę, a nie tylko zakres):
- najpierw: GET /api/calendar/day?date=today&status=all (lub pending) — jeśli są zadania, przekierować na /calendar/day/<today>,
- jeśli brak zadań „dziś”: użyć tasks_regenerated.from (YYYY-MM-DD) do pobrania GET /api/calendar/month?month=YYYY-MM&status=pending i wybrać najwcześniejszą datę z days[] → przekierować na /calendar/day/<date>.
Uwaga: tasks_regenerated.from/to/count nie wystarcza do wyznaczenia konkretnego dnia.

2. UX dla 408 AI_TIMEOUT i 502 AI_PROVIDER_ERROR
Rekomendacja: Ustandaryzować ekran „Sugerowanie planu” na scenariusze:
- 408: komunikat „AI nie odpowiedziało w czasie” + CTA „Spróbuj ponownie” (retry POST /watering-plan/suggest) i „Ustaw ręcznie” (formularz planu),
- 502: komunikat „AI ma chwilowy problem” + te same CTA,
- 429: komunikat z unlock_at + CTA „Ustaw ręcznie” (oraz opcjonalnie „Spróbuj ponownie później”).
Reguła: „Kontynuuj bez AI” = zawsze dostępne jako „Ustaw ręcznie” (oraz opcja „Ustaw plan później” → powrót do szczegółów rośliny).

3. Minimalny zakres UI rejestracji i potwierdzenia e-mail
Rekomendacja: MVP auth ograniczyć do 3 ekranów:
- Logowanie (email/hasło) + link do rejestracji,
- Rejestracja (email/hasło + opcjonalnie nickname/timezone) → po sukcesie,
- „Sprawdź skrzynkę” (potwierdzenie e-mail) + przycisk „Mam już potwierdzone → Zaloguj”.
Obsługa błędów: 403 AUTH_EMAIL_NOT_CONFIRMED → przekierowanie/CTA do „Sprawdź skrzynkę”; 401 AUTH_INVALID_CREDENTIALS → inline error.

4. „Wybór rośliny” w „Dodaj wpis adhoc” przy dużej liczbie roślin
Rekomendacja: Na MVP wykorzystać istniejące GET /api/plants z q + cursor:
- UI: input wyszukiwania (debounce 300–500 ms) + lista wyników + „Załaduj więcej”,
- cache ostatnich wyników i ponowne użycie przy powrocie do widoku.
Plan B (po MVP): dopiero jeśli wydajność/UX będą problemem, dodać dedykowany endpoint „quick search” (np. tylko id + display_name).
</unresolved_issues_recommendations>

</conversation_summary>