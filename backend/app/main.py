from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.followers import router as followers_router
from .scheduler import start_scheduler, stop_scheduler
from .database import close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()
    close_db()


app = FastAPI(title="GitHub Analytics API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(followers_router)


@app.get("/health")
def health():
    return {"status": "ok"}
