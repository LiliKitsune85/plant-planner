# Dokument wymagań produktu (PRD) - Plant Planner

## 1. Przegląd produktu
Plant Planner to webowa aplikacja wspierająca doświadczonych hodowców w zarządzaniu kolekcją roślin doniczkowych. Produkt łączy szybkie rozpoznawanie roślin po zdjęciu (odpowiedź AI w maks. 10 sekund) z bazą wiedzy i prostym kalendarzem pielęgnacji. System gromadzi wyłącznie niezbędne dane użytkownika (e-mail, hasło, pseudonim), umożliwia ręczne dodawanie roślin oraz zapewnia historię podlewania z 3 ostatnich miesięcy. Głównym celem MVP jest zwiększenie przeżywalności kolekcji użytkownika przy kontrolowanym koszcie operacyjnym dzięki limitom zapytań i dodawanych roślin.

## 2. Problem użytkownika
Doświadczeni hodowcy często posiadają dziesiątki roślin o odmiennych potrzebach pielęgnacyjnych. Trudność w szybkim zidentyfikowaniu gatunku, brak jednolitej bazy zaleceń oraz brak prostych narzędzi do śledzenia podlewania prowadzą do pomyłek i obumarcia okazów. Użytkownicy potrzebują rozwiązania, które ujednolici proces identyfikacji, poda wiarygodne rekomendacje pielęgnacyjne i pozwoli na bieżąco potwierdzać wykonane czynności bez przełączania się pomiędzy wieloma narzędziami.

## 3. Wymagania funkcjonalne
### 3.1 Rozpoznawanie i dodawanie roślin
- Użytkownik dodaje roślinę poprzez przesłanie zdjęcia; AI zwraca propozycję nazwy w maks. 10 s.
- Interfejs wymusza potwierdzenie lub odrzucenie propozycji przed zapisaniem rekordu.
- W przypadku odrzucenia użytkownik wpisuje nazwę ręcznie; korekta traktowana jest jako dodanie manualne (niezaliczane do statystyk AI).
- Manualne dodawanie wymaga min. nazwy rośliny; opcjonalnie pseudonim, opis, data zakupu, zdjęcie. System nadaje numery kolejnym duplikatom.
- Rekord rośliny przechowuje źródło pochodzenia (AI/manual), podstawowe dane użytkownika oraz daty utworzenia/aktualizacji.

### 3.2 Baza wiedzy i rekomendacje
- Aplikacja pobiera publicznie dostępne wytyczne dotyczące pielęgnacji i wyświetla je wraz z linkiem do źródła.
- Użytkownik ma prosty flow zatwierdzam/odrzucam. W przypadku odrzucenia może wprowadzić własną częstotliwość podlewania.
- Historia decyzji (akceptacja/odrzucenie) przechowywana jest przy roślinie w celu przyszłych analiz, ale MVP nie przewiduje telemetryki skuteczności manualnych wpisów.

### 3.3 Kalendarz i śledzenie podlewania
- Widok kalendarza miesięcznego prezentuje dni z zaplanowanym podlewaniem; po kliknięciu dnia użytkownik widzi listę roślin do obsługi.
- Dostępny jest widok miesięczny pojedynczej rośliny z zaznaczonymi datami ostatnich i przyszłych podlewań.
- Widok dzienny pozwala potwierdzić podlewanie każdej rośliny oraz edytować lub usunąć wpis.
- Kalendarz zasila oś czasu 3 miesięcy dla każdej rośliny, pokazując wykonane działania pielęgnacyjne.

### 3.4 Limity i anty-abuse
- Limit 20 zapytań AI na godzinę per adres IP. Przed pierwszym dodaniem zdjęcia pojawia się komunikat opisujący limit i konsekwencje blokady.
- W przypadku przekroczenia limitu użytkownik dostaje jasny komunikat, a akcja jest blokowana do resetu limitu. Brak mechanizmu wyjątków w MVP.

### 3.5 Bezpieczeństwo i zarządzanie danymi
- Konto użytkownika składa się z e-maila, hasła i pseudonimu; dane przechowywane zgodnie z RODO.
- Użytkownik może zażądać usunięcia konta. Proces wymaga podwójnego potwierdzenia, po którym dane są natychmiastowo kasowane bez okresu karencji.
- System rejestruje źródło dodania rośliny.

