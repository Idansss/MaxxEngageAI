"""
Issuer DID document — serves /.well-known/did.json for did:web resolution.

Enables any external W3C VC verifier to resolve the Maxx Engage issuer DID
and obtain the public key needed to check credential signatures independently,
without calling our API.

Resolution path (did:web method spec):
  https://maxx-engage.io/.well-known/did.json
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.services.did import did_to_verification_method

router = APIRouter(tags=["did"])


@router.get("/.well-known/did.json", include_in_schema=False)
async def issuer_did_document():
    settings = get_settings()
    did = settings.issuer_did
    pub = settings.issuer_public_key_multibase

    if did.startswith("did:key:"):
        vm_id = did_to_verification_method(did)
    else:
        vm_id = f"{did}#key-1"

    vm = {
        "id": vm_id,
        "type": "Ed25519VerificationKey2020",
        "controller": did,
        "publicKeyMultibase": pub,
    } if pub else None

    doc: dict = {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/suites/ed25519-2020/v1",
        ],
        "id": did,
        "verificationMethod": [vm] if vm else [],
        "assertionMethod": [vm_id] if vm else [],
    }

    return JSONResponse(
        content=doc,
        headers={"Content-Type": "application/did+json"},
    )
