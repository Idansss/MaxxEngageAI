"""
One-time script: generate the Maxx Engage issuer Ed25519 keypair.

Run ONCE in production, then add the output to your environment variables.
NEVER run this again for an existing deployment — it would invalidate all
previously issued credential signatures.

Usage:
    cd backend
    python scripts/generate_issuer_key.py

Output: three env var lines to add to your .env (and Render / Railway secrets).
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.did import generate_keypair, pub_to_did, pub_to_multibase, priv_to_b64, did_to_verification_method
import base64


def main():
    priv_bytes, pub_bytes = generate_keypair()

    priv_b64 = priv_to_b64(priv_bytes)
    pub_multibase = pub_to_multibase(pub_bytes)
    pub_b64 = base64.b64encode(pub_bytes).decode("ascii")
    issuer_did = pub_to_did(pub_bytes)
    verification_method = did_to_verification_method(issuer_did)

    print("=" * 70)
    print("Maxx Engage Issuer Keypair — GENERATED ONCE, STORE SECURELY")
    print("=" * 70)
    print()
    print("Add these three lines to your .env and all deployment secrets:")
    print()
    print(f"ISSUER_PRIVATE_KEY_B64={priv_b64}")
    print(f"ISSUER_PUBLIC_KEY_MULTIBASE={pub_multibase}")
    print(f"ISSUER_DID={issuer_did}")
    print()
    print("=" * 70)
    print(f"Issuer DID:               {issuer_did}")
    print(f"Verification method:      {verification_method}")
    print(f"Public key (multibase):   {pub_multibase}")
    print(f"Public key (base64):      {pub_b64}")
    print("=" * 70)
    print()
    print("IMPORTANT:")
    print("  - Store ISSUER_PRIVATE_KEY_B64 as a secret — never commit it.")
    print("  - ISSUER_PUBLIC_KEY_MULTIBASE is public — publish it alongside your DID document.")
    print("  - Rotating this key requires re-issuing all credentials.")
    print()


if __name__ == "__main__":
    main()
