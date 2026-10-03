"""Encrypted files and a ransom note (ransomware)."""
from .common import NO, UNKNOWN, YES, YES_NO, answer, boss_name, hypothesis, lvl, phone_line, safeguard_missing, why

ID = "ransomware"
LABEL = "Zaszyfrowane pliki (ransomware)"

ONE, MANY = "one", "many"

QUESTIONS = [
    {"id": "spread", "text": "Ile komputerów pokazuje zaszyfrowane pliki albo żądanie okupu?",
     "options": [(ONE, "Jeden"), (MANY, "Więcej niż jeden"), (UNKNOWN, "Nie wiem jeszcze")]},
    {"id": "backup", "text": "Czy macie kopię zapasową, która leżała odłączona od sieci?", "options": YES_NO},
    {"id": "note", "text": "Czy na ekranie albo w folderach jest żądanie okupu od przestępców?", "options": YES_NO},
    {"id": "data", "text": "Czy na zaszyfrowanych komputerach były dane osobowe klientów?", "options": YES_NO},
]

FACTS = {
    ("spread", ONE): ("confirmed", "Zaszyfrowany jest jeden komputer."),
    ("spread", MANY): ("confirmed", "Zaszyfrowanych jest kilka komputerów."),
    ("spread", UNKNOWN): ("unverified", "Nie wiadomo jeszcze, ile komputerów zaszyfrowano."),
    ("backup", YES): ("confirmed", "Jest kopia, która leżała odłączona od sieci."),
    ("backup", NO): ("confirmed", "Nie ma kopii odłączonej od sieci."),
    ("backup", UNKNOWN): ("unverified", "Nie wiadomo, czy kopia offline jest cała."),
    ("note", YES): ("confirmed", "Przestępcy zostawili żądanie okupu."),
    ("note", NO): ("confirmed", "Nie ma żądania okupu."),
    ("note", UNKNOWN): ("unverified", "Nikt jeszcze nie szukał żądania okupu."),
    ("data", YES): ("confirmed", "Na zaszyfrowanych komputerach były dane osobowe klientów."),
    ("data", NO): ("confirmed", "Na zaszyfrowanych komputerach nie było danych klientów."),
    ("data", UNKNOWN): ("unverified", "Nie wiadomo, czy zaszyfrowano dane klientów."),
}


def hypotheses(answers: dict, facts: list[dict], org: dict) -> dict:
    spread = answers.get("spread", UNKNOWN)
    shared_admin = safeguard_missing(org, "unique_admin_passwords")
    rdp = safeguard_missing(org, "router_no_rdp")
    if spread == MANY:
        network, single = "likely", "unlikely"
    elif spread == ONE:
        network, single = ("possible" if shared_admin or rdp else "unlikely"), "likely"
    else:
        network, single = "possible", "possible"
    return {
        "single": hypothesis(
            "Zainfekowany jeden komputer", single,
            "Ktoś otworzył złośliwy załącznik albo program. Atak nie wyszedł poza to stanowisko.",
            why([(spread == ONE, "zaszyfrowany jest tylko jeden komputer")]),
            "Kret ostrzegał: komputery nie mają aktualizacji." if safeguard_missing(org, "pcs_updated") else None),
        "network": hypothesis(
            "Atak na całą sieć", network,
            "Przestępca wszedł do sieci i uruchomił szyfrowanie na wielu komputerach naraz.",
            why([(spread == MANY, "zaszyfrowanych jest kilka komputerów"), (rdp, "pulpit zdalny może być otwarty na internet"),
                 (shared_admin, "komputery mogą mieć to samo hasło administratora")]),
            "Kret ostrzegał: pulpit zdalny otwarty na internet." if rdp else
            "Kret ostrzegał: to samo hasło administratora na kilku komputerach." if shared_admin else None),
    }


