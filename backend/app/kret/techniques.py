from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class Position:
    id: str
    label: str
    kind: Literal["entry", "foothold", "target"]
    description: str


@dataclass(frozen=True)
class Technique:
    id: str
    name: str
    sources: tuple[str, ...]
    target: str
    requires: tuple[str, ...]
    narrative: str


POSITIONS: tuple[Position, ...] = (
    Position("internet", "Internet", "entry", "Każdy, kto ma dostęp do sieci."),
    Position("email_control", "Przejęta skrzynka", "foothold", "Pełny dostęp do poczty i dysku konta {mailbox}."),
    Position("email_spoof", "Podrobiony nadawca", "foothold", "Maile podpisane {mailbox}, wysłane przez kogoś obcego."),
    Position("software_admin", "Konto administratora", "foothold", "Zmiana haseł i blokada programu księgowego."),
    Position("client_data_read", "Dane klientów", "target", "Faktury, wyciągi i listy płac klientów (RODO)."),
    Position("ksef_access", "Faktury w KSeF", "target", "Wgląd w faktury klientów w KSeF."),
    Position("clients_pay_attacker", "Pieniądze klientów", "target", "Klienci płacą na rachunek oszusta."),
    Position("deadlines_missed", "Terminy klientów", "target", "Biuro traci dostęp do programu w dniu terminu."),
)

TECHNIQUES: tuple[Technique, ...] = (
    Technique(
        "T1",
        "Fałszywa strona logowania",
        ("internet",),
        "email_control",
        ("email_mfa",),
        "Wysyłam na {mailbox} link do fałszywej strony logowania. "
        "Jedno kliknięcie wystarczy, bo logowanie nie wymaga drugiego kroku.",
    ),
    Technique(
        "T2",
        "Wspólne hasło",
        ("internet",),
        "email_control",
        ("email_mfa", "email_unique_password"),
        "Hasło do {mailbox} zna kilka osób. Wystarczy, że jedna z nich użyła go w serwisie, z którego wyciekło.",
    ),
    Technique(
        "T3",
        "Stary numer odzyskiwania",
        ("internet",),
        "email_control",
        ("email_recovery_current",),
        "Numer do odzyskiwania konta należy do kogoś spoza biura. Resetuję nim hasło.",
    ),
    Technique(
        "T4",
        "Podszycie pod adres biura",
        ("internet",),
        "email_spoof",
        ("domain_dmarc",),
        "Wysyłam maila podpisanego {mailbox} z własnego serwera. "
        "Domena {domain} nie ma DMARC, więc skrzynki klientów go przyjmują.",
    ),
    Technique(
        "T5",
        "Reset hasła przez skrzynkę",
        ("email_control",),
        "software_admin",
        ("software_admin_mfa",),
        "Ze skrzynki resetuję hasło administratora programu księgowego.",
    ),
    Technique(
        "T6",
        "Dysk skrzynki",
        ("email_control",),
        "client_data_read",
        (),
        "Na dysku konta {mailbox} leżą faktury, wyciągi i listy płac klientów.",
    ),
    Technique(
        "T7",
        "Fałszywy numer rachunku",
        ("email_control", "email_spoof"),
        "clients_pay_attacker",
        ("payments_fixed_accounts",),
        "Piszę do klientów, że zmienił się rachunek do płatności podatku. "
        "Nikt im nie powiedział, że rachunek nigdy nie zmienia się mailem.",
    ),
    Technique(
        "T8",
        "Arkusz z dostępami do KSeF",
        ("client_data_read",),
        "ksef_access",
        ("ksef_credentials_vault",),
        "W tym samym miejscu leży arkusz z dostępami do KSeF klientów.",
    ),
    Technique(
        "T9",
        "Link do folderu klientów",
        ("internet",),
        "client_data_read",
        ("client_folder_private",),
        "Folder z dokumentami klientów jest udostępniony linkiem. Nie muszę się nigdzie logować.",
    ),
    Technique(
        "T10",
        "Blokada programu",
        ("software_admin",),
        "deadlines_missed",
        (),
        "Zmieniam hasło administratora. W dniu terminu biuro nie wejdzie do programu.",
    ),
)
