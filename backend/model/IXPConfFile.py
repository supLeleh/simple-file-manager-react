from typing import List

from pydantic import BaseModel


class PeeringLan(BaseModel):
    four: str
    six: str


class RibDumps(BaseModel):
    four: str
    six: str


class RouteServer(BaseModel):
    type: str
    name: str
    as_num: int
    conf_file: str
    address: str


class IXPConfModel(BaseModel):
    host_interface: str
    peering_lan: PeeringLan
    rib_dumps: RibDumps
    route_servers: List[RouteServer]


class IXPConfFile(BaseModel):
    filename: str
    content: IXPConfModel


""" Example of IXPConfFile as JSON
# TODO add
"""
