from fastapi import APIRouter, Query

from app.services.knowledge import KnowledgeSource, retrieve_public_knowledge

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("/search", summary="Search trusted public knowledge sources")
async def search_knowledge(q: str = Query(..., min_length=2, max_length=120)):
    rubric = {"dimensions": [{"name": q}]}
    sources: list[KnowledgeSource] = await retrieve_public_knowledge(
        skill_path_slug=q.lower().replace(" ", "-"),
        rubric=rubric,
        content=q,
    )
    return {"query": q, "sources": [source.as_dict() for source in sources]}
