from fastapi import Response, status

"""
Class mapping all 2xx-4xx-5xx HTTP responses from the backend API

All these responses do not modify the response status code,
because the endpoint declaration will already declare the success status code
"""


def success_2xx(
        response: Response = None,
        status_code: int = status.HTTP_200_OK,
        key_mess: str = "message",
        message: str | int | list | dict = None
):
    if response:
        response.status_code = status_code
    if message:
        return {
            "result": "success",
            key_mess: message
        }

    return {
        "result": "success"
    }


def error_4xx(
        response: Response = None,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        key_mess: str = "message",
        message: str | int | list | Exception = None
):
    if response:
        response.status_code = status_code
    if message:
        return {
            "result": "error",
            key_mess: message
        }
    return {
        "result": "error"
    }


def error_5xx(
        response: Response = None,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        key_mess: str = "message",
        message: str | int | list | Exception = None
):
    if response:
        response.status_code = status_code
    if message:
        return {
            "result": "error",
            key_mess: message
        }

    return {
        "result": "error"
    }