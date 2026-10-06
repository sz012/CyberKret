"""Attack techniques the mole simulates on the organization map.

A technique works when every safeguard in `requires_missing` is absent. An empty list means it always works
once the attacker stands at `src` (e.g. a mailbox owner can always read files on its drive).
`chamber` is where the weakness lives on the map; the tunnel is drawn through it.
"""

ENTRY = "internet"

POSITIONS = {
    "internet": "Internet",
    "rdp_session": "Computer with remote desktop open",
    "admin_all_pcs": "Admin on every computer",
    "m365_account": "Taken-over email account",
    "email_spoof": "Fake email from the company or a vendor",
    "client_data_read": "Client data",
    "money_stolen": "Money",
    "operations_stopped": "Business operations",
}

TECHNIQUES = [
    {
        "id": "T1", "name": "Open remote desktop",
        "src": ["internet"], "dst": "rdp_session", "chamber": "siec",
        "requires_missing": ["router_no_rdp"],
        "narration": "I come in from the internet straight onto a computer's desktop, because the router exposes port 3389. Bots try doors like this every few minutes.",
    },
    {
        "id": "T2", "name": "Shared admin password",
        "src": ["rdp_session"], "dst": "admin_all_pcs", "chamber": "komputery",
        "requires_missing": ["unique_admin_passwords"],
        "narration": "On this computer I pull out the admin account password. It also works on the other computers, so now I have all of them.",
    },
    {
        "id": "T3", "name": "Phishing an account without MFA",
        "src": ["internet"], "dst": "m365_account", "chamber": "konta",
        "requires_missing": ["m365_mfa"],
        "narration": "I send the person who handles invoices a fake email login page. The password alone is enough, because the account has no second step.",
    },
    {
        "id": "T4", "name": "Domain spoofing",
        "src": ["internet"], "dst": "email_spoof", "chamber": "poczta",
        "requires_missing": ["domain_dmarc"],
        "narration": "I write an email as your company or one of its vendors. Without DMARC the recipients' mailboxes have no grounds to reject it.",
    },
    {
        "id": "T5", "name": "Files in the account",
        "src": ["m365_account"], "dst": "client_data_read", "chamber": "konta",
        "requires_missing": [],
        "narration": "From the taken-over account I open the files in the cloud. The client data is right there.",
    },
    {
        "id": "T6", "name": "Workstation drives",
        "src": ["admin_all_pcs"], "dst": "client_data_read", "chamber": "komputery",
        "requires_missing": [],
        "narration": "As an admin I copy client data from the drives and the network shares.",
    },
    {
        "id": "T7", "name": "Encrypting the backups too",
        "src": ["admin_all_pcs"], "dst": "operations_stopped", "chamber": "kopie",
        "requires_missing": ["backup_offline"],
        "narration": "I run ransomware on every computer. The backup is always connected to the network, so it gets encrypted with everything else.",
    },
    {
        "id": "T8", "name": "Fake bank account number",
        "src": ["m365_account", "email_spoof"], "dst": "money_stolen", "chamber": "procedury",
        "requires_missing": ["payment_callback_rule"],
        "narration": "I ask the person who makes payments to use a new account number for an invoice. Nobody calls to confirm it, so the money comes to me.",
    },
]

TECHNIQUES_BY_ID = {t["id"]: t for t in TECHNIQUES}
