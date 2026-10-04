# Film demo cyberKreta

Do zgłoszenia projektu trzeba dołączyć film z przykładowym zastosowaniem i narracją. Ten scenariusz jest przygotowany pod lektora z ElevenLabs. Te same teksty można nagrać własnym głosem.

Prezentacja: http://localhost:5173/demo. Bez lektora trwa 96 sekund. Z nagraniami może być dłuższa: każda scena trwa co najmniej tyle co jej wypowiedź plus sekunda oddechu. Czasy niżej dotyczą wersji bez nagrań.

## Przebieg

| Czas | Scena | Co pokazujemy |
| --- | --- | --- |
| 0:00-0:18 | Noc w biurze | Oryginalna animacja ze strony. Napięcie, odkrycie kreta, zejście pod podłogę. |
| 0:18-0:29 | Twoja firma | Osiem osób, akta klientów, pieniądze, ciągłość pracy. |
| 0:29-0:46 | Droga ataku | Pięć dróg ataku; przykład przejścia od internetu do akt klientów. |
| 0:46-0:55 | Pierwszy ruch | Zabezpieczenie dostępu zdalnego zamyka w modelu dwie z pięciu dróg. |
| 0:55-1:12 | Podejrzany mail | Podobna domena, nowe konto do przelewu, załącznik udający PDF. |
| 1:12-1:25 | Plan działania | Nikt nie zapłacił. Grażyna wstrzymuje przelewy i dzwoni do kontrahenta. |
| 1:25-1:36 | Twój kret | Lokalne przetwarzanie i hasło projektu. |

To prezentacja wyników aplikacji na fikcyjnych danych, z układem dostosowanym do filmu. Dane pobiera wyłącznie z `/api/demo/presentation`. Ten endpoint czyta pliki przykładowej firmy i uruchamia te same reguły co aplikacja. Nie resetuje bazy, nie uruchamia skanów sieci i nie zmienia zabezpieczeń. Wynik po pierwszej zmianie jest symulacją. Podczas prezentacji nie jest wywoływany model językowy.

## Co przekazać koledze z ElevenLabs

Potrzebujemy sześciu plików głosowych, po jednym do scen 02-07. Scena 01 zostaje bez lektora: widz czyta krótkie zdania i śledzi animację. Jeden polski głos przez cały film, spokojny i pewny, z naturalnymi pauzami. Bez głosu zwiastuna filmowego i bez przesadnego napięcia.

1. Otwórz ElevenLabs, przejdź do **Text to Speech**.
2. W **Voice Library** poszukaj głosu z językiem **Polish**. Odsłuchaj poniższy tekst próbny w dwóch lub trzech głosach i wybierz najbardziej naturalny. Nie wybieramy głosu tylko po angielskim podglądzie.
3. Wybierz **Eleven Multilingual v2**. Ten model daje stabilną narrację i dobrze obsługuje polski. Nie jest najnowszym modelem.
4. Ustaw punkt wyjścia: **Speed 0.95**, **Stability 50%**, **Similarity 75%**, **Style Exaggeration 0%**, **Speaker Boost włączony**, jeśli jest dostępny. To ustawienia do odsłuchu, nie gwarancja idealnego wyniku.
5. Wklej tekst jednej sceny, bez nagłówka i nazwy pliku. Kliknij **Generate Speech**, odsłuchaj. Zachowaj jeden głos i te same ustawienia we wszystkich scenach.
6. Pobierz MP3 lub WAV w najwyższej jakości dostępnej na koncie. Samo wybranie WAV nie podnosi jakości źródła. Nie ma potrzeby dokupowania wyższego planu dla tego demo.
7. Nazwij pliki dokładnie jak poniżej. Nie dodawaj muzyki do plików lektora. Nie sklejaj ich w jedną wypowiedź.

Tekst do wyboru głosu:

> Wygląda jak zwykła faktura. Ale domena tylko udaje znanego dostawcę. Cyber Kret pokazuje, co się nie zgadza, zanim ktoś wykona przelew.

W narracji piszemy „Cyber Kret”, aby ułatwić polską wymowę. W obrazie zostaje „cyberKret”. Jeśli głos czyta nazwę po angielsku, wybierz inny polski głos lub ustaw alias wymowy. Nie używaj angielskiego „sajber”.

### 02-firma.mp3

Kancelaria Nowak. Osiem osób, poufne akta i terminy, których nie można przesunąć. Nie ma własnego działu bezpieczeństwa. Jest Cyber Kret.

### 03-tunele.mp3

Kret łączy słabe punkty w drogi ataku. Tutaj: otwarty dostęp zdalny, przejęty komputer, a na końcu akta klientów. Pokazuje, co może się wydarzyć i z czego wynika zagrożenie.

### 04-ruch.mp3

Nie musisz naprawiać wszystkiego naraz. Pierwsza zmiana zajmuje około piętnastu minut. W tym scenariuszu zamyka dwie z pięciu dróg ataku.

### 05-mail.mp3

Przychodzi faktura. Znany dostawca, pilny przelew, nowy numer konta. Kret zauważa podobną domenę i załącznik, który tylko udaje dokument. Zamiast zgadywać, widzisz konkretne sygnały oszustwa. Wiesz, dlaczego nie płacić.

