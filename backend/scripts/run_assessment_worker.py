import asyncio

from app.core.database import close_pool, init_pool
from app.core.logging import configure_logging, logger
from app.services.assessment_jobs import process_next_queued_job


async def main() -> None:
    configure_logging()
    await init_pool()
    logger.info("assessment_worker.start")
    try:
        while True:
            job_id = await process_next_queued_job()
            if not job_id:
                await asyncio.sleep(2)
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
