"""A company laptop was lost or stolen."""
from .common import NO, UNKNOWN, YES, YES_NO, answer, boss_name, hypothesis, lvl, phone_line, safeguard_missing, why

ID = "lost_laptop"
LABEL = "Lost or stolen laptop"

STOLEN, LOST = "stolen", "lost"

QUESTIONS = [
    {"id": "encrypted", "text": "Was the laptop's drive encrypted (BitLocker or FileVault)?", "options": YES_NO},
    {"id": "unlocked", "text": "Was the laptop on and unlocked when it went missing?", "options": YES_NO},
    {"id": "how", "text": "Was the laptop lost or stolen?",
     "options": [(STOLEN, "Stolen"), (LOST, "Lost"), (UNKNOWN, "Not sure")]},
    {"id": "data", "text": "Was clients' personal data on the laptop?", "options": YES_NO},
]

FACTS = {
    ("encrypted", YES): ("confirmed", "The laptop's drive was encrypted."),
    ("encrypted", NO): ("confirmed", "The laptop's drive was not encrypted."),
    ("encrypted", UNKNOWN): ("unverified", "We do not know whether the drive was encrypted."),
    ("unlocked", YES): ("confirmed", "The laptop was on and unlocked."),
    ("unlocked", NO): ("confirmed", "The laptop was off or locked."),
    ("unlocked", UNKNOWN): ("unverified", "We do not know whether the laptop was unlocked."),
    ("how", STOLEN): ("confirmed", "The laptop was stolen."),
    ("how", LOST): ("confirmed", "The laptop was lost, no theft was found."),
    ("how", UNKNOWN): ("unverified", "We do not know whether it was theft."),
    ("data", YES): ("confirmed", "Clients' personal data was on the laptop."),
    ("data", NO): ("confirmed", "There was no client data on the laptop."),
    ("data", UNKNOWN): ("unverified", "We do not know what data was on the laptop."),
}


def hypotheses(answers: dict, facts: list[dict], org: dict) -> dict:
    encrypted, unlocked = answers.get("encrypted", UNKNOWN), answers.get("unlocked", UNKNOWN)
    if encrypted == NO or unlocked == YES:
        exposed, safe = "likely", "unlikely"
    elif encrypted == YES and unlocked == NO:
        exposed, safe = "unlikely", "likely"
    else:
        exposed, safe = "possible", "possible"
    return {
        "safe": hypothesis(
            "Data protected by encryption", safe,
            "An encrypted, locked laptop is useless to whoever finds it without the password.",
            why([(encrypted == YES, "the drive was encrypted"), (unlocked == NO, "the laptop was off or locked")]),
            None),
        "exposed": hypothesis(
            "Data may be in someone else's hands", exposed,
            "Without encryption, or on an unlocked laptop, a stranger can read the files and get into signed-in accounts.",
            why([(encrypted == NO, "the drive was not encrypted"), (unlocked == YES, "the laptop was unlocked")]),
            "The mole warned you: laptop drives are not encrypted." if safeguard_missing(org, "disk_encryption") else None),
    }


ACTIONS = [
    {"id": "remote_lock", "phase": "stop", "title": "Lock the laptop remotely and try to locate it",
     "detail": "Use Find My Mac or Find my device in Windows, if they were on. Lock the screen with a message about how to reach you.",
     "role": "it", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "change_passwords", "phase": "stop", "title": "Change passwords for accounts used on the laptop",
     "detail": "Email, cloud, bank and password manager. Change them from another device, starting with email.",
     "role": "it", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "signout", "phase": "stop", "title": "Sign the laptop out of every account",
     "detail": "In your Google or Microsoft account settings remove this device from trusted devices and end its sessions.",
     "role": "it", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "bank", "phase": "stop", "title": "Tell the bank if the laptop had access to the company account",
     "detail": "The bank will block saved sessions and the device trusted for approving payments.",
     "role": "finance", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "spare", "phase": "continue", "title": "Prepare a replacement laptop",
     "detail": "Restore files from the backup or the cloud and sign in with the new passwords.",
     "role": "it", "priority": "1h", "safe_any_cause": True, "when": lambda c: True},
    {"id": "police", "phase": "notify", "title": "Report the theft to the police",
     "detail": "Give the laptop's serial number. The report confirmation will help with the insurer.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "how") != LOST},
    {"id": "remote_wipe", "phase": "stop", "title": "Wipe the laptop remotely",
     "detail": "When there is no chance of getting it back and the data may be in someone else's hands, a remote wipe settles the data on the drive.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "exposed") != "unlikely"},
    {"id": "assess_data", "phase": "assess", "title": "Find out what data was on the laptop",
     "detail": "Client files, passwords saved in the browser, access to email and the cloud. This decides whether you must notify the data protection authority.",
     "role": "boss", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "data") == UNKNOWN},
    {"id": "uodo", "phase": "notify", "title": "Report the breach to the data protection authority within 72 hours",
     "detail": "Client data may be in someone else's hands. In Poland: UODO, via biznes.gov.pl.",
     "role": "boss", "priority": "1h", "safe_any_cause": False,
     "when": lambda c: answer(c, "data") == YES and lvl(c, "exposed") != "unlikely"},
    {"id": "inform_clients", "phase": "notify", "title": "Tell the clients whose data may have leaked",
     "detail": "When the leak could harm them, you must warn them: what happened and what to watch out for. A ready text is below.",
     "role": "office", "priority": "1h", "safe_any_cause": False,
     "when": lambda c: answer(c, "data") == YES and lvl(c, "exposed") == "likely"},
]


def messages(org: dict, facts: list[dict], answers: dict) -> list[dict]:
    name = org.get("name") or "Our company"
    boss = boss_name(org)
    return [
        {"id": "team", "channel": "Message to the team (text)",
         "text": "A company laptop is missing. We are changing the email, cloud and bank passwords that were used on it. "
                 f"If anyone finds the laptop, do not turn it on and give it to the IT person.{f' {boss} is coordinating.' if boss else ''}"},
        {"id": "sms_clients", "channel": "Message to clients",
         "text": f"{name}: one of our company laptops is missing. We have secured our accounts and reported it. If you get an unusual message "
                 f"in our name, especially one asking for a payment, {phone_line(org)}"},
    ]


LESSONS = ["disk_encryption", "m365_mfa", "backup_offline"]
UODO_QUESTION = "data"


def uodo(answers: dict, hyp: dict) -> bool:
    return answers.get("data") == YES and hyp["exposed"]["level"] != "unlikely"


def impact(answers: dict) -> dict:
    return {"untrusted": ["komputery", "konta"], "at_risk": ["client_data_read"],
            "note": "The missing laptop and its accounts: untrusted. New passwords and ended sessions cut off access to them."}
