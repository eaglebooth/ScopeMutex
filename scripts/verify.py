from pathlib import Path
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
root = Path(__file__).resolve().parents[1]
(root / "docs").mkdir(exist_ok=True)
commands = [
    [sys.executable, "-m", "pytest", "-q", "--tb=short", "-p", "no:cacheprovider", "tests"],
    [sys.executable, "-X", "utf8", "-m", "genvm_linter.cli", "check", "contracts/scope_mutex.py"],
    [sys.executable, "-X", "utf8", "-m", "genvm_linter.cli", "schema", "contracts/scope_mutex.py", "-o", "docs/schema.json"],
    ["node", "--check", "scripts/live.mjs"],
    ["node", "--check", "scripts/verify-live.mjs"],
    ["node", "--input-type=module", "-e", "import {createClient} from 'genlayer-js'; import {studionet} from 'genlayer-js/chains'; import {readFileSync} from 'node:fs'; console.log(JSON.stringify({node:process.version,sdk_version:JSON.parse(readFileSync('node_modules/genlayer-js/package.json')).version,sdk_import:typeof createClient,chain_id:studionet.id}));"],
]
record = {"checked_at": datetime.now(timezone.utc).isoformat(),
    "scope": "Controlled production-entrypoint harness, linter/schema and SDK import/syntax; not real GenVM or live model consensus",
    "python": sys.version, "source_sha256": hashlib.sha256((root / "contracts/scope_mutex.py").read_bytes()).hexdigest(),
    "samples": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root / "samples").glob("*.json"))}, "commands": []}
for command in commands:
    print("$", " ".join(command), flush=True)
    result = subprocess.run(command, cwd=root, capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(result.stdout, end="")
    print(result.stderr, end="", file=sys.stderr)
    record["commands"].append({"command": command, "exit_code": result.returncode, "stdout": result.stdout, "stderr": result.stderr})
    (root / "docs/local-verification.json").write_text(json.dumps(record, indent=2)+"\n", encoding="utf-8")
    if result.returncode:
        raise SystemExit(result.returncode)
