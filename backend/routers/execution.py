import logging
from typing import Annotated
from threading import Thread
from utils.responses import *
from Kathara.manager.Kathara import Kathara
from fastapi import APIRouter, status, Response, Body
from start_lab import build_lab, start_lab
from reload_lab import reload_lab
from model.file import ConfigFileModel
from model.lab import Lab as BodyLab
from utils.lab_utils import get_running_machines_names, execute_command_on_machine, discover_running_lab
from utils.server_context import ServerContext
import traceback
import docker
from datetime import datetime

router = APIRouter(
    prefix="/ixp",
    tags=["IXP Lab Execution"])

def startup():
    found_lab_hash = discover_running_lab()
    lab = Kathara.get_instance().get_lab_from_api(found_lab_hash) if found_lab_hash else None
    ServerContext.set_is_lab_discovered(True if lab is not None else None)
    ServerContext.set_lab(lab)
    ServerContext.set_total_machines(lab.machines if lab else None)
    ServerContext.set_ixpconf_filename(None)  # even if lab is found, we don't know if we have the related ixp.conf,
    # will have to be set via specific endpoint

    logging.info("IXP API Started")
    if ServerContext.get_is_lab_discovered():
        logging.info("Lab was discovered!")
    logging.info(f"Context:\n"
          f"Lab: {ServerContext.get_lab().hash if ServerContext.get_lab() else 'None'}\n"
          f"Machines: {ServerContext.get_total_machines().keys() if ServerContext.get_lab() else 'None'}")


@router.post("/start", status_code=status.HTTP_201_CREATED)
async def run_namex_lab(ixp_file: ConfigFileModel, response: Response):
    try:
        lab, net_scenario_manager = build_lab(ixp_file.filename)
        ServerContext.set_total_machines(lab.machines)
        ServerContext.set_lab(lab)
        ServerContext.set_is_lab_discovered(False)
        ServerContext.set_ixpconf_filename(ixp_file.filename)

        # Starting lab on different thread, to not impact response
        Thread(
            target=start_lab,
            args=(net_scenario_manager,)).start()

        return success_2xx(key_mess="lab_hash", message=ServerContext.get_lab().hash)
    except Exception as e:
        logging.error(f"Error starting the Lab: {e}")
        logging.error(traceback.print_exc())
        return error_4xx(response, message="couldn't start lab")


@router.get("/running", status_code=status.HTTP_200_OK)
async def get_namex_running_instance(response: Response):
    if not ServerContext.get_lab():
        return error_4xx(response, status.HTTP_404_NOT_FOUND, message="no lab running")
    return success_2xx(key_mess="info",
                       message={
                            "hash": ServerContext.get_lab().hash,
                            "discovered": ServerContext.get_is_lab_discovered()}
                       )


@router.post("/wipe", status_code=status.HTTP_200_OK)
async def wipe_namex_lab():
    Kathara.get_instance().wipe()
    ServerContext.set_lab(None)
    ServerContext.set_is_lab_discovered(None)
    ServerContext.set_ixpconf_filename(None)
    return success_2xx()


@router.post("/hot_reload", status_code=status.HTTP_200_OK)
async def hot_reload_namex_lab(lab: BodyLab, response: Response):
    if not ServerContext.get_lab():
        return error_4xx(response, status.HTTP_404_NOT_FOUND, message="no lab running")
    if ServerContext.get_lab().hash != lab.hash:
        return error_4xx(response, status.HTTP_404_NOT_FOUND, message="lab not found")
    try:
        new_lab = reload_lab(ServerContext.get_ixpconf_filename())
        ServerContext.set_lab(new_lab)
        return success_2xx(key_mess="lab_hash", message=ServerContext.get_lab().hash)
    except Exception as e:
        logging.error(f"Error reloading the Lab: {e}")
        return error_5xx(response, message="couldn't start lab")


@router.post("/execute_command/{rs_name}", status_code=status.HTTP_200_OK)
async def execute_command_on_rs(rs_name: str, command: Annotated[str, Body()], response: Response):
    if ServerContext.get_lab() is None:
        return error_4xx(response, status.HTTP_404_NOT_FOUND, message="lab not found")
    machine_names = get_running_machines_names(ServerContext.get_lab().hash)
    if rs_name not in machine_names:
        return error_4xx(response, status.HTTP_404_NOT_FOUND, message="machine not found")
    command_output = execute_command_on_machine(rs_name, command, ServerContext.get_lab())
    return success_2xx(message=command_output)

import docker
from datetime import datetime