ACTIONS = [
    {"id": "isolate", "phase": "stop", "title": "Odłącz zaszyfrowane komputery od sieci",
     "detail": "Wyjmij kabel sieciowy i wyłącz Wi-Fi. Nie wyłączaj komputera: w pamięci mogą zostać ślady potrzebne do analizy.",
     "role": "all", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "unplug_backup", "phase": "stop", "title": "Odłącz kopie zapasowe",
     "detail": "Wyjmij dyski USB i odłącz serwer kopii od sieci, zanim zaszyfrują się razem z resztą.",
     "role": "it", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "dont_pay", "phase": "assess", "title": "Nie płać okupu i nie pisz do przestępców",
     "detail": "Zapłata nie gwarantuje odzyskania plików i finansuje kolejne ataki. Decyzję podejmujcie razem z CERT Polska i policją.",
     "role": "boss", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "keep_evidence", "phase": "assess", "title": "Zachowaj ślady",
     "detail": "Sfotografuj ekran z żądaniem okupu i zapisz nazwy kilku zaszyfrowanych plików. Niczego nie kasuj.",
     "role": "all", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "list_machines", "phase": "assess", "title": "Spisz, które komputery są zaszyfrowane",
     "detail": "Sprawdź każde stanowisko: czy pliki mają dziwne rozszerzenie i czy jest plik z instrukcją od przestępców.",
     "role": "it", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "close_remote", "phase": "stop", "title": "Zamknij pulpit zdalny i inne zdalne dostępy",
     "detail": "Usuń przekierowanie portu 3389 w routerze i wyłącz programy do zdalnej pomocy, którymi przestępca mógł wejść.",
     "role": "it", "priority": "15min", "safe_any_cause": False, "when": lambda c: lvl(c, "network") != "unlikely"},
    {"id": "reset_admin", "phase": "stop", "title": "Zmień hasła administratorów i poczty z czystego urządzenia",
     "detail": "Przestępcy zwykle zabierają hasła przed szyfrowaniem. Zmieniaj je z komputera, który nie był w tej sieci.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "network") != "unlikely"},
    {"id": "report_cert", "phase": "notify", "title": "Zgłoś atak do CERT Polska",
     "detail": "incydent.cert.pl. CERT pomoże rozpoznać rodzaj ransomware i sprawdzi, czy istnieje darmowy deszyfrator (projekt No More Ransom).",
     "role": "office", "priority": "1h", "safe_any_cause": True, "when": lambda c: True},
    {"id": "police", "phase": "notify", "title": "Zgłoś przestępstwo na policję",
     "detail": "Weź zdjęcia żądania okupu i listę zaszyfrowanych komputerów.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "note") != NO},
    {"id": "check_backup", "phase": "assess", "title": "Sprawdź, czy kopia offline jest cała",
     "detail": "Podłącz ją tylko do czystego komputera odłączonego od sieci i otwórz kilka plików.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "backup") != NO},
    {"id": "restore", "phase": "continue", "title": "Odtwórz pliki z kopii na czystych komputerach",
     "detail": "Najpierw informatyk przeinstalowuje system na zaszyfrowanych komputerach. Dopiero potem odtwarzacie pliki z kopii.",
     "role": "it", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "backup") == YES},
    {"id": "no_backup", "phase": "assess", "title": "Ustal, skąd odzyskać dane bez kopii",
     "detail": "Sprawdź pocztę, chmurę, załączniki wysłane klientom i papierowe dokumenty. Zapytaj CERT o deszyfrator.",
     "role": "boss", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "backup") == NO},
    {"id": "assess_data", "phase": "assess", "title": "Ustal, czy zaszyfrowano dane klientów",
     "detail": "Od tego zależy zgłoszenie do UODO w ciągu 72 godzin.",
     "role": "boss", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "data") == UNKNOWN},
    {"id": "uodo", "phase": "notify", "title": "Zgłoś naruszenie do UODO w ciągu 72 godzin",
     "detail": "Zaszyfrowanie danych osobowych to naruszenie ich dostępności, a przestępcy często też je kopiują. Zgłoszenie przez biznes.gov.pl.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "data") == YES},
    {"id": "warn_clients", "phase": "notify", "title": "Uprzedź klientów o pracy awaryjnej",
     "detail": "Krótko i spokojnie: pracujemy awaryjnie, możliwe opóźnienia. Gotowy tekst poniżej.",
     "role": "office", "priority": "1h", "safe_any_cause": False,
     "when": lambda c: answer(c, "spread") != ONE or answer(c, "data") == YES},
]


def messages(org: dict, facts: list[dict], answers: dict) -> list[dict]:
    name = org.get("name") or "Nasza firma"
    boss = boss_name(org)
    return [
        {"id": "sms_clients", "channel": "SMS do klientów",
         "text": f"{name}: mamy awarię systemów komputerowych i pracujemy w trybie awaryjnym. Możliwe są opóźnienia. W pilnych sprawach {phone_line(org)}"},
        {"id": "web_notice", "channel": "Komunikat na stronę WWW",
         "text": "Z powodu awarii systemów komputerowych pracujemy w trybie awaryjnym. Za utrudnienia przepraszamy. Pilne sprawy prosimy zgłaszać telefonicznie."},
        {"id": "team", "channel": "Wiadomość do zespołu (SMS)",
         "text": "Atak ransomware. Nie włączajcie i nie podłączajcie do sieci komputerów bez zgody informatyka. Nie podłączajcie dysków z kopiami. "
                 f"Ważne sprawy telefonicznie.{f' Koordynuje {boss}.' if boss else ''}"},
    ]


LESSONS = ["backup_offline", "backup_tested", "router_no_rdp", "unique_admin_passwords"]
UODO_QUESTION = "data"


def uodo(answers: dict, hyp: dict) -> bool:
    return answers.get("data") == YES


def impact(answers: dict) -> dict:
    return {"untrusted": ["komputery", "kopie"], "at_risk": ["operations_stopped", "client_data_read"],
            "note": "Komputery i kopie: niezaufane. Nie podłączajcie ich do sieci, dopóki informatyk nie potwierdzi, że są czyste."}
