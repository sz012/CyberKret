"""Suspicious payment request or fake invoice (business email compromise)."""
from .common import NO, UNKNOWN, YES, YES_NO, answer, boss_name, hypothesis, lvl, phone_line, safeguard_missing, why

ID = "fake_invoice"
LABEL = "Fake invoice or a request to change a bank account"

QUESTIONS = [
    {"id": "paid", "text": "Has anyone already paid to the new account number?",
     "options": [(YES, "Yes, the payment went out"), (NO, "No"), (UNKNOWN, "Not sure yet")]},
    {"id": "sent", "text": "Are there emails in the Sent folder that none of us wrote?",
     "options": [(YES, "Yes"), (NO, "No"), (UNKNOWN, "Not sure yet")]},
    {"id": "clicked", "text": "Did anyone click a link or type a password after this email?", "options": YES_NO},
    {"id": "clients", "text": "Could someone unauthorised have seen client data?", "options": YES_NO},
]

FACTS = {
    ("paid", YES): ("confirmed", "A payment to the fraudster's account has already gone out."),
    ("paid", NO): ("confirmed", "Nobody paid to the new account number."),
    ("paid", UNKNOWN): ("unverified", "We do not know whether anyone paid."),
    ("sent", YES): ("confirmed", "The Sent folder has emails nobody wrote."),
    ("sent", NO): ("confirmed", "There are no foreign emails in the Sent folder."),
    ("sent", UNKNOWN): ("unverified", "Nobody has checked the Sent folder yet."),
    ("clicked", YES): ("confirmed", "Someone clicked a link or typed a password."),
    ("clicked", NO): ("confirmed", "Nobody clicked links or typed a password."),
    ("clicked", UNKNOWN): ("unverified", "We do not know whether anyone clicked the link."),
    ("clients", YES): ("confirmed", "Someone unauthorised may have seen client data."),
    ("clients", NO): ("confirmed", "Client data was not exposed."),
    ("clients", UNKNOWN): ("unverified", "We do not know whether client data was exposed."),
}


def hypotheses(answers: dict, facts: list[dict], org: dict) -> dict:
    sent, clicked = answers.get("sent", UNKNOWN), answers.get("clicked", UNKNOWN)
    lookalike = any(f.get("type") in ("lookalike_sender", "reply_to_mismatch") for f in facts)

    if sent == YES or clicked == YES:
        takeover = "likely"
    elif sent == NO and clicked == NO:
        takeover = "unlikely"
    else:
        takeover = "possible"

    if takeover == "likely":
        spoof = "possible" if lookalike else "unlikely"
    elif lookalike or sent == NO:
        spoof = "likely"
    else:
        spoof = "possible"

    return {
        "spoof": hypothesis(
            "Impersonation from outside", spoof,
            "The fraudster writes from a similar domain or pretends to be our company. Our mailbox is intact.",
            why([(lookalike, "mail mole: the sender's domain imitates a known vendor"), (sent == NO, "no foreign emails in the Sent folder")]),
            "The mole warned you: the company domain has no DMARC." if safeguard_missing(org, "domain_dmarc") else None),
        "takeover": hypothesis(
            "Taken-over email account", takeover,
            "The fraudster has logged into our account and writes from it.",
            why([(sent == YES, "foreign emails in the Sent folder"), (clicked == YES, "someone typed a password"), (sent == UNKNOWN, "Sent folder not checked")]),
            "The mole warned you: the email accounts have no two-step login." if safeguard_missing(org, "m365_mfa") else None),
    }


