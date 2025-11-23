from __future__ import annotations
import logging
import logging.config

from globals import BACKEND_LOGS_PATH

log_config_dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {
            "format": "%(levelname)s : %(message)s",
        },
        "detailed": {
            "format": "%(levelname)s | %(asctime)s : %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S%z"
        }
    },
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "simple",
            "stream": "ext://sys.stdout",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "INFO",
            "formatter": "detailed",
            "filename": BACKEND_LOGS_PATH,
            "maxBytes": 500000,
            "backupCount": 3
        }
    },
    "loggers": {
        "root": {"level": "DEBUG", "handlers": ["stdout", "file"]}
    }
}


def reset_file_content(file_path):
    try:
        # Open the file in write mode, which truncates the content
        with open(file_path, 'w') as file:
            # Truncate the file, effectively resetting its content
            file.truncate()
        logging.info(f"Content of '{file_path}' has been reset.")
    except FileNotFoundError:
        logging.error(f"Error: File '{file_path}' not found.")
    except Exception as e:
        logging.error(f"Error: {e}")


def set_logging() -> None:
    logging.config.dictConfig(log_config_dict)
    reset_file_content(BACKEND_LOGS_PATH)

    logging.SUCCESS = 25
    logging.addLevelName(logging.SUCCESS, 'SUCCESS')
    logging.success = lambda message, *args: logging.log(logging.SUCCESS, message, *args)

