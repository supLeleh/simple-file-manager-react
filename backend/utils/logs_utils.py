import logging
import os.path

from globals import BACKEND_LOGS_PATH

def read_logs_file_content():
    try:
        logging.debug(f"Reading logs from {BACKEND_LOGS_PATH}")
        with open(BACKEND_LOGS_PATH, 'r') as file:
            content = file.read()
        return content
    except FileNotFoundError:
        logging.error(f"Logs file not found")
        return "File not found"
    except Exception as e:
        logging.error(f"Error reading logs: {e}")
        return "An error occurred"


def init_logs_ws():
    try:
        payload = {"type": "init", "logs": {}}
        logging.debug(f"Reading logs from {BACKEND_LOGS_PATH} for WS Initialization")
        with open(BACKEND_LOGS_PATH, 'r') as file:
            for line, line_content in enumerate(file.readlines()):
                payload["logs"][line] = line_content
            return payload, {"type": "sync", "lines": max(payload["logs"].keys()) + 1}
    except FileNotFoundError:
        logging.error(f"Logs file not found")
        return {"error": f"File not found"}
    except Exception as e:
        logging.error(f"Error reading logs for WS Initialization: {e}")
        return "An error occurred"


async def get_ws_sync_payload(last_line: int):
    last_line = max(last_line, 0)  # last_line cannot be <0
    try:
        payload = {"type": "logs", "logs": {}}
        logging.debug(f"Updating logs for WS")
        with open(BACKEND_LOGS_PATH, 'r') as file:
            for line, line_content in enumerate(file.readlines()):
                if line >= last_line:
                    payload["logs"][line] = line_content
        sync_payload = {"type": "sync", "lines": max(payload["logs"].keys()) + 1}
        return payload, sync_payload
    except FileNotFoundError:
        logging.error(f"Logs file not found")
        return {"error": f"File not found"}
    except Exception as e:
        logging.error(f"Error reading logs for WS Sync: {e}")
        return "An error occurred"


def count_log_lines():
    with open(BACKEND_LOGS_PATH, 'r') as file:
        return sum(1 for _ in file)
