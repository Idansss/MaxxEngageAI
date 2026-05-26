"""
Ed25519 Data Integrity Proof signing for W3C Verifiable Credentials.

Cryptosuite: eddsa-jcs-2022
  https://www.w3.org/TR/vc-di-eddsa/#eddsa-jcs-2022

Canonicalization: JSON Canonicalization Scheme (JCS / RFC 8785)
  - Sort all object keys recursively
  - No whitespace
  - Deterministic across platforms
  The alternative (RDF Dataset Normalization) requires full JSON-LD processing;
  that is planned for Phase 4. JCS is explicitly supported by the eddsa-jcs-2022
  cryptosuite and gives equivalent security guarantees.

Signing algorithm (per spec §3.3.2):
  1. Serialize credential (without proof) with JCS → bytes C
  2. Serialize proof options (without proofValue) with JCS → bytes P
  3. signing_input = SHA-256(P) + SHA-256(C)   (64 bytes)
  4. signature = Ed25519.sign(signing_input)
  5. proofValue = 'z' + base58btc(signature)   (multibase)

Verification algorithm (per spec §3.3.3):
  1. Extract proof from signed credential
  2. Reconstruct C and P as above
  3. Decode proofValue from multibase base58btc
  4. Ed25519.verify(signature, signing_input, issuer_public_key)
"""

import hashlib
import json
from datetime import datetime, timezone

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from app.services.did import _b58_decode, _b58_encode, b64_to_priv_bytes, multibase_to_pub

# Maxx Engage JSON-LD context inline definition.
# Defines the vocabulary terms used in MaxxEngageCompetenceCredential.
# Using @vocab means unknown terms are silently ignored in processing — fine for VC.
PROOFOS_CONTEXT: dict = {
    "@vocab": "https://maxx-engage.io/vocab#",
    "pf": "https://maxx-engage.io/vocab#",
    # Explicit mappings for the most important terms (aids interoperability)
    "skillPath": "pf:skillPath",
    "skillPathId": "pf:skillPathId",
    "level": "pf:level",
    "levelLabel": "pf:levelLabel",
    "score": "pf:score",
    "rubricId": "pf:rubricId",
    "reviewId": "pf:reviewId",
    "submissionId": "pf:submissionId",
    "verifiedByHuman": "pf:verifiedByHuman",
    "zkProofAvailable": "pf:zkProofAvailable",
    "scoreCommitment": "pf:scoreCommitment",
    "decayHalfLifeMonths": "pf:decayHalfLifeMonths",
    "percentileClaim": "pf:percentileClaim",
    "consistencyRating": "pf:consistencyRating",
    "consistencyScore": "pf:consistencyScore",
    "attemptCount": "pf:attemptCount",
}

VC_CONTEXT = [
    "https://www.w3.org/ns/credentials/v2",
    "https://w3id.org/security/data-integrity/v2",
    PROOFOS_CONTEXT,
]


# ── JCS canonicalization ──────────────────────────────────────────────────────

def _jcs(doc: dict) -> bytes:
    """
    JSON Canonicalization Scheme (RFC 8785).
    All object keys sorted recursively; no whitespace; UTF-8 encoded.
    """
    return json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


# ── Signing ───────────────────────────────────────────────────────────────────

def sign_credential(
    credential: dict,
    issuer_priv_b64: str,
    issuer_did: str,
    issuer_verification_method: str,
) -> dict:
    """
    Add an eddsa-jcs-2022 Data Integrity Proof to a credential.

    Returns a new dict — the input credential is not mutated.
    The returned document includes the '@context' update and a 'proof' block.
    """
    priv_bytes = b64_to_priv_bytes(issuer_priv_b64)
    private_key = Ed25519PrivateKey.from_private_bytes(priv_bytes)

    # Ensure correct @context
    doc = dict(credential)
    doc["@context"] = VC_CONTEXT

    # Build proof options (everything except proofValue)
    proof_options: dict = {
        "type": "DataIntegrityProof",
        "cryptosuite": "eddsa-jcs-2022",
        "created": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "verificationMethod": issuer_verification_method,
        "proofPurpose": "assertionMethod",
    }

    # signing_input = SHA-256(JCS(proof_options)) + SHA-256(JCS(credential_without_proof))
    hash_options = hashlib.sha256(_jcs(proof_options)).digest()
    hash_doc = hashlib.sha256(_jcs(doc)).digest()
    signing_input = hash_options + hash_doc

    sig_bytes = private_key.sign(signing_input)
    proof_value = "z" + _b58_encode(sig_bytes)  # multibase base58btc

    return {
        **doc,
        "proof": {
            **proof_options,
            "proofValue": proof_value,
        },
    }


# ── Verification ──────────────────────────────────────────────────────────────

def verify_credential(signed_credential: dict, issuer_pub_multibase: str) -> tuple[bool, str]:
    """
    Verify an eddsa-jcs-2022 Data Integrity Proof.

    Returns (is_valid: bool, reason: str).
    Accepts the issuer's public key as a multibase string (z6Mk...).
    """
    proof = signed_credential.get("proof")
    if not proof:
        return False, "No proof block found."

    proof_value = proof.get("proofValue", "")
    if not proof_value.startswith("z"):
        return False, "proofValue must be multibase base58btc (starts with 'z')."

    cryptosuite = proof.get("cryptosuite")
    if cryptosuite != "eddsa-jcs-2022":
        return False, f"Unsupported cryptosuite: {cryptosuite!r}. Expected 'eddsa-jcs-2022'."

    try:
        pub_bytes = multibase_to_pub(issuer_pub_multibase)
        public_key: Ed25519PublicKey = Ed25519PublicKey.from_public_bytes(pub_bytes)
    except Exception as e:
        return False, f"Failed to decode issuer public key: {e}"

    try:
        sig_bytes = _b58_decode(proof_value[1:])
    except Exception:
        return False, "Could not decode proofValue."

    credential_without_proof = {k: v for k, v in signed_credential.items() if k != "proof"}
    proof_without_value = {k: v for k, v in proof.items() if k != "proofValue"}

    hash_options = hashlib.sha256(_jcs(proof_without_value)).digest()
    hash_doc = hashlib.sha256(_jcs(credential_without_proof)).digest()
    signing_input = hash_options + hash_doc

    try:
        public_key.verify(sig_bytes, signing_input)
        return True, "Signature valid."
    except InvalidSignature:
        return False, "Signature is invalid — credential may have been tampered with."
