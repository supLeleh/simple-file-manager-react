from fastapi import APIRouter, status, Response
from utils.validate_utils import validate_ipv4_address, validate_ipv6_address
from utils.responses import success_2xx

router = APIRouter(prefix="/namex/validate", tags=["Validation"])


@router.get("/IPv4/", status_code=status.HTTP_202_ACCEPTED)
async def validate_IPv4(ipv4: str, response: Response):
    if validate_ipv4_address(ipv4):
        return success_2xx(message="valid")
    return success_2xx(message="not valid", response=response, status_code=status.HTTP_200_OK)


@router.get("/IPv6/", status_code=status.HTTP_202_ACCEPTED)
async def validate_IPv6(ipv6: str, response: Response):
    if validate_ipv6_address(ipv6):
        return success_2xx(message="valid")
    return success_2xx(message="not valid", response=response, status_code=status.HTTP_200_OK)