@router.get("/devices", status_code=status.HTTP_200_OK)
async def get_lab_devices(response: Response):
    if not ServerContext.get_lab():
        return error_4xx(response, status.HTTP_404_NOT_FOUND, message="no lab running")
    
    lab = ServerContext.get_lab()
    devices_info = []
    
    try:
        # Connessione a Docker per ottenere stats
        docker_client = docker.from_env()
        
        # Lista tutti i container attivi
        all_containers = docker_client.containers.list()
        logging.info(f"Found {len(all_containers)} running containers")
        
        for machine_name, machine in lab.machines.items():
            device_stats = {
                "name": machine_name,
                "status": "unknown",
                "interfaces": len(machine.interfaces) if hasattr(machine, 'interfaces') else 0,
                "meta": machine.meta if hasattr(machine, 'meta') else {},
                "cpu_percent": 0.0,
                "memory_usage_mb": 0.0,
                "memory_limit_mb": 0.0,
                "memory_percent": 0.0,
                "network_rx_mb": 0.0,
                "network_tx_mb": 0.0,
                "uptime": "N/A"
            }
            
            try:
                # Prova diverse naming convention di Kathara
                possible_names = [
                    f"{lab.hash}_{machine_name}",  # Standard
                    f"{lab.hash}-{machine_name}",  # Con trattino
                    machine_name,                   # Solo nome
                    f"kathara_{lab.hash}_{machine_name}",  # Con prefisso kathara
                ]
                
                container = None
                container_name_found = None
                
                # Cerca il container con diversi pattern
                for possible_name in possible_names:
                    try:
                        container = docker_client.containers.get(possible_name)
                        container_name_found = possible_name
                        logging.info(f"Found container {possible_name} for device {machine_name}")
                        break
                    except docker.errors.NotFound:
                        continue
                
                # Se non trovato con get, cerca per nome nei container attivi
                if not container:
                    for c in all_containers:
                        if machine_name in c.name or lab.hash in c.name:
                            container = c
                            container_name_found = c.name
                            logging.info(f"Found container {c.name} by search for device {machine_name}")
                            break
                
                if not container:
                    logging.warning(f"Container not found for device {machine_name}. Tried: {possible_names}")
                    device_stats["status"] = "not_found"
                    devices_info.append(device_stats)
                    continue
                
                # Stato container
                device_stats["status"] = container.status
                
                # Se container non è running, skip stats
                if container.status != 'running':
                    devices_info.append(device_stats)
                    continue
                
                # Stats in tempo reale
                stats = container.stats(stream=False)
                
                # Calcola CPU %
                try:
                    cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                               stats['precpu_stats']['cpu_usage']['total_usage']
                    system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                                  stats['precpu_stats']['system_cpu_usage']
                    cpu_count = stats['cpu_stats'].get('online_cpus', 1)
                    
                    if system_delta > 0 and cpu_delta > 0:
                        cpu_percent = (cpu_delta / system_delta) * cpu_count * 100.0
                        device_stats["cpu_percent"] = round(cpu_percent, 2)
                except (KeyError, ZeroDivisionError) as e:
                    logging.warning(f"Error calculating CPU for {machine_name}: {e}")
                
                # Memoria
                try:
                    mem_usage = stats['memory_stats'].get('usage', 0)
                    mem_limit = stats['memory_stats'].get('limit', 1)
                    device_stats["memory_usage_mb"] = round(mem_usage / (1024 * 1024), 2)
                    device_stats["memory_limit_mb"] = round(mem_limit / (1024 * 1024), 2)
                    device_stats["memory_percent"] = round((mem_usage / mem_limit) * 100, 2) if mem_limit > 0 else 0
                except (KeyError, ZeroDivisionError) as e:
                    logging.warning(f"Error calculating memory for {machine_name}: {e}")
                
                # Network stats
                try:
                    networks = stats.get('networks', {})
                    total_rx = sum(net.get('rx_bytes', 0) for net in networks.values())
                    total_tx = sum(net.get('tx_bytes', 0) for net in networks.values())
                    device_stats["network_rx_mb"] = round(total_rx / (1024 * 1024), 2)
                    device_stats["network_tx_mb"] = round(total_tx / (1024 * 1024), 2)
                except (KeyError, AttributeError) as e:
                    logging.warning(f"Error calculating network for {machine_name}: {e}")
                
                # Uptime
                try:
                    started_at = container.attrs['State']['StartedAt']
                    if started_at:
                        start_time = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                        uptime_seconds = (datetime.now(start_time.tzinfo) - start_time).total_seconds()
                        hours = int(uptime_seconds // 3600)
                        minutes = int((uptime_seconds % 3600) // 60)
                        device_stats["uptime"] = f"{hours}h {minutes}m"
                except (KeyError, ValueError) as e:
                    logging.warning(f"Error calculating uptime for {machine_name}: {e}")
                
            except Exception as e:
                logging.error(f"Error getting stats for {machine_name}: {e}")
                device_stats["status"] = "error"
            
            devices_info.append(device_stats)
        
    except Exception as e:
        logging.error(f"Error connecting to Docker: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return error_5xx(response, message=f"Error retrieving device stats: {str(e)}")
    
    return success_2xx(key_mess="devices", message=devices_info)


