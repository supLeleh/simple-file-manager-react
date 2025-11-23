import os
from pathlib import Path

BACKEND_BASE_PATH = os.path.relpath(Path(os.path.dirname(__file__)))
BACKEND_RESOURCES_FOLDER: str = os.path.abspath(os.path.join(BACKEND_BASE_PATH, "resources")) 
BACKEND_IXPCONFIGS_FOLDER: str = os.path.abspath(os.path.join(BACKEND_BASE_PATH, "ixpconfigs"))
BACKEND_LOGS_PATH: str = os.path.abspath(os.path.join(BACKEND_BASE_PATH, "logs", "namex.log"))