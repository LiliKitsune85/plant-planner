# Dokument wymagań produktu (PRD) - Plant Planner

## 1. Przegląd produktu
Plant Planner to webowa aplikacja pomagająca doświadczonym hodowcom szybko budować harmonogram podlewania całej kolekcji. Użytkownik dodaje wpis o roślinie ręcznie (nazwa + opcjonalne dane), a system w ciągu maksymalnie 5 sekund wysyła zapytanie do modelu językowego, aby uzyskać proponowany plan podlewania. Hodowca może plan zaakceptować lub wprowadzić własne wartości, a następnie śledzić zadania w prostym kalendarzu. MVP skupia się na procesie dodania rośliny, otrzymania rekomendacji i bieżącego potwierdzania wykonanych podlewań.

## 2. Problem użytkownika
Zaawansowani hodowcy często dysponują rozległymi kolekcjami i muszą scalać wiedzę z różnych źródeł, aby utrzymać regularne harmonogramy podlewania. Manualne wyszukiwanie zaleceń oraz prowadzenie notatek w arkuszach lub aplikacjach ogólnego przeznaczenia jest czasochłonne i podatne na błędy. Użytkownicy potrzebują narzędzia, które na podstawie nazwy rośliny szybko zaproponuje plan pielęgnacji, pozwoli go zatwierdzić lub skorygować i od razu włączyć do kalendarza.

## 3. Wymagania funkcjonalne
### 3.1 Dodawanie roślin
- Formularz wymaga podania nazwy gatunku; opcjonalnie można dodać pseudonim, opis, datę zakupu i zdjęcie.
- System automatycznie numeruje duplikaty tej samej nazwy.


### 3.2 Proponowanie harmonogramu podlewania
- Po dodaniu nazwy aplikacja wysyła zapytanie do modelu językowego i otrzymuje rekomendację w maks. 5 sekund.
- Plan zawiera częstotliwość podlewania i krótkie uzasadnienie/źródło.
- Użytkownik ma prosty flow: akceptuję lub odrzucam i wpisuję własny plan.
- Decyzja jest zapisywana przy roślinie i zasila kalendarz.

### 3.3 Kalendarz i śledzenie podlewania
- Widok miesięczny prezentuje dni z zaplanowanym podlewaniem i liczbę roślin na dzień.
- Widok dzienny pozwala potwierdzić wykonanie podlewania każdej rośliny oraz edytować lub usunąć wpis.
- Kalendarz odświeża się po każdej zmianie harmonogramu lub statusu.

### 3.4 Limity i anty-abuse
- Limit 20 zapytań do modelu językowego na godzinę per użytkownik; przed pierwszym zapytaniem wyświetla się komunikat o limicie.
- Po przekroczeniu limitu użytkownik widzi informację o czasie odblokowania oraz możliwość dodania wpisu bez generowania planu.

### 3.5 Bezpieczeństwo i zarządzanie danymi
- Konto użytkownika składa się z e-maila, hasła i pseudonimu; dane przechowywane zgodnie z RODO.
- Użytkownik może zażądać usunięcia konta w procesie z podwójnym potwierdzeniem; dane są kasowane natychmiast.

## 4. Granice produktu
- Poza MVP pozostają: automatyczne rozpoznawanie gatunku na podstawie zdjęcia oraz widok osi czasu z ostatnich 3 miesięcy.
- Brak przypomnień push/e-mail/SMS.
- Brak śledzenia innych zabiegów (nawożenie, opryski).
- Brak udostępniania kalendarza lub integracji z zewnętrznymi kalendarzami.
- Brak aplikacji mobilnych; wyłącznie responsywna aplikacja webowa.

## 5. Historyjki użytkowników
### US-001 Dodanie rośliny ręcznie
- ID: US-001
- Tytuł: Dodanie rośliny ręcznie
- Opis: Jako hodowca chcę dodać roślinę podając nazwę gatunku, aby szybko zarejestrować nowy okaz.
- Kryteria akceptacji:
  1. Formularz wymaga jedynie nazwy gatunku; pseudonim, opis, data zakupu i zdjęcie są opcjonalne.
  2. System automatycznie numeruje duplikaty tej samej nazwy.
  3. Zapis zawiera metadane dodania (źródło manualne, daty utworzenia/aktualizacji).

### US-002 Generowanie planu podlewania
- ID: US-002
- Tytuł: Generowanie planu podlewania
- Opis: Jako hodowca chcę, aby aplikacja po dodaniu rośliny zaproponowała harmonogram podlewania w oparciu o model językowy.
- Kryteria akceptacji:
  1. Po zapisaniu nazwy wysyłane jest zapytanie do modelu językowego, a odpowiedź pojawia się w maks. 5 sekund.
  2. Rekomendacja zawiera częstotliwość podlewania i krótkie uzasadnienie lub źródło.