### 06-plan.mp3

Co dalej? Grażyna wstrzymuje przelewy i dzwoni do kontrahenta na numer z umowy. Zespół zachowuje wiadomość jako dowód. Każdy dostaje zadanie dopasowane do swojej roli.

### 07-final.mp3

Analiza działa lokalnie. Dane firmy zostają na jej komputerze. Cyber Kret. Lepiej, żeby pierwszy był twój kret.

## Odsłuch i synchronizacja

1. Otwórz http://localhost:5173/demo.
2. Kliknij **Lektor i nagranie**, następnie **Wczytaj MP3 lub WAV**. Wybierz naraz sześć plików. Numer na początku nazwy przypisuje nagranie do sceny.
3. Nazwy wczytanych plików pojawią się na zielono. Sprawdź sceny 02-07. Brak pliku oznacza ciszę w tej scenie, nie błąd prezentacji.
4. Przesłuchaj całość. Dłuższy lektor automatycznie wydłuża scenę. Krótszy zostawia chwilę na przeczytanie ekranu. Nie przyspieszaj głosu tylko po to, żeby zmieścić go w tabeli.
5. Poprawkę dogrywasz, wybierając ponownie tylko plik danej sceny. Wgranie plików cofa prezentację do początku. Odświeżenie strony usuwa wczytane nagrania z odtwarzacza.

Pliki są odtwarzane lokalnie w przeglądarce. Nie są wysyłane do serwera. Aplikacja nie potrzebuje klucza ElevenLabs.

Spacja zatrzymuje i wznawia film, strzałki przewijają o pięć sekund, Home wraca na początek, H ukrywa panel, Esc go pokazuje. Gdy zaznaczony jest przycisk lub suwak, działa jego zwykła obsługa klawiaturą. Przełączenie na inną kartę zatrzymuje prezentację, aby nie zgubić fragmentu nagrania.

## Nagranie do zgłoszenia

Rekomendowany format: poziomy obraz 1920 × 1080, 30 klatek na sekundę, MP4 z obrazem H.264 i dźwiękiem AAC. To ustawienia montażowe, nie ograniczenia organizatora. Faktyczny limit pliku i czas filmu sprawdźcie w formularzu wybranej kategorii.

1. Uruchom frontend i backend. Sprawdź pełne demo, wczytaj lektora, ustaw zwykłe powiększenie przeglądarki 100%.
2. Włącz pełny ekran przyciskiem **⛶**. Nagrywaj w poziomie. W pionowym oknie prezentacja układa elementy jeden pod drugim i wymaga przewijania.
3. W swoim programie do nagrywania ekranu wybierz okno przeglądarki oraz dźwięk aplikacji/systemu. Wyłącz mikrofon, jeśli korzystasz z ElevenLabs. Zrób krótki test: głos musi być obecny w zapisanym pliku, samo słyszenie go w słuchawkach nie wystarcza.
4. Rozpocznij nagrywanie. W prezentacji kliknij **Lektor i nagranie**, potem **Ukryj panel i odtwórz za 3 s**. Odliczanie daje czas na odsunięcie kursora. Kursor i sterowanie znikają w czasie odtwarzania.
5. Nie przełączaj kart i nie dotykaj klawiatury w trakcie ujęcia. Pozostaw końcowe hasło na ekranie do zatrzymania filmu.
6. Zakończ nagrywanie. W montażu odetnij początek z odliczaniem i końcówkę ze sterowaniem. Pierwszy kadr powinien być biurem, ostatni hasłem z logo.
7. Obejrzyj wyeksportowany plik od początku do końca. Sprawdź ostrość napisów, obecność lektora i brak powiadomień na ekranie. Dopiero ten plik dodaj do zgłoszenia.

Jeśli program na Macu nie zapisuje dźwięku systemowego, nagraj sam obraz, a pliki lektora dodaj w montażu. ElevenLabs Studio pozwala zaimportować własne wideo, umieścić narrację na osi czasu i wyeksportować film. Nie zakładaj, że nagranie przez systemowy skrót automatycznie zawiera głos z przeglądarki.

Muzyka jest opcjonalna. Jeśli ją dodacie, wybierzcie oszczędny instrumentalny podkład bez wokalu i wyraźnie ciszej niż lektor. Proponowany kierunek: delikatny puls, niski ambient, ciepłe rozwiązanie po pojawieniu się kreta. Bez agresywnych efektów alarmu. Pierwsze osiemnaście sekund może pracować samym obrazem.

## Źródła i stan przygotowania

Ustawienia ElevenLabs sprawdzone 2026-10-04:

- [Text to Speech: wybór głosu, ustawienia, generowanie](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech)
- [Modele: Multilingual v2 i obsługiwane języki](https://elevenlabs.io/docs/overview/models)
- [Studio: własne wideo, narracja, eksport](https://elevenlabs.io/docs/eleven-creative/products/studio)

Gotowe: prezentacja, scenariusz i miejsce na lokalne pliki lektora. Do wykonania przed zgłoszeniem: wygenerowanie lub nagranie głosu, odsłuch, nagranie ekranu, eksport i załączenie filmu. Repozytorium nie zawiera jeszcze gotowego filmu ani nagrań z ElevenLabs.
