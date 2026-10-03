"""Read-only checks of the computer the kret runs on. Every command is a status query with a timeout; nothing is changed."""
import platform
import subprocess

TIMEOUT = 5


def _run(cmd: list[str]) -> str | None:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return (p.stdout + p.stderr).strip()


def _check(id_, label, cmd, ok_if, ok_text, bad_text, fix):
    out = _run(cmd)
    if out is None:
        return {"id": id_, "label": label, "level": "unknown", "text": "nie udało się sprawdzić", "raw": None, "fix": fix}
    ok = ok_if(out.lower())
    return {"id": id_, "label": label, "level": "ok" if ok else "bad", "text": ok_text if ok else bad_text,
            "raw": out.splitlines()[0] if out else "", "fix": None if ok else fix}


def check() -> dict:
    system = platform.system()
    if system != "Darwin":
        return {"system": system, "supported": False, "checks": [],
                "note": "W prototypie lokalny agent obsługuje macOS. Windows: w planie (BitLocker, Defender, Firewall)."}
    version = _run(["sw_vers", "-productVersion"]) or "?"
    checks = [
        _check("firewall", "Zapora sieciowa", ["/usr/libexec/ApplicationFirewall/socketfilterfw", "--getglobalstate"],
               lambda o: "enabled" in o or "state = 1" in o, "włączona", "wyłączona",
               "Ustawienia systemowe → Sieć → Zapora: włącz."),
        _check("filevault", "Szyfrowanie dysku (FileVault)", ["fdesetup", "status"],
               lambda o: "filevault is on" in o, "włączone", "wyłączone",
               "Ustawienia systemowe → Prywatność i ochrona → FileVault: włącz."),
        _check("gatekeeper", "Ochrona przed nieznanymi aplikacjami", ["spctl", "--status"],
               lambda o: "assessments enabled" in o, "włączona", "wyłączona",
               "W Terminalu: sudo spctl --master-enable"),
        _check("sip", "Ochrona integralności systemu", ["csrutil", "status"],
               lambda o: "enabled" in o, "włączona", "wyłączona",
               "Włącz SIP z trybu odzyskiwania (csrutil enable)."),
        _check("autoupdate", "Automatyczne sprawdzanie aktualizacji",
               ["defaults", "read", "/Library/Preferences/com.apple.SoftwareUpdate", "AutomaticCheckEnabled"],
               lambda o: o.strip() == "1" or "does not exist" in o, "włączone", "wyłączone",
               "Ustawienia systemowe → Ogólne → Uaktualnienia: włącz automatyczne."),
    ]
    return {"system": f"macOS {version}", "hostname": platform.node(), "supported": True, "checks": checks}


def apply_to_org(org: dict, result: dict) -> list[str]:
    """Only FileVault maps onto the org map: a missing one on this computer means not every disk is encrypted."""
    fv = next((c for c in result.get("checks", []) if c["id"] == "filevault"), None)
    if not fv or fv["level"] == "unknown":
        return []
    for s in org["safeguards"]:
        if s["id"] == "disk_encryption":
            s["source"] = "kret"
            if fv["level"] == "ok":
                s["evidence"] = "Kret sprawdził ten komputer: FileVault włączony. Pozostałe stanowiska: z Twoich odpowiedzi."
            else:
                s["state"] = "missing"
                s["evidence"] = "Kret sprawdził ten komputer: FileVault wyłączony."
            return ["disk_encryption"]
    return []
