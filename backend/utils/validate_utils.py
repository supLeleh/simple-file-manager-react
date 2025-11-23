import ipaddress


def validate_ipv4_address(to_validate: str) -> bool:
    try:
        return bool(ipaddress.ip_network(to_validate))
    except:
        return False


def validate_ipv6_address(to_validate: str) -> bool:
    try:
        return bool(ipaddress.ip_network(to_validate))
    except:
        return False