### US-003 Akceptacja lub korekta planu
- ID: US-003
- Tytuł: Akceptacja lub korekta planu
- Opis: Jako hodowca chcę zatwierdzić lub odrzucić plan podlewania, aby zachować kontrolę nad harmonogramem.
- Kryteria akceptacji:
  1. Interfejs udostępnia przyciski zatwierdź i odrzuć wraz z podglądem planu.
  2. Odrzucenie wymusza wpisanie własnej częstotliwości, która zastępuje rekomendację.
  3. Zatwierdzony lub skorygowany plan natychmiast zasila kalendarz rośliny.
  4. System zapisuje w bazie danych informacje o tym, czy wygenerowany harmonogram został zaakceptowany, czy nie.

### US-004 Widok kalendarza miesięcznego
- ID: US-004
- Tytuł: Widok kalendarza miesięcznego
- Opis: Jako hodowca chcę zobaczyć miesiąc z zaznaczonymi dniami podlewania, aby planować pielęgnację.
- Kryteria akceptacji:
  1. Kalendarz pokazuje dni z zadaniami i liczbę roślin zaplanowanych na dany dzień.
  2. Kliknięcie dnia otwiera listę roślin do obsługi.
  3. Widok automatycznie odświeża się po każdej zmianie harmonogramu.

### US-005 Widok dzienny i potwierdzanie podlewania
- ID: US-005
- Tytuł: Widok dzienny i potwierdzanie podlewania
- Opis: Jako hodowca chcę przejrzeć rośliny zaplanowane na dany dzień i potwierdzić wykonanie podlewania.
- Kryteria akceptacji:
  1. Lista pokazuje status każdej rośliny (do zrobienia/wykonane)
  2. Kliknięcie potwierdź zapisuje wpis i aktualizuje kalendarz w czasie rzeczywistym.
  3. Każdy wpis można natychmiast wycofać lub edytować.

### US-006 Edycja wpisu podlewania
- ID: US-006
- Tytuł: Edycja wpisu podlewania
- Opis: Jako hodowca chcę poprawić błędnie zapisane podlewanie, aby dane były wiarygodne.
- Kryteria akceptacji:
  1. Formularz edycji pozwala zmienić datę, notatkę i status wpisu.
  2. Zapisanie aktualizacji nadpisuje pierwotny wpis zgodnie z wymaganiami.
  3. Zmienione dane natychmiast aktualizują kalendarz.

### US-007 Komunikacja limitów
- ID: US-007
- Tytuł: Komunikacja limitów
- Opis: Jako użytkownik chcę znać limit zapytań do modelu językowego, aby uniknąć blokady.
- Kryteria akceptacji:
  1. Przed pierwszym zapytaniem pojawia się informacja o limicie 20 zapytań/h per użytkownik i konsekwencjach blokady.
  2. Po przekroczeniu limitu system wyświetla czas odblokowania i blokuje kolejne zapytania.
  3. Użytkownik nadal może dodawać wpisy bez generowania planu podczas blokady.

### US-008 Uwierzytelnianie i dostęp
- ID: US-008
- Tytuł: Uwierzytelnianie i dostęp
- Opis: Jako hodowca chcę bezpiecznie tworzyć konto i logować się, aby chronić dane.
- Kryteria akceptacji:
  1. Logowanie i rejestracja odbywają się na dedykowanych stronach.
  2. Logowanie wymaga podania adresu email i hasła.
  3. Rejestracja wymaga podania adresu email, hasła i potwierdzenia hasła.
  4. Użytkownik może logować się do systemu poprzez przycisk w prawym górnym rogu.
  5. Użytkownik może się wylogować z systemu poprzez przycisk w prawym górnym rogu w głównym @Layout.astro.
  6. Nie korzystamy z zewnętrznych serwisów logowania (np. Google, GitHub).
  7. Odzyskiwanie hasła powinno być możliwe.

### US-009 Usunięcie konta i danych
- ID: US-009
- Tytuł: Usunięcie konta i danych
- Opis: Jako użytkownik chcę trwale usunąć konto, aby spełnić wymagania prywatności.
- Kryteria akceptacji:
  1. Proces wymaga dwóch kroków potwierdzenia (np. hasło oraz dodatkowa zgoda).
  2. Po potwierdzeniu wszystkie dane użytkownika i jego roślin są natychmiast usuwane.
  3. Użytkownik otrzymuje potwierdzenie operacji i zostaje wylogowany.

