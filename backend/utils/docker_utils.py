import docker
import logging

_docker_client = None

def get_docker_client():
    """
    Ottieni il client Docker singleton
    Riusa la stessa connessione invece di crearne una nuova ogni volta
    """
    global _docker_client
    if _docker_client is None:
        _docker_client = docker.from_env()
    return _docker_client


def get_all_running_containers():
    """
    Ottieni tutti i container in esecuzione in una sola query
    Molto più efficiente che fare query multiple
    """
    try:
        client = get_docker_client()
        return client.containers.list(filters={"status": "running"})
    except Exception as e:
        logging.error(f"Error getting containers: {e}")
        return []


def find_container_by_name(containers, device_name, lab_hash):
    """
    Trova un container dalla lista pre-caricata
    
    Args:
        containers: Lista di container da docker
        device_name: Nome del device da cercare
        lab_hash: Hash del lab
        
    Returns:
        Container Docker o None
    """
    for container in containers:
        if device_name in container.name and lab_hash in container.name:
            return container
    return None
