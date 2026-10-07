"""Internet or mail is down: keep the company working and rule out an attack."""
from .common import NO, UNKNOWN, YES, YES_NO, answer, boss_name, hypothesis, lvl, phone_line, why

ID = "outage"
LABEL = "Internet or email is down"

NET, MAIL, BOTH = "internet", "mail", "both"
ALL, ONE = "all", "one"

QUESTIONS = [
    {"id": "what", "text": "What is not working?",
     "options": [(NET, "Internet"), (MAIL, "Only email"), (BOTH, "Internet and email")]},
    {"id": "scope", "text": "Does the problem affect every computer?",
     "options": [(ALL, "Yes, all of them"), (ONE, "Only one"), (UNKNOWN, "Not sure yet")]},
    {"id": "provider", "text": "Does the internet or email provider confirm an outage?", "options": YES_NO},
    {"id": "signs", "text": "Are there other worrying signs: changed passwords, a ransom note, strange messages?", "options": YES_NO},
]

FACTS = {
    ("what", NET): ("confirmed", "The internet is down."),
    ("what", MAIL): ("confirmed", "Email is down, the internet works."),
    ("what", BOTH): ("confirmed", "Neither the internet nor email works."),
    ("what", UNKNOWN): ("unverified", "We have not yet established what exactly is down."),
    ("scope", ALL): ("confirmed", "The problem affects every computer."),
    ("scope", ONE): ("confirmed", "The problem affects one computer."),
    ("scope", UNKNOWN): ("unverified", "We do not know how many computers are affected."),
    ("provider", YES): ("confirmed", "The provider confirms an outage on their side."),
    ("provider", NO): ("confirmed", "The provider sees no outage."),
    ("provider", UNKNOWN): ("unverified", "Nobody has asked the provider about an outage yet."),
    ("signs", YES): ("confirmed", "There are signs that may mean an attack."),
    ("signs", NO): ("confirmed", "No other worrying signs."),
    ("signs", UNKNOWN): ("unverified", "Nobody has checked for other signs of an attack."),
}


def hypotheses(answers: dict, facts: list[dict], org: dict) -> dict:
    scope, provider, signs = answers.get("scope", UNKNOWN), answers.get("provider", UNKNOWN), answers.get("signs", UNKNOWN)
    if provider == YES:
        outside, local = "likely", "unlikely"
    elif scope == ONE:
        outside, local = "unlikely", "likely"
    elif provider == NO:
        outside, local = "unlikely", "likely" if scope == ALL else "possible"
    else:
        outside, local = "possible", "possible"
    attack = "likely" if signs == YES else "unlikely" if signs == NO else "possible"
    return {
        "outside": hypothesis(
            "Outage at the operator or provider", outside,
            "The problem is outside the office. Wait it out and work through backup channels.",
            why([(provider == YES, "the provider confirms an outage")]), None),
        "local": hypothesis(
            "Problem in the office", local,
            "The router, a cable, computer settings or an expired subscription. Usually this can be fixed on site.",
            why([(scope == ONE, "the problem affects one computer"), (provider == NO, "the provider sees no outage")]), None),
        "attack": hypothesis(
            "An attack, not an outage", attack,
            "Changed passwords or a ransom note mean this is a security incident. Open the right playbook.",
            why([(signs == YES, "there are other worrying signs")]), None),
    }


def net(c: dict) -> bool:
    return answer(c, "what") in (NET, BOTH, UNKNOWN)


def mail(c: dict) -> bool:
    return answer(c, "what") in (MAIL, BOTH, UNKNOWN)


