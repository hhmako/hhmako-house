#!/usr/bin/env python3
import json
import os
import sys


PASS = {"pass", "exact", "confirmed", "derived"}


def fail(message):
    print(f"FAIL: {message}")
    return False


def present_file(path, label):
    return bool(path) and os.path.isfile(path) or fail(f"missing {label}: {path!r}")


def validate_preflight(data):
    ok = True
    confirmation = data.get("understanding_confirmation", {})
    if confirmation.get("status") != "confirmed":
        ok = fail("understanding confirmation is not confirmed") and ok

    required = [
        "business_goal", "figma_target", "review_unit", "baseline",
        "complete_state_list", "changing_fields", "fixed_modules",
        "output_placement"
    ]
    for key in required:
        if not confirmation.get(key):
            ok = fail(f"understanding confirmation missing {key}") and ok

    states = data.get("states", [])
    if not states:
        ok = fail("state ledger is empty") and ok
    declared = confirmation.get("complete_state_list", [])
    if len(states) != len(declared):
        ok = fail(f"state count mismatch: confirmed={len(declared)} ledger={len(states)}") and ok

    for asset in data.get("assets", []):
        if asset.get("status") != "exact":
            ok = fail(f"asset not exact: {asset.get('id') or asset.get('visible_unit')}") and ok
        source_kind = asset.get("source_kind")
        if source_kind not in {"figma_node", "original_file"}:
            ok = fail(f"forbidden asset source: {source_kind}") and ok
        if not asset.get("source") or not asset.get("local_asset"):
            ok = fail(f"incomplete asset provenance: {asset.get('id')}") and ok

    if not data.get("assets"):
        ok = fail("asset ledger is empty") and ok

    for state in states:
        if state.get("evidence_status") not in {"confirmed", "derived"}:
            ok = fail(f"state evidence unresolved: {state.get('name')}") and ok
        if not state.get("prd_evidence") or not state.get("figma_mapping"):
            ok = fail(f"state mapping incomplete: {state.get('name')}") and ok
    return ok


def validate_final(data):
    ok = validate_preflight(data)
    baseline = data.get("baseline_acceptance", {})
    if baseline.get("result") != "pass":
        ok = fail("baseline state did not pass before expansion") and ok

    required_checks = [
        "structural", "computed_style", "exact_copy", "fixed_modules", "visual_comparison"
    ]
    for state in data.get("states", []):
        name = state.get("name", "<unnamed>")
        evidence = state.get("acceptance", {})
        ok = present_file(evidence.get("figma_reference"), f"{name} Figma reference") and ok
        ok = present_file(evidence.get("html_render"), f"{name} HTML render") and ok
        regions = evidence.get("region_comparisons", [])
        if not regions:
            ok = fail(f"{name} has no region comparisons") and ok
        for path in regions:
            ok = present_file(path, f"{name} region comparison") and ok
        for check in required_checks:
            if evidence.get(check) != "pass":
                ok = fail(f"{name} {check} is not pass") and ok
    return ok


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in {"preflight", "final"}:
        print("usage: validate_acceptance.py {preflight|final} manifest.json", file=sys.stderr)
        return 2
    with open(sys.argv[2], "r", encoding="utf-8") as f:
        data = json.load(f)
    ok = validate_preflight(data) if sys.argv[1] == "preflight" else validate_final(data)
    print("PASS" if ok else "FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