### US-010 Edycja danych rośliny
- ID: US-010
- Tytuł: Edycja danych rośliny
- Opis: Jako hodowca chcę edytować opcjonalne dane o roślinie, aby utrzymać aktualność kolekcji.
- Kryteria akceptacji:
  1. Formularz edycji pozwala zmienić pseudonim, opis, datę zakupu i zdjęcie, pozostawiając nazwę gatunku niezmienną.
  2. Zapisane zmiany natychmiast aktualizują szczegóły rośliny.
  3. Po zapisaniu zmian użytkownik otrzymuje komunikat o powodzeniu operacji.

### US-011 Usunięcie rośliny
- ID: US-011
- Tytuł: Usunięcie rośliny
- Opis: Jako hodowca chcę trwale usunąć roślinę, aby uporządkować kolekcję.
- Kryteria akceptacji:
  1. Usunięcie rośliny wymaga osobnego potwierdzenia.
  2. Po potwierdzeniu roślina wraz z całym harmonogramem podlewania (historycznym i planowanym) jest natychmiast kasowana.
  3. System wyświetla komunikat o pomyślnym usunięciu wpisu i odświeża kalendarz.

### US-012 Przegląd kolekcji roślin
- ID: US-012
- Tytuł: Przegląd kolekcji roślin
- Opis: Jako hodowca chcę przejrzeć listę wprowadzonych roślin, aby zweryfikować jej kompletność.
- Kryteria akceptacji:
  1. W widoku listy widać jej nazwę oraz opcjonalnie pseudonim
  2. Po kliknięciu w rekord rośliny system przechodzi na ekran z jej danymi szczegółowymi.
  3. Lista rośli uszeregowana jest alfabetycznie po nazwie rośliny.

### US-013 Szczegóły rośliny
- ID: US-013
- Tytuł: Szczegóły rośliny
- Opis: Jako hodowca chcę wejść w szczegóły rośliny, aby zobaczyć jej dane oraz aktywny plan i wykonać kluczowe akcje.
- Kryteria akceptacji:
  1. Widok pokazuje nazwę rośliny (display name) oraz opcjonalnie pseudonim, zdjęcie (jeśli istnieje) i aktualny status/parametry aktywnego planu lub stan „Brak planu”.
  2. Widok udostępnia akcje: „Zobacz w kalendarzu”, „Zmień plan”, „Podlej dzisiaj”, „Edytuj”, „Usuń”.
  3. Wejście w szczegóły jest możliwe z listy roślin.

### US-014 Ustawienie planu podlewania ręcznie (edytor planu)
- ID: US-014
- Tytuł: Ustawienie planu podlewania ręcznie (edytor planu)
- Opis: Jako hodowca chcę ręcznie ustawić plan podlewania, aby móc korzystać z kalendarza bez użycia rekomendacji AI.
- Kryteria akceptacji:
  1. Formularz pozwala ustawić co najmniej częstotliwość w dniach oraz datę startu („od dziś” lub wybrana data).
  2. Zapis planu natychmiast zasila kalendarz rośliny i jest widoczny w widokach kalendarza.
  3. Błędy walidacji (np. niepoprawny zakres wartości) są prezentowane przy polach formularza.

### US-015 Ponowienie sugerowania planu AI i obsługa statusów AI
- ID: US-015
- Tytuł: Ponowienie sugerowania planu AI i obsługa statusów AI
- Opis: Jako hodowca chcę móc ponowić generowanie sugestii AI oraz rozumieć powód braku sugestii, aby nie utknąć w procesie ustawiania planu.
- Kryteria akceptacji:
  1. Podczas generowania sugestii UI pokazuje stan ładowania i kończy próbę w czasie maks. 5 sekund.
  2. Dla błędów AI (timeout, błąd dostawcy, limit) UI pokazuje czytelny komunikat oraz dostępne akcje („Spróbuj ponownie”, „Ustaw ręcznie”).
  3. Dla limitu AI UI pokazuje czas odblokowania i umożliwia kontynuację bez AI.

### US-016 Akceptacja sugestii AI bez zmian lub po edycji (metadane akceptacji)
- ID: US-016
- Tytuł: Akceptacja sugestii AI bez zmian lub po edycji (metadane akceptacji)
- Opis: Jako hodowca chcę zaakceptować sugestię AI jednym kliknięciem lub zapisać ją po edycji, aby system pamiętał, czy plan był zmieniany.
- Kryteria akceptacji:
  1. Interfejs udostępnia akcje: „Akceptuj”, „Edytuj i zapisz”, „Odrzuć i ustaw ręcznie”.
  2. System zapisuje informację o źródle planu (AI vs ręczny) oraz czy został zaakceptowany bez zmian.
  3. Po zapisie planu użytkownik może przejść do kalendarza, aby zobaczyć wynikowy harmonogram.

