#!/usr/bin/env python3
"""
PropAIrty Golem Test Runner
============================
Usage:
  python run.py                    # run all deterministic scenarios
  python run.py --scenario lifecycle
  python run.py --chaos agent      # LLM chaos mode for agent
  python run.py --chaos all        # all 4 portals in chaos mode
  python run.py --chaos all --turns 10
  python run.py --seed             # seed golem users into DB (run once)
"""
import sys, os, argparse, subprocess, json
sys.path.insert(0, os.path.dirname(__file__))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def cmd_seed():
    """Seed golem users into the database."""
    script = os.path.join(BASE_DIR, "seed_golems.py")
    os.chdir(os.path.join(BASE_DIR, "../../backend"))
    # Load production env
    from dotenv import load_dotenv
    load_dotenv("/root/propairty/backend/.env.production")
    exec(open(script).read())


def cmd_scenario(name: str):
    if name == "lifecycle":
        from scenarios.full_lifecycle import run
        results = run(verbose=True)
        total_pass = sum(r["passed"] for r in results)
        total_fail = sum(r["failed"] for r in results)
        print(f"\n{'='*60}")
        print("FINAL RESULTS")
        print(f"{'='*60}")
        for r in results:
            icon = "✓" if r["failed"] == 0 else "✗"
            print(f"{icon} {r['golem']:25s}  {r['passed']}/{r['checks']} passed")
            for f in r["failures"]:
                print(f"    → {f}")
        print(f"\nTotal: {total_pass} passed, {total_fail} failed")
        return total_fail == 0
    elif name == "sprint4":
        from scenarios.sprint4_features import run
        log = run(verbose=True)
        total = len([e for e in log if e["action"] == "CHECK"])
        passed = len([e for e in log if e["action"] == "CHECK" and e["ok"]])
        failed = total - passed
        print(f"\nTotal: {passed} passed, {failed} failed")
        return failed == 0
    else:
        print(f"Unknown scenario: {name}")
        return False


def cmd_chaos(role: str, turns: int):
    from llm_golem import run_chaos, ROLE_MAP
    if role == "all":
        for r in ["agent", "tenant", "contractor", "landlord"]:
            run_chaos(r, turns=turns)
    else:
        run_chaos(role, turns=turns)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PropAIrty Golem Test Runner")
    parser.add_argument("--seed", action="store_true", help="Seed golem users")
    parser.add_argument("--scenario", default="lifecycle",
                        choices=["lifecycle", "sprint4"],
                        help="Run a deterministic scenario")
    parser.add_argument("--chaos", metavar="ROLE",
                        help="LLM chaos mode: agent|tenant|contractor|landlord|all")
    parser.add_argument("--turns", type=int, default=8,
                        help="Number of chaos turns per golem")
    parser.add_argument("--all-scenarios", action="store_true",
                        help="Run all deterministic scenarios")
    args = parser.parse_args()

    # Set up backend env
    os.environ.setdefault("ENV_FILE", "/root/propairty/backend/.env.production")
    try:
        from dotenv import load_dotenv
        load_dotenv("/root/propairty/backend/.env.production")
    except ImportError:
        pass

    if args.seed:
        sys.path.insert(0, os.path.join(BASE_DIR, "../../backend"))
        exec(open(os.path.join(BASE_DIR, "seed_golems.py")).read())

    elif args.chaos:
        cmd_chaos(args.chaos, args.turns)

    else:
        ok = cmd_scenario(args.scenario)
        sys.exit(0 if ok else 1)
