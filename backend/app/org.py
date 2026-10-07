"""The organization map: template for your own company, people and duties, help texts for safeguards."""
import json
import re
import uuid

from . import config

DUTY_LABEL = {"boss": "owner", "finance": "accounting", "office": "office", "it": "IT"}
DUTY_NOBODY = {"boss": "Company owner", "finance": "Person who makes payments", "office": "Office", "it": "IT person", "all": "Everyone"}
DOMAIN_RE = re.compile(r"^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$")

SAFEGUARD_HELP = {
    "router_no_rdp": "In the router admin panel (usually 192.168.1.1) look at port forwarding. Port 3389 means remote desktop is visible from the internet.",
    "unique_admin_passwords": "Ask your IT person whether admin accounts on the computers have different passwords or whether Windows LAPS is in use.",
    "pcs_updated": "Windows: Settings → Windows Update. Mac: System Settings → General → Software Update.",
    "disk_encryption": "Windows: BitLocker or Device encryption. Mac: FileVault. The \"Check this computer\" button in Tunnels checks this computer.",
    "m365_mfa": "In your Google or Microsoft account settings check whether signing in requires a code from a phone.",
    "domain_spf": "The mole checks this by itself: enter the domain in \"Check the domain from outside\" in Tunnels.",
    "domain_dmarc": "The mole checks this by itself: enter the domain in \"Check the domain from outside\" in Tunnels.",
    "payment_callback_rule": "Ask the person who makes payments what they do when a vendor asks by email to use a new account number.",
    "backup_offline": "Is any backup kept on a drive that is normally disconnected from the computer and the network?",
    "backup_tested": "When did someone last restore a file from the backup and check that it opens?",
    "website_updated": "Ask whoever runs the website, or look in the hosting panel.",
    "website_https": "The mole checks this by itself when it checks the domain.",
}


class OrgError(ValueError):
    pass


def template(name: str) -> dict:
    org = json.loads((config.SEED_DIR / "company_template.json").read_text())
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
        raise OrgError(f"\"{value}\" does not look like a domain, for example company.com")
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
