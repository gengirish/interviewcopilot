from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="InfinityHire Backend", version="0.1.0")

    @app.get("/api/v1/health")
    async def health() -> dict[str, str]:
        return {"status": "healthy", "service": "infinityhire-backend"}

    return app


app = create_app()
