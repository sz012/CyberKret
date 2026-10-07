"""Someone logged into a company mail or cloud account."""
from .common import NO, UNKNOWN, YES, YES_NO, answer, boss_name, hypothesis, lvl, phone_line, safeguard_missing, why

ID = "account_takeover"
LABEL = "Someone logged into our account"

QUESTIONS = [
    {"id": "access", "text": "Can you still log into this account?",
     "options": [(YES, "Yes"), (NO, "No, someone changed the password"), (UNKNOWN, "Not sure yet")]},
    {"id": "sent", "text": "Did emails that none of us wrote go out from the account?", "options": YES_NO},
    {"id": "reused", "text": "Was the same password used on other accounts?", "options": YES_NO},
    {"id": "clicked", "text": "Did anyone type the password on a page from a link in an email or a text message?", "options": YES_NO},
    {"id": "data", "text": "Was there client data in this account (emails, files)?", "options": YES_NO},
]

FACTS = {
    ("access", YES): ("confirmed", "We still have access to the account."),
    ("access", NO): ("confirmed", "Someone changed the password and we have no access to the account."),
    ("access", UNKNOWN): ("unverified", "Nobody has checked whether we can still log in."),
    ("sent", YES): ("confirmed", "Emails nobody wrote went out from the account."),
    ("sent", NO): ("confirmed", "No foreign emails went out from the account."),
    ("sent", UNKNOWN): ("unverified", "Nobody has checked the Sent folder yet."),
    ("reused", YES): ("confirmed", "The same password was used on other accounts."),
    ("reused", NO): ("confirmed", "The password was used only on this account."),
    ("reused", UNKNOWN): ("unverified", "We do not know whether the password was reused elsewhere."),
    ("clicked", YES): ("confirmed", "Someone typed the password on a page from a suspicious link."),
    ("clicked", NO): ("confirmed", "Nobody typed a password on pages from links."),
    ("clicked", UNKNOWN): ("unverified", "We do not know whether anyone typed the password on a fake page."),
    ("data", YES): ("confirmed", "There was client data in the account."),
    ("data", NO): ("confirmed", "There was no client data in the account."),
    ("data", UNKNOWN): ("unverified", "We do not know whether there was client data in the account."),
}


def hypotheses(answers: dict, facts: list[dict], org: dict) -> dict:
    reused, clicked = answers.get("reused", UNKNOWN), answers.get("clicked", UNKNOWN)
    phishing = "likely" if clicked == YES else "unlikely" if clicked == NO and reused == YES else "possible"
    leak = "likely" if reused == YES and clicked != YES else "unlikely" if reused == NO else "possible"
    mfa = "The mole warned you: email accounts sign in with a password alone." if safeguard_missing(org, "m365_mfa") else None
    return {
        "phishing": hypothesis(
            "Password phished on a fake page", phishing,
            "Someone typed the password on a forged login page and the criminal used it right away.",
            why([(clicked == YES, "someone typed the password on a page from a link")]), mfa),
        "leak": hypothesis(
            "Password from another site's leak", leak,
            "The same password leaked from another website, and criminals test leaked passwords against email accounts automatically.",
            why([(reused == YES, "the same password was used on other accounts")]), mfa),
    }


ACTIONS = [
    {"id": "reset_password", "phase": "stop", "title": "Change the password from another, clean device",
     "detail": "A long, new password you use nowhere else. Ideally from a password manager.",
     "role": "it", "priority": "now", "safe_any_cause": True, "when": lambda c: answer(c, "access") != NO},
    {"id": "recover", "phase": "stop", "title": "Recover the account through the provider's form",
     "detail": "Google and Microsoft have an account recovery form. Have the old phone number and the backup address ready.",
     "role": "it", "priority": "now", "safe_any_cause": False, "when": lambda c: answer(c, "access") == NO},
    {"id": "signout", "phase": "stop", "title": "Sign the account out of every device",
     "detail": "In the account's security settings end all sessions. The criminal loses access even with a remembered login.",
     "role": "it", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "enable_mfa", "phase": "stop", "title": "Turn on two-step login (MFA)",
     "detail": "A code from an app on your phone stops the next attempt, even if the password leaks again.",
     "role": "it", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "check_recovery", "phase": "assess", "title": "Check the account recovery phone and address",
     "detail": "Criminals swap them so they can come back. Remove numbers and addresses you do not know.",
     "role": "it", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "inbox_rules", "phase": "assess", "title": "Check forwarding rules and filters",
     "detail": "Remove rules that send emails to outside addresses or hide replies.",
     "role": "it", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "apps", "phase": "assess", "title": "Revoke access for unknown apps",
     "detail": "In the account settings look at connected apps and remove the ones you do not know.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: True},
    {"id": "other_accounts", "phase": "stop", "title": "Change the same password on other accounts",
     "detail": "Wherever the same password was used, the criminal gets in the same way.",
     "role": "all", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "reused") != NO},
    {"id": "check_payments", "phase": "assess", "title": "Check that no payment requests went out from the account",
     "detail": "A taken-over account is the perfect place for a fake invoice. Go through Sent and call the vendors who got emails.",
     "role": "finance", "priority": "now", "safe_any_cause": False, "when": lambda c: answer(c, "sent") == YES},
    {"id": "warn_contacts", "phase": "notify", "title": "Warn the people who got emails from the account",
     "detail": "By phone or from another account. A ready text is below.",
     "role": "office", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "sent") != NO},
    {"id": "report_cert", "phase": "notify", "title": "Report the fake login page to CERT",
     "detail": "In Poland: incydent.cert.pl. CERT warns others and can block the forged page.",
     "role": "office", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "phishing") != "unlikely"},
    {"id": "assess_data", "phase": "assess", "title": "Work out what the criminal could have seen",
     "detail": "The sign-in history shows when and from where they got in. Check whether there was client data in the account.",
     "role": "boss", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "data") == UNKNOWN},
    {"id": "uodo", "phase": "notify", "title": "Report the breach to the data protection authority within 72 hours",
     "detail": "A stranger had access to emails or files with client data. In Poland: UODO, via biznes.gov.pl.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "data") == YES},
]


def messages(org: dict, facts: list[dict], answers: dict) -> list[dict]:
    name = org.get("name") or "Our company"
    boss = boss_name(org)
    return [
        {"id": "contacts", "channel": "Message to contacts",
         "text": f"{name}: someone took over one of our email accounts and may have sent messages in our name. Do not open links or "
                 f"attachments from those emails and do not pay to account numbers given in them. If in doubt, {phone_line(org)}"},
        {"id": "team", "channel": "Message to the team (text)",
         "text": "An email account was taken over. Until further notice we do not trust emails from this account and handle important matters by phone. "
                 f"Do not type passwords on pages from links.{f' {boss} is coordinating.' if boss else ''}"},
    ]


LESSONS = ["m365_mfa", "payment_callback_rule"]
UODO_QUESTION = "data"


def uodo(answers: dict, hyp: dict) -> bool:
    return answers.get("data") == YES


def impact(answers: dict) -> dict:
    return {"untrusted": ["konta", "poczta"], "at_risk": ["client_data_read", "money_stolen"],
            "note": "The taken-over account: untrusted until the password is changed, sessions are ended and the mailbox rules are checked."}