## 4. Granice produktu
- Brak mechanizmu wysyłania przypomnień (push, e-mail, SMS) o podlewaniu.
- Brak śledzenia nawożenia, oprysków i innych zabiegów poza podlewaniem.
- Brak funkcji udostępniania kalendarza lub integracji z zewnętrznymi kalendarzami.
- Brak aplikacji mobilnych; jedyną platformą jest aplikacja webowa responsywna.
- Brak możliwości zapisywania serii zdjęć roślin jako pamiętnika.
- Brak mechanizmu wnioskowania o bardziej złożonych harmonogramach lub podnoszenia limitów zapytań.
- Brak telemetryki skuteczności manualnego dodawania roślin oraz brak wersjonowania wpisów historycznych.

## 5. Historyjki użytkowników
### US-001 Dodanie rośliny poprzez zdjęcie
- ID: US-001
- Tytuł: Dodanie rośliny poprzez zdjęcie
- Opis: Jako zalogowany hodowca chcę przesłać zdjęcie rośliny, aby system rozpoznał gatunek i przyspieszył dodanie rekordu.
- Kryteria akceptacji:
  1. Po wgraniu zdjęcia użytkownik widzi propozycję nazwy najpóźniej po 10 sekundach.
  2. System zapisuje rekord dopiero po wyraźnym potwierdzeniu nazwy.
  3. Dodanie zwiększa dzienny limit roślin użytkownika.

### US-002 Weryfikacja rozpoznania AI
- ID: US-002
- Tytuł: Weryfikacja rozpoznania AI
- Opis: Jako hodowca chcę potwierdzić lub odrzucić nazwę zaproponowaną przez AI, aby mieć kontrolę nad poprawnością danych.
- Kryteria akceptacji:
  1. Widoczny jest przycisk zatwierdzam i odrzucam wraz z krótką charakterystyką gatunku.
  2. Odrzucenie wymusza wpisanie własnej nazwy i oznacza rekord jako manualny.
  3. Dopiero zaakceptowane lub poprawione rozpoznanie pozwala przejść dalej do rekomendacji.

### US-003 Manualne dodawanie rośliny
- ID: US-003
- Tytuł: Manualne dodawanie rośliny
- Opis: Jako hodowca chcę dodać roślinę bez zdjęcia, aby szybko dopisać brakujące okazy.
- Kryteria akceptacji:
  1. Formularz wymaga jedynie nazwy gatunku, pozostałe pola są opcjonalne.
  2. System automatycznie numeruje duplikaty tej samej nazwy.
  3. Rekord oznaczony jako manualny nie wpływa na statystykę skuteczności AI.
  4. Dodanie wpisu ręcznie nie wpływa na limit zapytań.

### US-004 Przegląd i zatwierdzanie rekomendacji
- ID: US-004
- Tytuł: Przegląd i zatwierdzanie rekomendacji
- Opis: Jako hodowca chcę widzieć źródło rekomendacji pielęgnacyjnych i zdecydować, czy je przyjmuję, aby zachować kontrolę nad harmonogramem.
- Kryteria akceptacji:
  1. Każda rekomendacja zawiera nazwę źródła i link.
  2. Użytkownik ma dwustopniowy flow: zatwierdzam lub odrzucam i wpisuję własną częstotliwość podlewania rośliny.
  3. Decyzja jest zapisywana przy roślinie i wpływa na kalendarz.

### US-005 Widok kalendarza miesięcznego
- ID: US-005
- Tytuł: Widok kalendarza miesięcznego
- Opis: Jako hodowca chcę zobaczyć miesiąc z zaznaczonymi dniami podlewania, aby planować pielęgnację.
- Kryteria akceptacji:
  1. Kalendarz pokazuje dni z zadaniami oraz liczbę roślin na dany dzień.
  2. Kliknięcie dnia otwiera listę roślin do obsługi.
  3. Widok odświeża się po każdej zmianie harmonogramu.

### US-006 Widok dzienny i potwierdzanie podlewania
- ID: US-006
- Tytuł: Widok dzienny i potwierdzanie podlewania
- Opis: Jako hodowca chcę przejrzeć rośliny zaplanowane na dany dzień i potwierdzić podlewanie każdej z nich.
- Kryteria akceptacji:
  1. Po wejściu w dzień lista pokazuje status każdej rośliny (do zrobienia/wykonane).
  2. Kliknięcie potwierdź zapisuje wpis i aktualizuje kalendarz.
  3. Każdy wpis można wycofać lub edytować w czasie rzeczywistym.