ACTIONS = [
    {"id": "hold_payments", "phase": "stop", "title": "Stop payments to new account numbers",
     "detail": "No payment to an account number sent by email goes out until someone confirms it by phone.",
     "role": "finance", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "call_vendor", "phase": "assess", "title": "Call the vendor on the number from the contract",
     "detail": "Not on the number from the email. Ask whether they really changed their account.",
     "role": "finance", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "keep_evidence", "phase": "assess", "title": "Do not delete the email, it is evidence",
     "detail": "The mole saved a copy with headers. The bank, the police and CERT will need it.",
     "role": "all", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "untrusted_mail", "phase": "continue", "title": "Important matters by phone only",
     "detail": "Until further notice email is untrusted: confirmations, deadlines and payments go by phone.",
     "role": "office", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "bank_recall", "phase": "stop", "title": "Call the bank to stop the payment",
     "detail": "Ask them to hold or recall the payment. Hours matter. Give them the fraudster's account number.",
     "role": "finance", "priority": "now", "safe_any_cause": False, "when": lambda c: answer(c, "paid") == YES},
    {"id": "police", "phase": "notify", "title": "Report the fraud to the police",
     "detail": "Bring a printout of the email with headers and the payment confirmation. The bank may ask for it.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "paid") == YES},
    {"id": "check_payments", "phase": "assess", "title": "Check the bank for payments from the last 7 days",
     "detail": "Look for payments to account numbers that appear for the first time.",
     "role": "finance", "priority": "now", "safe_any_cause": True, "when": lambda c: answer(c, "paid") == UNKNOWN},
    {"id": "reset_password", "phase": "stop", "title": "Change the email password from another device",
     "detail": "Not from the computer where the email was opened.",
     "role": "it", "priority": "now", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "signout", "phase": "stop", "title": "Sign the email account out of every device",
     "detail": "In the email admin panel (Google or Microsoft) end all active sessions.",
     "role": "it", "priority": "now", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "inbox_rules", "phase": "stop", "title": "Check the mailbox forwarding rules",
     "detail": "Fraudsters add a rule that hides replies from vendors. Remove rules you do not recognise.",
     "role": "it", "priority": "15min", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "enable_mfa", "phase": "stop", "title": "Turn on two-step login (MFA) for email accounts",
     "detail": "Without a second step a password alone is enough to take over an account.",
     "role": "it", "priority": "15min", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "report_cert", "phase": "notify", "title": "Report the fake domain to CERT",
     "detail": "In Poland: incydent.cert.pl. CERT can block the fraudster's domain before it reaches other companies.",
     "role": "office", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "spoof") != "unlikely"},
    {"id": "add_dmarc", "phase": "stop", "title": "Add a DMARC record for the company domain",
     "detail": "With it nobody can send an email that looks as if it came from your company.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "spoof") != "unlikely"},
    {"id": "warn_clients", "phase": "notify", "title": "Warn clients through another channel",
     "detail": "Text message or phone: the company never changes its account number by email. A ready text is below.",
     "role": "office", "priority": "1h", "safe_any_cause": False,
     "when": lambda c: answer(c, "sent") in (YES, UNKNOWN) or answer(c, "clients") in (YES, UNKNOWN)},
    {"id": "verify_access", "phase": "assess", "title": "Find out whether an outsider saw client data",
     "detail": "Your IT person checks the email sign-in history for the last 30 days.",
     "role": "boss", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "clients") == UNKNOWN},
    {"id": "uodo", "phase": "notify", "title": "Report the breach to the data protection authority within 72 hours",
     "detail": "The deadline runs from the moment you become aware of the breach. In Poland: UODO, via biznes.gov.pl.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "clients") == YES},
]


def messages(org: dict, facts: list[dict], answers: dict) -> list[dict]:
    name = org.get("name") or "Our company"
    sender = next((f.get("quote") for f in facts if f.get("type") == "lookalike_sender" and f.get("quote")), None)
    boss = boss_name(org)
    return [
        {"id": "sms_clients", "channel": "Text message to clients",
         "text": f"{name}: someone is impersonating us or our vendors by email. We never change our account number by email. "
                 f"If in doubt, {phone_line(org)}"},
        {"id": "web_notice", "channel": "Notice for the website",
         "text": "Beware of fake emails. We have received reports of messages impersonating our company and our vendors. "
                 "Our bank account numbers have not changed. We confirm every change by phone."},
        {"id": "team", "channel": "Message to the team (text)",
         "text": f"Incident: fake invoice{f' from the domain {sender}' if sender else ''}. Until further notice: no payments to new account numbers, "
                 f"important matters by phone, do not delete suspicious emails.{f' {boss} is coordinating.' if boss else ''}"},
    ]


LESSONS = ["payment_callback_rule", "domain_dmarc", "m365_mfa"]
UODO_QUESTION = "clients"


def uodo(answers: dict, hyp: dict) -> bool:
    return answers.get("clients") == YES


def impact(answers: dict) -> dict:
    return {"untrusted": ["poczta", "konta"], "at_risk": ["procedury", "client_data_read", "money_stolen"],
            "note": "Email and accounts: untrusted. Until your IT person confirms the mailbox is clean, we confirm nothing by email."}
