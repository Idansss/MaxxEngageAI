"""
W3C Decentralized Identifier (DID) utilities for Maxx Engage.

DID method: did:key (W3C Community Group Draft)
  https://w3c-ccg.github.io/did-method-key/

Key type: Ed25519 (EdDSA, curve25519)

Encoding:
  1. 32-byte Ed25519 public key
  2. Prepend multicodec varint prefix 0xed 0x01 (Ed25519 pub key type)
  3. Encode with base58btc (Bitcoin alphabet, no check digit)
  4. Prepend 'z' (multibase identifier for base58btc)
  5. Result: z6Mk{...}  — the did:key identifier
  6. Full DID: did:key:z6Mk{...}

The multicodec prefix bytes are:
  0xed = 237  (varint encoding of 0xed)
  0x01 = 1    (continuation bit clear; no further varint bytes)

Verification method ID (used in proofs):
  did:key:z6Mk...#z6Mk...
  (DID + '#' + the key identifier repeated — per did:key spec)
"""

import base64

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, PrivateFormat, NoEncryption

# Bitcoin base58 alphabet (no 0, O, I, l)
_B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

# Ed25519 public-key multicodec prefix (varint 0xed01)
_ED25519_MULTICODEC = bytes([0xed, 0x01])


# ── Base58 ────────────────────────────────────────────────────────────────────

def _b58_encode(data: bytes) -> str:
    leading_zeros = len(data) - len(data.lstrip(b"\x00"))
    num = int.from_bytes(data, "big")
    chars = []
    while num:
        num, rem = divmod(num, 58)
        chars.append(_B58_ALPHABET[rem])
    return "1" * leading_zeros + "".join(reversed(chars))


def _b58_decode(s: str) -> bytes:
    leading_ones = len(s) - len(s.lstrip("1"))
    num = 0
    for c in s:
        num = num * 58 + _B58_ALPHABET.index(c)
    result = []
    while num:
        num, rem = divmod(num, 256)
        result.append(rem)
    return bytes([0] * leading_ones + list(reversed(result)))


# ── Key generation ────────────────────────────────────────────────────────────

def generate_keypair() -> tuple[bytes, bytes]:
    """
    Generate an Ed25519 keypair.
    Returns (private_key_raw_32_bytes, public_key_raw_32_bytes).
    """
    priv = Ed25519PrivateKey.generate()
    priv_bytes = priv.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
    pub_bytes = priv.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    return priv_bytes, pub_bytes


# ── DID derivation ────────────────────────────────────────────────────────────

def pub_to_multibase(pub_bytes: bytes) -> str:
    """Encode a 32-byte Ed25519 public key as a multibase(base58btc) string."""
    prefixed = _ED25519_MULTICODEC + pub_bytes
    return "z" + _b58_encode(prefixed)


def pub_to_did(pub_bytes: bytes) -> str:
    """Derive the did:key DID from a raw Ed25519 public key."""
    return "did:key:" + pub_to_multibase(pub_bytes)


def did_to_verification_method(did: str) -> str:
    """
    Return the verification method ID for a did:key DID.
    Per spec: <did>#<key-identifier>
    """
    key_id = did.removeprefix("did:key:")
    return f"{did}#{key_id}"


def multibase_to_pub(multibase: str) -> bytes:
    """Decode a multibase string back to raw 32-byte Ed25519 public key bytes."""
    if not multibase.startswith("z"):
        raise ValueError(f"Expected multibase(base58btc) string starting with 'z', got: {multibase[:8]}")
    raw = _b58_decode(multibase[1:])
    if not raw.startswith(_ED25519_MULTICODEC):
        raise ValueError("Multibase does not encode an Ed25519 public key")
    return raw[len(_ED25519_MULTICODEC):]


# ── Serialisation helpers ─────────────────────────────────────────────────────

def priv_to_b64(priv_bytes: bytes) -> str:
    """Base64-encode a raw private key for DB storage."""
    return base64.b64encode(priv_bytes).decode("ascii")


def b64_to_priv(b64: str) -> Ed25519PrivateKey:
    """Load an Ed25519PrivateKey from a base64-encoded raw key string."""
    return Ed25519PrivateKey.from_private_bytes(base64.b64decode(b64))


def b64_to_priv_bytes(b64: str) -> bytes:
    return base64.b64decode(b64)
