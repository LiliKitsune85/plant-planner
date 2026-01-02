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
  1. Rejestracja wymaga potwierdzenia adresu e-mail oraz silnego hasła.
  2. Logowanie jest możliwe tylko po podaniu poprawnych danych; sesje wygasają po braku aktywności.
  3. Dostęp do danych odbywa się wyłącznie po HTTPS.

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

## 6. Metryki sukcesu
- Co najmniej 70% wygenerowanych planów podlewania jest akceptowanych bez zmian.
- Średni czas odpowiedzi modelu językowego nie przekracza 5 sekund w godzinach szczytu.

