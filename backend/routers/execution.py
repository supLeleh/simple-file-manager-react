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
    ServerContext.set_ixpconf_filename(None)

    logging.info("IXP API Started")
    if ServerContext.get_is_lab_discovered():
        logging.info("Lab was discovered!")
    logging.info(f"Context:\n"
          f"Lab: {ServerContext.get_lab().hash if ServerContext.get_lab() else 'None'}\n"
          f"Machines: {ServerContext.get_total_machines().keys() if ServerContext.get_lab() else 'None'}")


@router.post("/start", status_code=status.HTTP_201_CREATED)
async def run_namex_lab(ixp_file: ConfigFileModel, response: Response):
    try:
        logging.info(f"=== START LAB REQUEST ===")
        logging.info(f"Received filename: {ixp_file.filename}")
        
        # IMPORTANTE: Wipe completo del lab precedente se esiste
        if ServerContext.get_lab():
            logging.info("Previous lab detected, wiping...")
            try:
                Kathara.get_instance().wipe()
                logging.info("Previous lab wiped successfully")
            except Exception as e:
                logging.warning(f"Error wiping previous lab: {e}")
        
        # Pulisci completamente il ServerContext
        ServerContext.set_lab(None)
        ServerContext.set_is_lab_discovered(None)
        ServerContext.set_ixpconf_filename(None)
        ServerContext.set_total_machines(None)
        
        logging.info(f"Building new lab with config: {ixp_file.filename}")
        
        # Costruisci il nuovo lab
        lab, net_scenario_manager = build_lab(ixp_file.filename)
        
        ServerContext.set_total_machines(lab.machines)
        ServerContext.set_lab(lab)
        ServerContext.set_is_lab_discovered(False)
        ServerContext.set_ixpconf_filename(ixp_file.filename)

        logging.info(f"Lab built successfully. Hash: {lab.hash}")
        logging.info(f"Machines in lab: {list(lab.machines.keys())}")
        logging.info(f"=========================")

        # Starting lab on different thread
        Thread(
            target=start_lab,
            args=(net_scenario_manager,)).start()

        return success_2xx(key_mess="lab_hash", message=ServerContext.get_lab().hash)
        
    except Exception as e:
        logging.error(f"Error starting the Lab: {e}")
        logging.error(traceback.format_exc())
        return error_4xx(response, message=f"couldn't start lab: {str(e)}")


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


def calculate_cpu_percent(stats, machine_name):
    """
    Calcola la percentuale CPU in modo robusto con validazione e normalizzazione.
    Ritorna un valore tra 0.0 e 100.0
    """
    try:
        cpu_stats = stats.get('cpu_stats', {})
        precpu_stats = stats.get('precpu_stats', {})
        
        cpu_usage = cpu_stats.get('cpu_usage', {})
        precpu_usage = precpu_stats.get('cpu_usage', {})
        
        total_usage = cpu_usage.get('total_usage', 0)
        precpu_total_usage = precpu_usage.get('total_usage', 0)
        
        system_cpu_usage = cpu_stats.get('system_cpu_usage', 0)
        precpu_system_usage = precpu_stats.get('system_cpu_usage', 0)
        
        cpu_count = cpu_stats.get('online_cpus', 1)
        
        # Calcola delta
        cpu_delta = total_usage - precpu_total_usage
        system_delta = system_cpu_usage - precpu_system_usage
        
        # Validazione: delta deve essere positivo
        if cpu_delta <= 0 or system_delta <= 0:
            return 0.0
        
        # Calcola percentuale
        cpu_percent = (cpu_delta / system_delta) * cpu_count * 100.0
        
        # Validazione: non può superare 100% per core
        max_cpu = 100.0 * cpu_count
        if cpu_percent > max_cpu:
            logging.warning(f"CPU {cpu_percent:.2f}% exceeds max {max_cpu:.2f}% for {machine_name}, capping to 100%")
            cpu_percent = 100.0
        elif cpu_percent < 0:
            logging.warning(f"CPU {cpu_percent:.2f}% is negative for {machine_name}, setting to 0%")
            cpu_percent = 0.0
        else:
            # Normalizza per singolo core (opzionale, dipende da come vuoi mostrare)
            # Se vuoi mostrare % totale su tutti i core, commenta questa riga
            cpu_percent = min(cpu_percent / cpu_count, 100.0)
        
        return round(cpu_percent, 2)
        
    except (KeyError, ZeroDivisionError, TypeError) as e:
        logging.warning(f"Error calculating CPU for {machine_name}: {e}")
        return 0.0