ACTIONS = [
    {"id": "check_scope", "phase": "assess", "title": "Check where exactly it does not work",
     "detail": "Another computer, a phone on the office Wi-Fi and a phone on mobile data. If it only works on mobile data, the problem is in the office or at the operator.",
     "role": "office", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "phone_mode", "phase": "continue", "title": "Urgent matters by phone",
     "detail": "Clients and vendors get a short note about the outage. A ready text is below.",
     "role": "office", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "restart_router", "phase": "stop", "title": "Restart the router and check the cables",
     "detail": "Turn the router off for 30 seconds. Check that the cables sit in their sockets and the lights look as usual.",
     "role": "it", "priority": "15min", "safe_any_cause": False, "when": lambda c: net(c) and lvl(c, "local") != "unlikely"},
    {"id": "call_provider", "phase": "assess", "title": "Call the internet operator",
     "detail": "The number is on the contract or an invoice. Ask about an outage in your area and when it will be fixed.",
     "role": "office", "priority": "15min", "safe_any_cause": False, "when": lambda c: net(c) and answer(c, "provider") == UNKNOWN},
    {"id": "mail_status", "phase": "assess", "title": "Check the email provider's status page",
     "detail": "Google Workspace Status Dashboard or the Microsoft 365 service status. If the internet is down, check from a phone.",
     "role": "it", "priority": "15min", "safe_any_cause": False, "when": lambda c: mail(c) and answer(c, "provider") == UNKNOWN},
    {"id": "hotspot", "phase": "continue", "title": "Start a backup connection from a phone",
     "detail": "Share the phone's internet with one computer for the most important things, such as banking and deadlines.",
     "role": "office", "priority": "15min", "safe_any_cause": False, "when": lambda c: net(c) and lvl(c, "attack") != "likely"},
    {"id": "no_private_mail", "phase": "continue", "title": "Do not send client data from private mailboxes",
     "detail": "It is convenient, but it takes data outside the company. Better a phone call, a meeting or waiting the outage out.",
     "role": "all", "priority": "15min", "safe_any_cause": False, "when": lambda c: mail(c)},
    {"id": "fix_one", "phase": "stop", "title": "Fix the settings of the one computer",
     "detail": "Check Wi-Fi, the cable, the system date and time and recently installed programs. Restart the computer.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "scope") == ONE},
    {"id": "attack_check", "phase": "assess", "title": "Check that it is not an attack",
     "detail": "Changed passwords, a ransom note or strange messages? Open the \"Encrypted files\" or \"Someone logged into our account\" incident.",
     "role": "boss", "priority": "now", "safe_any_cause": False, "when": lambda c: lvl(c, "attack") != "unlikely"},
    {"id": "log_outage", "phase": "learn", "title": "Write down how the outage went",
     "detail": "When it started, what helped, how long it lasted. Useful for a complaint to the operator and for a plan next time.",
     "role": "office", "priority": "verify", "safe_any_cause": False, "when": lambda c: True},
]


def messages(org: dict, facts: list[dict], answers: dict) -> list[dict]:
    name = org.get("name") or "Our company"
    what = {NET: "internet", MAIL: "email"}.get(answers.get("what", BOTH), "internet and email")
    boss = boss_name(org)
    return [
        {"id": "sms_clients", "channel": "Text message to clients",
         "text": f"{name}: our {what} is down. Emails may not reach us. For urgent matters {phone_line(org)} Thank you for your patience."},
        {"id": "team", "channel": "Message to the team (text)",
         "text": f"Our {what} is down. Urgent matters by phone, we do not send client data from private mailboxes. "
                 f"Updates on the fix will come by phone.{f' {boss} is coordinating.' if boss else ''}"},
    ]


LESSONS: list[str] = []
UODO_QUESTION = None


def uodo(answers: dict, hyp: dict) -> bool:
    return False


def impact(answers: dict) -> dict:
    what = answers.get("what", BOTH)
    untrusted = {NET: ["siec"], MAIL: ["poczta"]}.get(what, ["siec", "poczta"])
    return {"untrusted": untrusted, "at_risk": ["operations_stopped"],
            "note": "Internet or email: unavailable. We work through backup channels and do not move client data to private accounts."}
