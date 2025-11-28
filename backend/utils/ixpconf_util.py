import json

from globals import BACKEND_IXPCONFIGS_FOLDER
from utils.file_utils import (
    exists_file_in_directory,
    create_file_in_directory,
    get_resource_file,
    get_ixpconf_file,
)


def exists_file_in_ixpconfigs(filename):
    return exists_file_in_directory(filename, BACKEND_IXPCONFIGS_FOLDER)


def create_file_in_ixpconfigs(filename, content):
    manipulated_content = manipulate_ixpcontent(content)
    return create_file_in_directory(
        filename, manipulated_content, BACKEND_IXPCONFIGS_FOLDER
    )


def manipulate_ixpcontent(content_to_manipulate):
    new_content = json.loads(content_to_manipulate)
    new_content["peering_lan"]["4"] = new_content["peering_lan"]["four"]
    new_content["peering_lan"]["6"] = new_content["peering_lan"]["six"]
    new_content["rib_dumps"]["4"] = new_content["rib_dumps"]["four"]
    new_content["rib_dumps"]["6"] = new_content["rib_dumps"]["six"]
    del new_content["peering_lan"]["four"]
    del new_content["peering_lan"]["six"]
    del new_content["rib_dumps"]["four"]
    del new_content["rib_dumps"]["six"]
    return str(new_content)


import json
import logging

from globals import BACKEND_IXPCONFIGS_FOLDER
from utils.file_utils import (
    exists_file_in_directory,
    create_file_in_directory,
    get_resource_file,
    get_ixpconf_file,
)


def exists_file_in_ixpconfigs(filename):
    return exists_file_in_directory(filename, BACKEND_IXPCONFIGS_FOLDER)


def create_file_in_ixpconfigs(filename, content):
    manipulated_content = manipulate_ixpcontent(content)
    return create_file_in_directory(
        filename, manipulated_content, BACKEND_IXPCONFIGS_FOLDER
    )


def manipulate_ixpcontent(content_to_manipulate):
    new_content = json.loads(content_to_manipulate)
    new_content["peering_lan"]["4"] = new_content["peering_lan"]["four"]
    new_content["peering_lan"]["6"] = new_content["peering_lan"]["six"]
    new_content["rib_dumps"]["4"] = new_content["rib_dumps"]["four"]
    new_content["rib_dumps"]["6"] = new_content["rib_dumps"]["six"]
    del new_content["peering_lan"]["four"]
    del new_content["peering_lan"]["six"]
    del new_content["rib_dumps"]["four"]
    del new_content["rib_dumps"]["six"]
    return str(new_content)


def get_rib_names_from_ixpconf_name(ixpconf_name: str):
    """
    Ottieni i nomi dei file RIB dump dal file di configurazione

    Args:
        ixpconf_name: Nome del file di configurazione

    Returns:
        dict: Dizionario con chiavi STRINGA '4' e '6' e valori i nomi dei file dump
              Esempio: {'4': 'rib_v4.dump', '6': 'rib_v6.dump'}
    """
    if exists_file_in_ixpconfigs(ixpconf_name):
        try:
            config = get_ixpconf_file(ixpconf_name)

            # Accedi a rib_dumps["dumps"] invece di solo rib_dumps
            rib_dumps = config.get("rib_dumps", {})
            dumps = rib_dumps.get("dumps", {})

            # Restituisci con chiavi STRINGA per consistenza JSON
            return {"4": dumps.get("4", ""), "6": dumps.get("6", "")}
        except Exception as e:
            logging.error(f"Error getting rib names from {ixpconf_name}: {e}")
            return None
    return None


def get_ribs_content_from_ixpconf_name(ixpconf_name: str):
    """
    Ottieni il contenuto dei file RIB dump

    Args:
        ixpconf_name: Nome del file di configurazione

    Returns:
        dict: Dizionario con chiavi STRINGA '4' e '6' e valori il contenuto dei dump
    """
    ribs_names = get_rib_names_from_ixpconf_name(ixpconf_name)

    if not ribs_names:
        return None

    try:
        return {
            "4": get_resource_file(ribs_names["4"]),
            "6": get_resource_file(ribs_names["6"]),
        }
    except Exception as e:
        logging.error(f"Error getting ribs content from {ixpconf_name}: {e}")
        return None


def get_rib_names_from_ixpconf_name(ixpconf_name: str):
    """
    Ottieni i nomi dei file RIB dump dal file di configurazione
    
    Args:
        ixpconf_name: Nome del file di configurazione
        
    Returns:
        dict: Dizionario con chiavi STRINGA '4' e '6'
    """
    if exists_file_in_ixpconfigs(ixpconf_name):
        try:
            config = get_ixpconf_file(ixpconf_name)
            
            # Accedi a rib_dumps["dumps"] NON solo rib_dumps
            rib_dumps = config.get("rib_dumps", {})
            dumps = rib_dumps.get("dumps", {})
            
            # Restituisci con chiavi STRINGA
            return {
                "4": dumps.get("4", ""),
                "6": dumps.get("6", "")
            }
        except Exception as e:
            logging.error(f"Error getting rib names from {ixpconf_name}: {e}")
            return None
    return None

def get_ribs_content_from_ixpconf_name(ixpconf_name: str):
    ribs_names = get_rib_names_from_ixpconf_name(ixpconf_name)
    return (
        {4: get_resource_file(ribs_names[4]), 6: get_resource_file(ribs_names[6])}
        if ribs_names
        else None
    )
