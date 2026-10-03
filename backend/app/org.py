"""The organization map: template for your own firm, people and duties, help texts for safeguards."""
import json
import re
import uuid

from . import config

DUTY_LABEL = {"boss": "szef", "finance": "księgowość", "office": "biuro", "it": "informatyk"}
DUTY_NOBODY = {"boss": "Szef firmy", "finance": "Osoba od płatności", "office": "Biuro", "it": "Informatyk", "all": "Wszyscy"}
DOMAIN_RE = re.compile(r"^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$")

SAFEGUARD_HELP = {
    "router_no_rdp": "W panelu routera (zwykle adres 192.168.1.1) zobacz przekierowania portów. Port 3389 oznacza pulpit zdalny widoczny z internetu.",
    "unique_admin_passwords": "Zapytaj informatyka, czy konta administratora na komputerach mają różne hasła albo czy działa Windows LAPS.",
    "pcs_updated": "Windows: Ustawienia → Windows Update. Mac: Ustawienia systemowe → Ogólne → Uaktualnienia.",
    "disk_encryption": "Windows: BitLocker lub Szyfrowanie urządzenia. Mac: FileVault. Ten komputer sprawdzi przycisk „Sprawdź ten komputer” w Tunelach.",
    "m365_mfa": "W ustawieniach konta Google lub Microsoft zobacz, czy logowanie wymaga kodu z telefonu.",
    "domain_spf": "Kret sprawdzi to sam: wpisz domenę w „Sprawdź domenę z zewnątrz” w Tunelach.",
    "domain_dmarc": "Kret sprawdzi to sam: wpisz domenę w „Sprawdź domenę z zewnątrz” w Tunelach.",
    "payment_callback_rule": "Zapytaj osobę od płatności, co robi, gdy kontrahent prosi mailem o nowy numer konta.",
    "backup_offline": "Czy jakaś kopia leży na dysku, który na co dzień jest odłączony od komputera i sieci?",
    "backup_tested": "Kiedy ostatnio ktoś odtworzył plik z kopii i sprawdził, że się otwiera?",
    "website_updated": "Zapytaj osobę, która prowadzi stronę, albo zajrzyj do panelu hostingu.",
    "website_https": "Kret sprawdzi to sam przy sprawdzaniu domeny.",
}


class OrgError(ValueError):
    pass


def template(name: str) -> dict:
    org = json.loads((config.SEED_DIR / "firma_szablon.json").read_text())
    org["name"] = name.strip()
    return org


def enrich(org: dict) -> dict:
    out = {**org, "safeguards": [{**s, "help": SAFEGUARD_HELP.get(s["id"], "")} for s in org["safeguards"]]}
    out.setdefault("demo", False)
    out.setdefault("phone", "")
    out.setdefault("mailbox_owner", None)
    out.setdefault("continuity", [])
    return out


def person_for(org: dict, duty: str) -> dict | None:
    return next((p for p in org.get("people", []) if p.get("duty") == duty), None)


def role_label(org: dict, duty: str) -> str:
    if duty == "all":
        return DUTY_NOBODY["all"]
    p = person_for(org, duty)
    if not p:
        return DUTY_NOBODY.get(duty, duty)
    return f"{p['name'].split()[0]} ({DUTY_LABEL[duty]})"


def mailbox_owner(org: dict) -> dict | None:
    people = org.get("people", [])
    return (next((p for p in people if p["id"] == org.get("mailbox_owner")), None)
            or person_for(org, "finance") or (people[0] if people else None))


def first_name(person: dict | None) -> str | None:
    return person["name"].split()[0] if person and person.get("name") else None


def normalize_domain(value: str) -> str:
    d = value.strip().lower().removeprefix("https://").removeprefix("http://").split("/")[0].removeprefix("www.")
    if d and not DOMAIN_RE.match(d):
        raise OrgError(f"„{value}” nie wygląda na domenę, na przykład firma.pl")
    return d


def apply_profile(org: dict, profile: dict) -> dict:
    org = dict(org)
    org["name"] = profile["name"].strip()
    org["domain"] = normalize_domain(profile["domain"])
    org["phone"] = profile["phone"].strip()
    org["description"] = profile["description"].strip()
    old_ids = {p["id"] for p in org.get("people", [])}
    people = []
    for p in profile["people"]:
        pid = p.get("id") if p.get("id") in old_ids else uuid.uuid4().hex[:8]
        people.append({"id": pid, "name": p["name"].strip(), "role": p["role"].strip(), "duty": p["duty"]})
    org["people"] = people
    idx = profile.get("mailbox_owner_index")
    org["mailbox_owner"] = people[idx]["id"] if idx is not None and 0 <= idx < len(people) else (people[0]["id"] if people else None)
    org["contacts"] = [
        {"name": c["name"].strip(), "domain": normalize_domain(c["domain"]), "phone": c["phone"].strip(), "note": c["note"].strip()}
        for c in profile["contacts"]
    ]
    org["fallbacks"] = [
        {"id": f"fb{i}", "label": f["label"].strip(), "note": f["note"].strip()} for i, f in enumerate(profile["fallbacks"], 1)
    ]
    key = profile.get("key_deadline", "").strip()
    if key and org.get("continuity"):
        org["continuity"] = [{**org["continuity"][0], "label": key}, *org["continuity"][1:]]
    return org
