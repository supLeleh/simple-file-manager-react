import logging
import time

from starlette.websockets import WebSocketDisconnect
from model.rib import RibDump
from utils.file_utils import get_resource_file
from utils.ixpconf_util import exists_file_in_ixpconfigs, get_rib_names_from_ixpconf_name, \
    get_ribs_content_from_ixpconf_name

from utils.responses import *
from Kathara.exceptions import MachineNotFoundError
from Kathara.manager.Kathara import Kathara
from fastapi import APIRouter, status, Response, WebSocket, Query
from utils.logs_utils import read_logs_file_content, init_logs_ws, get_ws_sync_payload, count_log_lines
from utils.responses import success_2xx, error_4xx
from utils.server_context import ServerContext
from utils.lab_utils import get_running_machines_names as get_running_machines_names_from_lab, filter_machines_info, \
    execute_command_on_machine

router = APIRouter(prefix="/namex/info", tags=["Namex Info"])


@router.get("/context")
async def context(response: Response):
    if ServerContext.get_lab() is not None:
        return {
            "result": ServerContext is not None,
            "lab": ServerContext.get_lab().name,
            "is_discovered": ServerContext.get_is_lab_discovered(),
            "ixpconfs": ServerContext.get_ixpconf_filename(),
            "lab_hash": ServerContext.get_lab().hash,
            "lab_machines": len(ServerContext.get_lab().machines) 
        }
    return error_4xx(response, status.HTTP_404_NOT_FOUND, message="no server context")


@router.get("/context/ixp_conf")
async def get_ixp_conf_context(response: Response):
    if ixp_ctx := ServerContext.get_ixpconf_filename():
        return success_2xx(message=ixp_ctx)
    else:
        return error_4xx(response=response, status_code=status.HTTP_404_NOT_FOUND, message="ixp.conf context not found")


@router.get("/logs", status_code=status.HTTP_200_OK)
async def get_logs(response: Response):  # TODO error handling
    try:
        logs = read_logs_file_content()
        return success_2xx(key_mess="logs", message=logs)
    except Exception as e:
        return error_5xx(response, message="server error")


@router.get("/stats/", status_code=status.HTTP_200_OK)
async def get_machine_stats(response: Response):
    try:
        stats_gen = Kathara.get_instance().get_machines_stats(ServerContext.get_lab().hash)
        stats = next(stats_gen)
        for key, value in stats.items():
            stats[key] = value.to_dict()
    except MachineNotFoundError:
        return error_4xx(response, message="Lab/Machines not found")
    return success_2xx(key_mess="stats", message=stats)


@router.get("/machines/count/running", status_code=status.HTTP_200_OK)
async def get_running_machines_count(response: Response):
    if not ServerContext.get_lab().hash:
        return error_4xx(response, message="cannot find lab")
    return success_2xx(key_mess="count", message=len(
        Kathara.get_instance().get_lab_from_api(ServerContext.get_lab().hash).machines))


@router.get("/machines/count/all/", status_code=status.HTTP_200_OK)
async def get_total_machines_count(response: Response):
    if not ServerContext.get_lab().hash:
        return error_4xx(response=response, message="cannot find lab")
    return success_2xx(key_mess="count", message=len(ServerContext.get_lab().machines))


@router.get("/machines/names/all/", status_code=status.HTTP_200_OK)
async def get_running_machines_names(response: Response):
    if not ServerContext.get_lab().hash:
        return error_4xx(response=response, status_code=status.HTTP_404_NOT_FOUND, message="cannot find lab")
    return success_2xx(message=get_running_machines_names_from_lab(ServerContext.get_lab().hash))


@router.websocket("/ws/logs")
async def logs_via_websocket(ws: WebSocket):
    await ws.accept()
    init_payload, sync_payload = init_logs_ws()
    await ws.send_json(init_payload)
    await ws.send_json(sync_payload)
    while True:
        try:
            await ws.send_json(sync_payload)
        except WebSocketDisconnect:
            logging.warning("WS Client Disconnected")
            break
        last_line_received_response = int((await ws.receive())["text"])
        count = count_log_lines()
        if last_line_received_response < count:
            new_logs_payload, sync_payload = await get_ws_sync_payload(last_line_received_response)
            try:
                await ws.send_json(new_logs_payload)
            except WebSocketDisconnect:
                logging.warning("WS Client Disconnected")
                break
        time.sleep(1)


@router.get("/docker/machines", status_code=status.HTTP_200_OK)
async def get_docker_machines():
    docker_machines = next(Kathara.get_instance().get_machines_stats())
    return success_2xx(message=filter_machines_info(docker_machines))


@router.get("/ribs_content/", status_code=status.HTTP_200_OK)
async def get_ribs_info_from_ixpconf_file(ixpconf_filename: str, response: Response):
    if ixpconf_filename != "" and exists_file_in_ixpconfigs(ixpconf_filename):
        ribs_names = get_rib_names_from_ixpconf_name(ixpconf_filename)
        ribs_contents = get_ribs_content_from_ixpconf_name(ixpconf_filename)
        return success_2xx(message={
            "ribs_names": ribs_names,
            "ribs_contents": ribs_contents
        })
    else:
        return error_4xx(response=response, status_code=status.HTTP_404_NOT_FOUND, message="file not found")


@router.get("/ribs/diff", status_code=status.HTTP_200_OK)
async def get_ribs_diff(response: Response, machine_name: str, ixp_conf_arg: str | None = None, machine_ip_type: int = Query(default=None, enum = [4,6])):
    ixp_conf_name = ixp_conf_arg if ixp_conf_arg else ServerContext.get_ixpconf_filename()
    logging.info(f"Requesting rib diff for {machine_name}, IP Type: {machine_ip_type}, config file: {ixp_conf_arg}")
    if not ixp_conf_name:
        return error_4xx(response=response,
                         message="Lab must have ixp.conf context or you need to specify the ixp.conf filename")

    ribs_names = get_rib_names_from_ixpconf_name(ServerContext.get_ixpconf_filename() if ServerContext.get_ixpconf_filename()
                                                 else ixp_conf_arg)
    
    actual_ribs_content = execute_command_on_machine(machine_name, "bgpctl show rib", ServerContext.get_lab())["stdout"]
    actual_rib_dump = RibDump(actual_ribs_content)
    expected_ribs_content = get_resource_file(ribs_names[machine_ip_type])
    expected_rib_dump = RibDump(expected_ribs_content)
    return success_2xx(message={
        'rib_names': ribs_names,
        'expected_rib_len': len(expected_rib_dump.rib_lines),
        'actual_rib_len': len(actual_rib_dump.rib_lines),
        'inters': len(actual_rib_dump.intersection(expected_rib_dump)),
        'notloaded': len(expected_rib_dump.difference(actual_rib_dump)),
        'missing': len(actual_rib_dump.difference(expected_rib_dump)),
    })
