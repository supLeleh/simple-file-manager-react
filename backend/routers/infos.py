import logging
import time
import docker
from datetime import datetime, timedelta

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
from utils.docker_utils import get_docker_client, get_all_running_containers, find_container_by_name

router = APIRouter(prefix="/ixp/info", tags=["IXP Info"])

# ==================== CACHE SYSTEM ====================

class SimpleCache:
    def __init__(self, ttl_seconds=5):
        self._cache = {}
        self.ttl = timedelta(seconds=ttl_seconds)
    
    def get(self, key):
        if key in self._cache:
            data, timestamp = self._cache[key]
            if datetime.now() - timestamp < self.ttl:
                return data
            else:
                del self._cache[key]
        return None
    
    def set(self, key, data):
        self._cache[key] = (data, datetime.now())
    
    def clear(self):
        self._cache.clear()

# Cache globale con TTL di 5 secondi
_stats_cache = SimpleCache(ttl_seconds=5)
_docker_client = None

def get_docker_client():
    """Docker client singleton"""
    global _docker_client
    if _docker_client is None:
        _docker_client = docker.from_env()
    return _docker_client

def get_all_running_containers():
    """Ottieni tutti i container in una sola query"""
    try:
        client = get_docker_client()
        return client.containers.list(filters={"status": "running"})
    except Exception as e:
        logging.error(f"Error getting containers: {e}")
        return []

def clear_cache():
    """Pulisce la cache - da chiamare dopo wipe/start"""
    _stats_cache.clear()
    logging.info("Stats cache cleared")

# ==================== END CACHE SYSTEM ====================


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
async def get_logs(response: Response):
    try:
        logs = read_logs_file_content()
        return success_2xx(key_mess="logs", message=logs)
    except Exception as e:
        logging.error(f"Error reading logs: {e}")
        return error_5xx(response, message="server error")


@router.get("/stats/", status_code=status.HTTP_200_OK)
async def get_machine_stats(response: Response):
    """Stats con caching per ridurre il carico"""
    
    if not ServerContext.get_lab():
        return error_4xx(response, message="Lab not found")
    
    # Prova cache
    cache_key = f"stats_{ServerContext.get_lab().hash}"
    cached_stats = _stats_cache.get(cache_key)
    
    if cached_stats is not None:
        return success_2xx(key_mess="stats", message=cached_stats)
    
    try:
        stats_gen = Kathara.get_instance().get_machines_stats(ServerContext.get_lab().hash)
        stats = next(stats_gen)
        
        stats_dict = {}
        for key, value in stats.items():
            stats_dict[key] = value.to_dict()
        
        # Salva in cache
        _stats_cache.set(cache_key, stats_dict)
        
        return success_2xx(key_mess="stats", message=stats_dict)
        
    except MachineNotFoundError:
        return error_4xx(response, message="Lab/Machines not found")
    except Exception as e:
        logging.error(f"Error getting stats: {e}")
        return error_5xx(response, message="Error getting machine stats")


@router.get("/machines/count/running", status_code=status.HTTP_200_OK)
async def get_running_machines_count(response: Response):
    if not ServerContext.get_lab() or not ServerContext.get_lab().hash:
        return error_4xx(response, message="cannot find lab")
    
    try:
        count = len(Kathara.get_instance().get_lab_from_api(ServerContext.get_lab().hash).machines)
        return success_2xx(key_mess="count", message=count)
    except Exception as e:
        logging.error(f"Error getting running machines count: {e}")
        return error_5xx(response, message="Error getting machines count")


@router.get("/machines/count/all/", status_code=status.HTTP_200_OK)
async def get_total_machines_count(response: Response):
    if not ServerContext.get_lab() or not ServerContext.get_lab().hash:
        return error_4xx(response=response, message="cannot find lab")
    return success_2xx(key_mess="count", message=len(ServerContext.get_lab().machines))


@router.get("/machines/names/all/", status_code=status.HTTP_200_OK)
async def get_running_machines_names(response: Response):
    if not ServerContext.get_lab() or not ServerContext.get_lab().hash:
        return error_4xx(response=response, status_code=status.HTTP_404_NOT_FOUND, message="cannot find lab")
    
    try:
        names = get_running_machines_names_from_lab(ServerContext.get_lab().hash)
        return success_2xx(message=names)
    except Exception as e:
        logging.error(f"Error getting machine names: {e}")
        return error_5xx(response, message="Error getting machine names")


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
            logging.info("WS Client Disconnected")
            break
        
        try:
            last_line_received_response = int((await ws.receive())["text"])
            count = count_log_lines()
            
            if last_line_received_response < count:
                new_logs_payload, sync_payload = await get_ws_sync_payload(last_line_received_response)
                await ws.send_json(new_logs_payload)
        except WebSocketDisconnect:
            logging.info("WS Client Disconnected")
            break
        except Exception as e:
            logging.error(f"Error in websocket loop: {e}")
            break
        
        time.sleep(1)


