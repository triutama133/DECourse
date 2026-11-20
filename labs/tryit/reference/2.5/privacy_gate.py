"""Reference solution for Try-It 2.5-1: Salted PII Pseudonymization, GDPR Erasure & MDM Golden Record."""
import hashlib
import re


def process_privacy_and_mdm(records, erasure_emails, salt):
    erase_set = {str(e).strip().lower() for e in erasure_emails}
    erased_audit = []
    grouped = {}

    for rec in records:
        norm_email = str(rec["email"]).strip().lower()
        if norm_email in erase_set:
            erased_audit.append(str(rec["source_id"]))
            continue

        token = hashlib.sha256(f"{salt}:{norm_email}".encode("utf-8")).hexdigest()
        digits = re.sub(r"\D+", "", str(rec.get("phone", "")))
        masked_phone = f"***-***-{digits[-4:]}" if len(digits) >= 4 else "***-***-****"

        if token not in grouped:
            grouped[token] = {
                "pii_token": token,
                "phone_masked": masked_phone,
                "city": rec["city"],
                "tier": rec["tier"],
                "updated_at": rec["updated_at"],
                "source_ids": [str(rec["source_id"])],
            }
        else:
            g = grouped[token]
            g["source_ids"].append(str(rec["source_id"]))
            if str(rec["updated_at"]) >= str(g["updated_at"]):
                g["city"] = rec["city"]
                g["tier"] = rec["tier"]
                g["updated_at"] = rec["updated_at"]
                g["phone_masked"] = masked_phone

    golden_records = []
    for token in sorted(grouped):
        g = grouped[token]
        g["source_ids"] = sorted(set(g["source_ids"]))
        golden_records.append(g)

    return {
        "golden_records": golden_records,
        "erased_audit": sorted(erased_audit),
    }
