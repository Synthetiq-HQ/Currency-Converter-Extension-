#!/usr/bin/env python3
"""
QuickCurrency Raspberry Pi Proxy Server
Caches exchange rates locally for privacy and speed
"""

from flask import Flask, request, jsonify
import requests
import time
from typing import Dict, Optional

app = Flask(__name__)

# In-memory cache
CACHE: Dict[str, dict] = {}
TTL = 60 * 15  # 15 minutes default

# API endpoints (both free and keyless)
FRANKFURTER_API = "https://api.frankfurter.dev/latest"
EXCHANGERATE_HOST_API = "https://api.exchangerate.host/convert"


def get_cached_rate(from_code: str, to_code: str) -> Optional[float]:
    """Get cached rate if still valid."""
    key = f"{from_code}:{to_code}"
    now = time.time()

    if key in CACHE:
        entry = CACHE[key]
        age = now - entry["ts"]

        if age < TTL:
            print(f"[CACHE HIT] {key} (age: {int(age)}s)")
            return entry["rate"]
        else:
            print(f"[CACHE EXPIRED] {key}")
            del CACHE[key]

    return None


def cache_rate(from_code: str, to_code: str, rate: float) -> None:
    """Store rate in cache."""
    key = f"{from_code}:{to_code}"
    CACHE[key] = {
        "rate": rate,
        "ts": time.time()
    }
    print(f"[CACHED] {key} = {rate}")


def fetch_from_frankfurter(from_code: str, to_code: str) -> Optional[float]:
    """Fetch rate from Frankfurter API (primary)."""
    try:
        params = {"from": from_code, "to": to_code}
        print(f"[FRANKFURTER] Fetching {from_code} -> {to_code}")

        response = requests.get(FRANKFURTER_API, params=params, timeout=8)

        if response.ok:
            data = response.json()
            if "rates" in data and to_code in data["rates"]:
                rate = data["rates"][to_code]
                print(f"[FRANKFURTER] Success: {rate}")
                return rate

        print(f"[FRANKFURTER] Failed: {response.status_code}")
        return None

    except Exception as e:
        print(f"[FRANKFURTER] Error: {e}")
        return None


def fetch_from_exchangerate_host(from_code: str, to_code: str, amount: float) -> Optional[float]:
    """Fetch rate from ExchangeRate.host API (fallback)."""
    try:
        params = {"from": from_code, "to": to_code, "amount": amount}
        print(f"[EXCHANGERATE] Fetching {from_code} -> {to_code}")

        response = requests.get(EXCHANGERATE_HOST_API, params=params, timeout=8)

        if response.ok:
            data = response.json()
            if "result" in data:
                result = data["result"]
                rate = result / amount if amount != 0 else 0
                print(f"[EXCHANGERATE] Success: rate={rate}")
                return rate

        print(f"[EXCHANGERATE] Failed: {response.status_code}")
        return None

    except Exception as e:
        print(f"[EXCHANGERATE] Error: {e}")
        return None


@app.route("/convert")
def convert():
    """Convert currency endpoint."""
    from_code = request.args.get("from", "").upper()
    to_code = request.args.get("to", "GBP").upper()

    try:
        amount = float(request.args.get("amount", "1"))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount parameter"}), 400

    if not from_code:
        return jsonify({"error": "Missing 'from' parameter"}), 400

    print(f"\n[REQUEST] {from_code} -> {to_code} (amount: {amount})")

    # Check cache first
    cached_rate = get_cached_rate(from_code, to_code)
    if cached_rate is not None:
        result = cached_rate * amount
        return jsonify({
            "result": round(result, 6),
            "cached": True,
            "from": from_code,
            "to": to_code
        })

    # Fetch from Frankfurter (primary)
    rate = fetch_from_frankfurter(from_code, to_code)

    if rate is not None:
        cache_rate(from_code, to_code, rate)
        result = rate * amount
        return jsonify({
            "result": round(result, 6),
            "cached": False,
            "from": from_code,
            "to": to_code,
            "source": "frankfurter"
        })

    # Fallback to ExchangeRate.host
    rate = fetch_from_exchangerate_host(from_code, to_code, amount)

    if rate is not None:
        cache_rate(from_code, to_code, rate)
        result = rate * amount
        return jsonify({
            "result": round(result, 6),
            "cached": False,
            "from": from_code,
            "to": to_code,
            "source": "exchangerate.host"
        })

    # All APIs failed
    print("[ERROR] All APIs failed")
    return jsonify({
        "error": "Could not fetch exchange rate from any API"
    }), 502


@app.route("/health")
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "cache_entries": len(CACHE),
        "ttl_seconds": TTL
    })


@app.route("/cache/clear")
def clear_cache():
    """Clear cache endpoint."""
    CACHE.clear()
    print("[CACHE] Cleared all entries")
    return jsonify({"status": "cache cleared"})


@app.route("/cache/stats")
def cache_stats():
    """Cache statistics endpoint."""
    return jsonify({
        "entries": len(CACHE),
        "pairs": list(CACHE.keys())
    })


if __name__ == "__main__":
    print("=" * 60)
    print("QuickCurrency Proxy Server")
    print("=" * 60)
    print(f"TTL: {TTL}s ({TTL/60} minutes)")
    print(f"Primary API: {FRANKFURTER_API}")
    print(f"Fallback API: {EXCHANGERATE_HOST_API}")
    print("=" * 60)
    print("Starting server on http://0.0.0.0:5000")
    print("=" * 60)

    app.run(host="0.0.0.0", port=5000, debug=False)