@router.get("/docker/machines", status_code=status.HTTP_200_OK)
async def get_docker_machines():
    """Docker machines con caching"""
    
    cache_key = "docker_machines"
    cached_machines = _stats_cache.get(cache_key)
    
    if cached_machines is not None:
        return success_2xx(message=cached_machines)
    
    try:
        docker_machines = next(Kathara.get_instance().get_machines_stats())
        filtered = filter_machines_info(docker_machines)
        
        # Salva in cache
        _stats_cache.set(cache_key, filtered)
        
        return success_2xx(message=filtered)
    except Exception as e:
        logging.error(f"Error getting docker machines: {e}")
        return error_5xx(response=Response(), message="Error getting docker machines")


@router.get("/ribs_content/", status_code=status.HTTP_200_OK)
async def get_ribs_info_from_ixpconf_file(ixpconf_filename: str, response: Response):
    if not ixpconf_filename or ixpconf_filename == "":
        return error_4xx(response=response, status_code=status.HTTP_400_BAD_REQUEST, message="filename required")
    
    if not exists_file_in_ixpconfigs(ixpconf_filename):
        return error_4xx(response=response, status_code=status.HTTP_404_NOT_FOUND, message="file not found")
    
    try:
        ribs_names = get_rib_names_from_ixpconf_name(ixpconf_filename)
        ribs_contents = get_ribs_content_from_ixpconf_name(ixpconf_filename)
        
        return success_2xx(message={
            "ribs_names": ribs_names,
            "ribs_contents": ribs_contents
        })
    except Exception as e:
        logging.error(f"Error getting ribs content: {e}")
        return error_5xx(response=response, message="Error loading ribs content")


@router.get("/ribs/diff", status_code=status.HTTP_200_OK)
async def get_ribs_diff(
    response: Response, 
    machine_name: str, 
    ixp_conf_arg: str | None = None, 
    machine_ip_type: int = Query(default=4, ge=4, le=6)
):
    ixp_conf_name = ixp_conf_arg if ixp_conf_arg else ServerContext.get_ixpconf_filename()
    
    if not ixp_conf_name:
        return error_4xx(
            response=response,
            message="Lab must have ixp.conf context or you need to specify the ixp.conf filename"
        )
    
    if machine_ip_type not in [4, 6]:
        return error_4xx(response=response, message="machine_ip_type must be 4 or 6")
    
    logging.info(f"Requesting rib diff for {machine_name}, IP Type: {machine_ip_type}, config: {ixp_conf_name}")
    
    try:
        ribs_names = get_rib_names_from_ixpconf_name(ixp_conf_name)
        
        # Converti machine_ip_type in stringa per accedere al dizionario
        ip_type_key = str(machine_ip_type)
        
        if ip_type_key not in ribs_names:
            return error_4xx(
                response=response, 
                message=f"No RIB dump configured for IPv{machine_ip_type}"
            )
        
        # Esegui comando bgpctl show rib
        logging.info(f"Executing 'bgpctl show rib' on {machine_name}")
        command_result = execute_command_on_machine(machine_name, "bgpctl show rib", ServerContext.get_lab())
        
        # Il nuovo execute_command_on_machine restituisce una stringa
        actual_ribs_content = command_result if isinstance(command_result, str) else str(command_result)
        
        if not actual_ribs_content or actual_ribs_content.strip() == "":
            return error_4xx(
                response=response,
                message=f"Empty or invalid RIB output from {machine_name}"
            )
        
        # Crea dump dall'output attuale
        actual_rib_dump = RibDump(actual_ribs_content)
        
        # Carica dump atteso dal file
        expected_rib_file = ribs_names[ip_type_key]
        expected_ribs_content = get_resource_file(expected_rib_file)
        expected_rib_dump = RibDump(expected_ribs_content)
        
        # Calcola differenze
        intersection = actual_rib_dump.intersection(expected_rib_dump)
        not_loaded = expected_rib_dump.difference(actual_rib_dump)
        extra_routes = actual_rib_dump.difference(expected_rib_dump)
        
        logging.info(f"RIB diff completed: {len(intersection)} matching, {len(not_loaded)} not loaded, {len(extra_routes)} extra")
        
        return success_2xx(message={
            'rib_names': ribs_names,
            'expected_rib_len': len(expected_rib_dump.rib_lines),
            'actual_rib_len': len(actual_rib_dump.rib_lines),
            'inters': len(intersection),
            'notloaded': len(not_loaded),
            'missing': len(extra_routes),
        })
        
    except Exception as e:
        logging.error(f"Error getting rib diff: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return error_5xx(response=response, message=f"Error getting rib diff: {str(e)}")


# Funzione helper per pulire la cache (esporta per uso in altri router)
def clear_info_cache():
    """Esposta per essere chiamata da execution.py dopo wipe/start"""
    clear_cache()
