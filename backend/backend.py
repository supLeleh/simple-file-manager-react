from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from routers import execution, configuration, infos, validate
from log import set_logging

def app_startup():
    set_logging()
    execution.startup()

app = FastAPI()

app.running_instance_hash = []
app.include_router(execution.router)
app.include_router(configuration.router)
app.include_router(infos.router)
app.include_router(validate.router)

app.add_event_handler('startup', app_startup)

origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://localhost:5173",
    "http://localhost:3000",
    "*"
]
# Allow CORS requests from front-end to back-end
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/", status_code=status.HTTP_200_OK)
async def index_route():
    return {
        "message": "Hello index"
    }




