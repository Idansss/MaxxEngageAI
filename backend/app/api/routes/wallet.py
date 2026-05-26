"""
User-controlled wallet endpoints.

True self-sovereignty means the user holds their own credentials, not the platform.
These endpoints move Maxx Engage from "credential custodian" to "credential issuer":

  GET  /wallet/credentials/{id}/export   — Download signed W3C VC as JSON
  GET  /wallet/key-material              — Download your DID + public key
  POST /wallet/verify                    — Public: verify any Maxx Engage credential signature
  DELETE /wallet/key-material            — Delete platform-held private key (go fully self-sovereign)

The private key stored server-side is a Phase 1 migration aid. Phase 4 will
move key generation to the browser so the private key never touches our servers.
"""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import JSONResponse

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_pool
from app.services.vc_signing import verify_credential

router = APIRouter(prefix="/wallet", tags=["wallet"])


# ── Export credential ─────────────────────────────────────────────────────────

@router.get(
    "/credentials/{credential_id}/export",
    summary="Download a signed W3C VC 2.0 credential as JSON",
)
async def export_credential(
    credential_id: str,
    auth_user: dict = Depends(get_current_user),
):
    """
    Download the full signed W3C VC 2.0 document for this credential.
    The returned JSON is portable — import it into any VC-compatible wallet
    (Spruce DIDKit, Walt.id, Trinsic, etc.).
    """
    try:
        uuid.UUID(credential_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="credential_id must be a valid UUID.")

    pool = get_pool()

    user_row = await pool.fetchrow(
        "SELECT id FROM public.users WHERE auth_id = $1::uuid", auth_user["id"]
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    row = await pool.fetchrow(
        "SELECT vc_document, user_id FROM public.credentials WHERE id = $1::uuid",
        credential_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Credential not found.")
    if str(row["user_id"]) != str(user_row["id"]):
        raise HTTPException(
            status_code=403, detail="This credential does not belong to you."
        )

    vc = row["vc_document"]
    if isinstance(vc, str):
        vc = json.loads(vc)

    return JSONResponse(
        content=vc,
        headers={
            "Content-Disposition": f'attachment; filename="maxx-engage-credential-{credential_id}.jsonld"',
            "Content-Type": "application/ld+json",
        },
    )


# ── Key material ──────────────────────────────────────────────────────────────

@router.get(
    "/key-material",
    summary="Download your DID and public key for external wallet import",
)
async def get_key_material(auth_user: dict = Depends(get_current_user)):
    """
    Returns your W3C DID, Ed25519 public key (multibase), and — while still in
    platform custody — your private key (base64).

    **Action required:** Download this, import into your chosen DID wallet, then
    call DELETE /wallet/key-material to remove the private key from Maxx Engage servers
    and achieve full self-sovereignty.

    Compatible wallets: Spruce DIDKit, Walt.id, Trinsic, any did:key-aware wallet.
    """
    pool = get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, did, public_key_multibase, private_key_b64
        FROM public.users
        WHERE auth_id = $1::uuid
        """,
        auth_user["id"],
    )
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found.")

    has_private_key = row["private_key_b64"] is not None

    return {
        "did": row["did"],
        "public_key_multibase": row["public_key_multibase"],
        "private_key_b64": row["private_key_b64"],
        "key_type": "Ed25519",
        "did_method": "did:key",
        "platform_custody": has_private_key,
        "instructions": (
            "1. Save this JSON securely (offline or in a hardware wallet). "
            "2. Import into a DID-compatible wallet. "
            "3. Call DELETE /wallet/key-material to remove the private key from Maxx Engage — "
            "after that, only you hold it."
        ) if has_private_key else (
            "Your private key has been removed from Maxx Engage. You are fully self-sovereign."
        ),
    }


@router.delete(
    "/key-material",
    summary="Remove your private key from Maxx Engage (go fully self-sovereign)",
)
async def delete_key_material(auth_user: dict = Depends(get_current_user)):
    """
    Deletes the platform-held copy of your private key.
    **This is irreversible.** Download your key material first via GET /wallet/key-material.
    After deletion, Maxx Engage cannot re-sign credentials on your behalf — you control the key.
    Your DID and public key remain; credentials already issued are unaffected.
    """
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id, private_key_b64 FROM public.users WHERE auth_id = $1::uuid",
        auth_user["id"],
    )
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found.")
    if row["private_key_b64"] is None:
        return {"ok": True, "message": "Private key was already removed."}

    await pool.execute(
        "UPDATE public.users SET private_key_b64 = NULL WHERE id = $1::uuid",
        row["id"],
    )
    return {
        "ok": True,
        "message": "Private key removed from Maxx Engage. You are now fully self-sovereign.",
    }


# ── Public verification ───────────────────────────────────────────────────────

@router.post(
    "/verify",
    summary="Verify a Maxx Engage W3C VC signature (public endpoint)",
)
async def verify_vc(credential: dict = Body(..., description="The full W3C VC JSON to verify")):
    """
    Public endpoint — anyone (employers, institutions, verifiers) can call this.

    Verifies that the credential was signed by the Maxx Engage issuer key
    and has not been tampered with since issuance.

    Does NOT check credential revocation (revocation registry is Phase 4).
    """
    settings = get_settings()

    if not settings.issuer_public_key_multibase:
        raise HTTPException(
            status_code=503,
            detail="Issuer public key not configured. Contact Maxx Engage support.",
        )

    is_valid, reason = verify_credential(credential, settings.issuer_public_key_multibase)

    issuer = credential.get("issuer")
    if isinstance(issuer, dict):
        issuer = issuer.get("id", issuer)

    subject = credential.get("credentialSubject", {})
    if isinstance(subject, dict):
        subject_id = subject.get("id")
    else:
        subject_id = None

    return {
        "valid": is_valid,
        "reason": reason,
        "issuer": issuer,
        "subject_did": subject_id,
        "credential_id": credential.get("id"),
        "valid_from": credential.get("validFrom"),
    }
