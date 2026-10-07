"""Read-only checks of the computer the mole runs on. Every command is a status query with a timeout; nothing is changed."""
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
        return {"id": id_, "label": label, "level": "unknown", "text": "could not check", "raw": None, "fix": fix}
    ok = ok_if(out.lower())
    return {"id": id_, "label": label, "level": "ok" if ok else "bad", "text": ok_text if ok else bad_text,
            "raw": out.splitlines()[0] if out else "", "fix": None if ok else fix}


def check() -> dict:
    system = platform.system()
    if system != "Darwin":
        return {"system": system, "supported": False, "checks": [],
                "note": "In this prototype the local agent supports macOS. Windows is planned (BitLocker, Defender, Firewall)."}
    version = _run(["sw_vers", "-productVersion"]) or "?"
    checks = [
        _check("firewall", "Firewall", ["/usr/libexec/ApplicationFirewall/socketfilterfw", "--getglobalstate"],
               lambda o: "enabled" in o or "state = 1" in o, "on", "off",
               "System Settings → Network → Firewall: turn it on."),
        _check("filevault", "Disk encryption (FileVault)", ["fdesetup", "status"],
               lambda o: "filevault is on" in o, "on", "off",
               "System Settings → Privacy & Security → FileVault: turn it on."),
        _check("gatekeeper", "Protection from unknown apps", ["spctl", "--status"],
               lambda o: "assessments enabled" in o, "on", "off",
               "In Terminal: sudo spctl --master-enable"),
        _check("sip", "System Integrity Protection", ["csrutil", "status"],
               lambda o: "enabled" in o, "on", "off",
               "Turn SIP on from recovery mode (csrutil enable)."),
        _check("autoupdate", "Automatic update checks",
               ["defaults", "read", "/Library/Preferences/com.apple.SoftwareUpdate", "AutomaticCheckEnabled"],
               lambda o: o.strip() == "1" or "does not exist" in o, "on", "off",
               "System Settings → General → Software Update: turn on automatic updates."),
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
                s["evidence"] = "The mole checked this computer: FileVault is on. Other workstations: from your answers."
            else:
                s["state"] = "missing"
                s["evidence"] = "The mole checked this computer: FileVault is off."
            return ["disk_encryption"]
    return []