### US-007 Widok miesięczny pojedynczej rośliny
- ID: US-007
- Tytuł: Widok miesięczny pojedynczej rośliny
- Opis: Jako hodowca chcę podejrzeć kalendarz jednej rośliny, aby ocenić spójność pielęgnacji.
- Kryteria akceptacji:
  1. Widok pokazuje ostatnie i nadchodzące podlewania w układzie miesięcznym.
  2. Widoczne są rekomendowane odstępy między podlewaniami.
  3. Przejście do historii otwiera oś czasu 3 miesięcy.

### US-008 Historia podlewania
- ID: US-008
- Tytuł: Historia podlewania
- Opis: Jako hodowca chcę zobaczyć oś czasu z ostatnich 3 miesięcy, aby przeanalizować regularność podlewania każdej rośliny.
- Kryteria akceptacji:
  1. Historia pokazuje daty i status (pominięte/wykonane) z ostatnich 90 dni.
  2. Kliknięcie wpisu umożliwia edycję lub usunięcie.
  3. Usunięcie aktualizuje kalendarz oraz statystyki podlewań.

### US-009 Edycja wpisu podlewania
- ID: US-009
- Tytuł: Edycja wpisu podlewania
- Opis: Jako hodowca chcę edytować błędnie zapisane podlewanie, aby zachować poprawne dane.
- Kryteria akceptacji:
  1. Formularz edycji pozwala zmienić datę i notatkę wpisu.
  2. Zapisanie aktualizacji nadpisuje pierwotny timestamp zgodnie z wymaganiami.
  3. Po edycji kalendarz i historia natychmiast się aktualizują.

### US-010 Komunikacja limitów i blokady
- ID: US-010
- Tytuł: Komunikacja limitów i blokady
- Opis: Jako użytkownik chcę znać limity dodawania roślin i zapytań AI, aby uniknąć blokad i planować działania.
- Kryteria akceptacji:
  1. Przed pierwszym dodaniem zdjęcia wyświetla się komunikat o limicie 20 zapytań/h per IP.
  2. Po przekroczeniu limitu użytkownik otrzymuje jasny komunikat o czasie odblokowania.
  3. System uniemożliwia dalsze dodawanie wpisów z użyciem zdjęcia do czasu resetu limitu.
  4. Użytkownik ma możliwość dodania wpisu o roślinie ręcznie.

### US-011 Uwierzytelnianie i bezpieczny dostęp
- ID: US-011
- Tytuł: Uwierzytelnianie i bezpieczny dostęp
- Opis: Jako hodowca chcę bezpiecznie tworzyć konto i logować się za pomocą e-maila, hasła i pseudonimu, aby moje dane były chronione.
- Kryteria akceptacji:
  1. Rejestracja wymaga potwierdzenia adresu e-mail oraz ustalenia hasła spełniającego minimalne wymagania bezpieczeństwa.
  2. Logowanie jest możliwe tylko po wprowadzeniu poprawnych danych; sesje wygasają po okresie braku aktywności.
  3. Dane są przechowywane zgodnie z RODO, a komunikacja odbywa się po HTTPS.

### US-012 Usunięcie konta i danych
- ID: US-012
- Tytuł: Usunięcie konta i danych
- Opis: Jako użytkownik chcę mieć możliwość trwałego usunięcia konta wraz ze wszystkimi danymi roślin, aby spełnić wymagania prywatności.
- Kryteria akceptacji:
  1. Proces wymaga dwóch kroków potwierdzenia (np. hasło i dodatkowe potwierdzenie).
  2. Po potwierdzeniu wszystkie dane użytkownika i jego roślin są nieodwracalnie usuwane.
  3. Użytkownik otrzymuje potwierdzenie operacji i natychmiast jest wylogowany.

## 6. Metryki sukcesu
- 75% rozpoznań AI jest potwierdzanych przez użytkowników jako prawidłowe.
- Średni czas odpowiedzi modułu AI nie przekracza 10 sekund w godzinach szczytu.