### US-017 Podlewanie jednorazowe (adhoc)
- ID: US-017
- Tytuł: Podlewanie jednorazowe (adhoc)
- Opis: Jako hodowca chcę dodać jednorazowe podlewanie niezależnie od harmonogramu, aby odnotować wykonane czynności.
- Kryteria akceptacji:
  1. Z poziomu widoku dnia w kalendarzu można dodać wpis adhoc dla wybranej rośliny na bieżącą datę.
  2. Z poziomu szczegółów rośliny dostępna jest akcja „Podlej dzisiaj”, która tworzy wpis adhoc na dziś.
  3. Jeśli na dany dzień istnieje już wpis dla rośliny, system informuje o konflikcie i nie tworzy duplikatu.

### US-018 Usuwanie wpisu podlewania z potwierdzeniem
- ID: US-018
- Tytuł: Usuwanie wpisu podlewania z potwierdzeniem
- Opis: Jako hodowca chcę usunąć wpis podlewania (np. adhoc), aby skorygować błędne dane.
- Kryteria akceptacji:
  1. Usunięcie wpisu wymaga osobnego potwierdzenia przez użytkownika.
  2. Interfejs odróżnia usuwanie wpisu jednorazowego od wpisu zaplanowanego czytelnym komunikatem.
  3. Po usunięciu lista zadań i widoki kalendarza odświeżają się i pokazują aktualny stan.

### US-019 Dodanie lub zmiana zdjęcia rośliny (upload)
- ID: US-019
- Tytuł: Dodanie lub zmiana zdjęcia rośliny (upload)
- Opis: Jako hodowca chcę dodać lub zmienić zdjęcie rośliny, aby łatwiej ją rozpoznawać w aplikacji.
- Kryteria akceptacji:
  1. Użytkownik może wybrać plik, zobaczyć podgląd oraz postęp wysyłania zdjęcia.
  2. Po powodzeniu zdjęcie jest widoczne w szczegółach rośliny i (jeśli przewidziane) na liście roślin.
  3. W razie błędu uploadu użytkownik dostaje komunikat oraz możliwość ponowienia operacji.

### US-020 Ustawienia profilu (pseudonim i strefa czasowa)
- ID: US-020
- Tytuł: Ustawienia profilu (pseudonim i strefa czasowa)
- Opis: Jako użytkownik chcę ustawić pseudonim i strefę czasową, aby daty w kalendarzu były interpretowane poprawnie.
- Kryteria akceptacji:
  1. Widok ustawień pokazuje aktualne wartości profilu i umożliwia ich edycję.
  2. Zmiana strefy czasowej wpływa na interpretację i prezentację dat w kalendarzu.
  3. Po zapisaniu zmian użytkownik otrzymuje komunikat o powodzeniu operacji.

### US-021 Przekierowanie po zapisie planu do właściwego dnia w kalendarzu
- ID: US-021
- Tytuł: Przekierowanie po zapisie planu do właściwego dnia w kalendarzu
- Opis: Jako hodowca chcę po zapisaniu planu od razu trafić do dnia z zadaniami, aby rozpocząć pracę bez ręcznego szukania.
- Kryteria akceptacji:
  1. Po zapisaniu planu system kieruje użytkownika do widoku dnia „dziś”, jeśli na dziś istnieją zadania.
  2. Jeśli na dziś nie ma zadań, system kieruje użytkownika do najbliższego dnia z zadaniami.
  3. Użytkownik widzi potwierdzenie sukcesu („Plan zapisany”) i może przejść do szczegółów rośliny.

### US-022 Globalna obsługa braku połączenia i spójne przechwytywanie 401
- ID: US-022
- Tytuł: Globalna obsługa braku połączenia i spójne przechwytywanie 401
- Opis: Jako użytkownik chcę widzieć stan braku połączenia oraz być bezpiecznie przekierowany przy wygaśnięciu sesji, aby nie tracić czasu i danych.
- Kryteria akceptacji:
  1. Przy braku połączenia UI pokazuje czytelny komunikat globalny i umożliwia ponowienie kluczowych akcji.
  2. Dla błędu 401 użytkownik jest przekierowany do logowania z zachowaniem powrotu do poprzedniej strony po zalogowaniu.
  3. Formularze i akcje mutujące dane są chronione przed wielokrotnym wysłaniem (blokada podczas zapisu).

## 6. Metryki sukcesu
- Co najmniej 70% wygenerowanych planów podlewania jest akceptowanych bez zmian.
- Średni czas odpowiedzi modelu językowego nie przekracza 5 sekund w godzinach szczytu.

