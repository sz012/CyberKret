"""Encrypted files and a ransom note (ransomware)."""
from .common import NO, UNKNOWN, YES, YES_NO, answer, boss_name, hypothesis, lvl, phone_line, safeguard_missing, why

ID = "ransomware"
LABEL = "Encrypted files (ransomware)"

ONE, MANY = "one", "many"

QUESTIONS = [
    {"id": "spread", "text": "How many computers show encrypted files or a ransom note?",
     "options": [(ONE, "One"), (MANY, "More than one"), (UNKNOWN, "Not sure yet")]},
    {"id": "backup", "text": "Do you have a backup that was kept disconnected from the network?", "options": YES_NO},
    {"id": "note", "text": "Is there a ransom note from the criminals on screen or in the folders?", "options": YES_NO},
    {"id": "data", "text": "Was clients' personal data on the encrypted computers?", "options": YES_NO},
]

FACTS = {
    ("spread", ONE): ("confirmed", "One computer is encrypted."),
    ("spread", MANY): ("confirmed", "Several computers are encrypted."),
    ("spread", UNKNOWN): ("unverified", "We do not know yet how many computers are encrypted."),
    ("backup", YES): ("confirmed", "There is a backup that was kept disconnected from the network."),
    ("backup", NO): ("confirmed", "There is no backup kept off the network."),
    ("backup", UNKNOWN): ("unverified", "We do not know whether the offline backup is intact."),
    ("note", YES): ("confirmed", "The criminals left a ransom note."),
    ("note", NO): ("confirmed", "There is no ransom note."),
    ("note", UNKNOWN): ("unverified", "Nobody has looked for a ransom note yet."),
    ("data", YES): ("confirmed", "Clients' personal data was on the encrypted computers."),
    ("data", NO): ("confirmed", "There was no client data on the encrypted computers."),
    ("data", UNKNOWN): ("unverified", "We do not know whether client data was encrypted."),
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
            "One infected computer", single,
            "Someone opened a malicious attachment or program. The attack did not spread beyond this workstation.",
            why([(spread == ONE, "only one computer is encrypted")]),
            "The mole warned you: the computers are not updated." if safeguard_missing(org, "pcs_updated") else None),
        "network": hypothesis(
            "Attack on the whole network", network,
            "A criminal got into the network and started encryption on many computers at once.",
            why([(spread == MANY, "several computers are encrypted"), (rdp, "remote desktop may be open to the internet"),
                 (shared_admin, "the computers may share one admin password")]),
            "The mole warned you: remote desktop is open to the internet." if rdp else
            "The mole warned you: the same admin password is used on several computers." if shared_admin else None),
    }


ACTIONS = [
    {"id": "isolate", "phase": "stop", "title": "Disconnect the encrypted computers from the network",
     "detail": "Pull the network cable and turn off Wi-Fi. Do not shut the computer down: memory may hold traces needed for analysis.",
     "role": "all", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "unplug_backup", "phase": "stop", "title": "Disconnect the backups",
     "detail": "Unplug USB drives and take the backup server off the network before they get encrypted with everything else.",
     "role": "it", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "dont_pay", "phase": "assess", "title": "Do not pay the ransom and do not write to the criminals",
     "detail": "Paying does not guarantee you get the files back and it funds the next attacks. Decide together with CERT and the police.",
     "role": "boss", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "keep_evidence", "phase": "assess", "title": "Keep the evidence",
     "detail": "Photograph the screen with the ransom note and write down the names of a few encrypted files. Delete nothing.",
     "role": "all", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "list_machines", "phase": "assess", "title": "List which computers are encrypted",
     "detail": "Check every workstation: do files have a strange extension and is there a file with instructions from the criminals?",
     "role": "it", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "close_remote", "phase": "stop", "title": "Close remote desktop and other remote access",
     "detail": "Remove the port 3389 forwarding on the router and turn off remote support tools the criminal may have used.",
     "role": "it", "priority": "15min", "safe_any_cause": False, "when": lambda c: lvl(c, "network") != "unlikely"},
    {"id": "reset_admin", "phase": "stop", "title": "Change admin and email passwords from a clean device",
     "detail": "Criminals usually take passwords before encrypting. Change them from a computer that was not on this network.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "network") != "unlikely"},
    {"id": "report_cert", "phase": "notify", "title": "Report the attack to CERT",
     "detail": "In Poland: incydent.cert.pl. CERT helps identify the ransomware and checks whether a free decryptor exists (the No More Ransom project).",
     "role": "office", "priority": "1h", "safe_any_cause": True, "when": lambda c: True},
    {"id": "police", "phase": "notify", "title": "Report the crime to the police",
     "detail": "Bring photos of the ransom note and the list of encrypted computers.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "note") != NO},
    {"id": "check_backup", "phase": "assess", "title": "Check that the offline backup is intact",
     "detail": "Connect it only to a clean computer that is off the network and open a few files.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "backup") != NO},
    {"id": "restore", "phase": "continue", "title": "Restore files from the backup onto clean computers",
     "detail": "First your IT person reinstalls the system on the encrypted computers. Only then restore the files from the backup.",
     "role": "it", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "backup") == YES},
    {"id": "no_backup", "phase": "assess", "title": "Work out where to recover data from without a backup",
     "detail": "Check email, the cloud, attachments sent to clients and paper documents. Ask CERT about a decryptor.",
     "role": "boss", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "backup") == NO},
    {"id": "assess_data", "phase": "assess", "title": "Find out whether client data was encrypted",
     "detail": "This decides whether you must notify the data protection authority within 72 hours.",
     "role": "boss", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "data") == UNKNOWN},
    {"id": "uodo", "phase": "notify", "title": "Report the breach to the data protection authority within 72 hours",
     "detail": "Encrypting personal data is a breach of its availability, and criminals often copy it too. In Poland: UODO, via biznes.gov.pl.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "data") == YES},
    {"id": "warn_clients", "phase": "notify", "title": "Let clients know you are on backup mode",
     "detail": "Short and calm: we are working on backup mode, delays are possible. A ready text is below.",
     "role": "office", "priority": "1h", "safe_any_cause": False,
     "when": lambda c: answer(c, "spread") != ONE or answer(c, "data") == YES},
]


def messages(org: dict, facts: list[dict], answers: dict) -> list[dict]:
    name = org.get("name") or "Our company"
    boss = boss_name(org)
    return [
        {"id": "sms_clients", "channel": "Text message to clients",
         "text": f"{name}: our computer systems are down and we are working on backup mode. Delays are possible. For urgent matters {phone_line(org)}"},
        {"id": "web_notice", "channel": "Notice for the website",
         "text": "Because of a computer system failure we are working on backup mode. We apologise for the inconvenience. Please report urgent matters by phone."},
        {"id": "team", "channel": "Message to the team (text)",
         "text": "Ransomware attack. Do not turn on computers or connect them to the network without the IT person's approval. Do not plug in backup drives. "
                 f"Important matters by phone.{f' {boss} is coordinating.' if boss else ''}"},
    ]


LESSONS = ["backup_offline", "backup_tested", "router_no_rdp", "unique_admin_passwords"]
UODO_QUESTION = "data"


def uodo(answers: dict, hyp: dict) -> bool:
    return answers.get("data") == YES


def impact(answers: dict) -> dict:
    return {"untrusted": ["komputery", "kopie"], "at_risk": ["operations_stopped", "client_data_read"],
            "note": "Computers and backups: untrusted. Do not connect them to the network until your IT person confirms they are clean."}