def calculate_memory_stats(stats, machine_name):
    """
    Calcola statistiche memoria con validazione
    """
    try:
        memory_stats = stats.get('memory_stats', {})
        mem_usage = memory_stats.get('usage', 0)
        mem_limit = memory_stats.get('limit', 1)
        
        # Validazione
        if mem_usage < 0:
            mem_usage = 0
        if mem_limit <= 0:
            mem_limit = 1
        
        usage_mb = round(mem_usage / (1024 * 1024), 2)
        limit_mb = round(mem_limit / (1024 * 1024), 2)
        percent = round((mem_usage / mem_limit) * 100, 2) if mem_limit > 0 else 0.0
        
        # Limita tra 0 e 100
        percent = min(max(percent, 0.0), 100.0)
        
        return usage_mb, limit_mb, percent
        
    except (KeyError, ZeroDivisionError, TypeError) as e:
        logging.warning(f"Error calculating memory for {machine_name}: {e}")
        return 0.0, 0.0, 0.0


def calculate_network_stats(stats, machine_name):
    """
    Calcola statistiche di rete
    """
    try:
        networks = stats.get('networks', {})
        total_rx = sum(net.get('rx_bytes', 0) for net in networks.values())
        total_tx = sum(net.get('tx_bytes', 0) for net in networks.values())
        
        rx_mb = round(max(total_rx, 0) / (1024 * 1024), 2)
        tx_mb = round(max(total_tx, 0) / (1024 * 1024), 2)
        
        return rx_mb, tx_mb
        
    except (KeyError, AttributeError, TypeError) as e:
        logging.warning(f"Error calculating network for {machine_name}: {e}")
        return 0.0, 0.0


def calculate_uptime(container, machine_name):
    """
    Calcola uptime del container
    """
    try:
        started_at = container.attrs['State']['StartedAt']
        if started_at:
            start_time = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
            uptime_seconds = (datetime.now(start_time.tzinfo) - start_time).total_seconds()
            
            if uptime_seconds < 0:
                return "N/A"
            
            hours = int(uptime_seconds // 3600)
            minutes = int((uptime_seconds % 3600) // 60)
            return f"{hours}h {minutes}m"
        return "N/A"
    except (KeyError, ValueError, TypeError) as e:
        logging.warning(f"Error calculating uptime for {machine_name}: {e}")
        return "N/A"


@router.get("/devices", status_code=status.HTTP_200_OK)
async def get_lab_devices(response: Response):
    if not ServerContext.get_lab():
        return error_4xx(response, status.HTTP_404_NOT_FOUND, message="no lab running")
    
    lab = ServerContext.get_lab()
    devices_info = []
    
    try:
        # Connessione a Docker
        docker_client = docker.from_env()
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
                # Cerca container con diverse naming convention
                possible_names = [
                    f"{lab.hash}_{machine_name}",
                    f"{lab.hash}-{machine_name}",
                    machine_name,
                    f"kathara_{lab.hash}_{machine_name}",
                ]
                
                container = None
                
                # Cerca per nome esatto
                for possible_name in possible_names:
                    try:
                        container = docker_client.containers.get(possible_name)
                        logging.info(f"Found container {possible_name} for device {machine_name}")
                        break
                    except docker.errors.NotFound:
                        continue
                
                # Cerca per match parziale
                if not container:
                    for c in all_containers:
                        if machine_name in c.name and lab.hash in c.name:
                            container = c
                            logging.info(f"Found container {c.name} by search for device {machine_name}")
                            break
                
                if not container:
                    logging.warning(f"Container not found for device {machine_name}")
                    device_stats["status"] = "not_found"
                    devices_info.append(device_stats)
                    continue
                
                # Stato container
                device_stats["status"] = container.status
                
                # Se non running, skip stats
                if container.status != 'running':
                    devices_info.append(device_stats)
                    continue
                
                # Ottieni stats
                stats = container.stats(stream=False)
                
                # Calcola metriche con funzioni dedicate
                device_stats["cpu_percent"] = calculate_cpu_percent(stats, machine_name)
                
                mem_usage, mem_limit, mem_percent = calculate_memory_stats(stats, machine_name)
                device_stats["memory_usage_mb"] = mem_usage
                device_stats["memory_limit_mb"] = mem_limit
                device_stats["memory_percent"] = mem_percent
                
                rx_mb, tx_mb = calculate_network_stats(stats, machine_name)
                device_stats["network_rx_mb"] = rx_mb
                device_stats["network_tx_mb"] = tx_mb
                
                device_stats["uptime"] = calculate_uptime(container, machine_name)
                
            except Exception as e:
                logging.error(f"Error getting stats for {machine_name}: {e}")
                device_stats["status"] = "error"
            
            devices_info.append(device_stats)
        
    except Exception as e:
        logging.error(f"Error connecting to Docker: {e}")
        logging.error(traceback.format_exc())
        return error_5xx(response, message=f"Error retrieving device stats: {str(e)}")
    
    return success_2xx(key_mess="devices", message=devices_info)
