import os
import json
import ipaddress

from globals import BACKEND_RESOURCES_FOLDER, BACKEND_IXPCONFIGS_FOLDER
from digital_twin.ixp.settings.settings import Settings


"""
Internal implementation to load settings from disk, specifying the
filename of the targeted settings file
"""
def load_settings_from_disk(setting_obj: Settings, filename):

    settings_path = os.path.abspath(os.path.join(BACKEND_IXPCONFIGS_FOLDER, filename))
    if not os.path.exists(settings_path):
        raise FileNotFoundError(f"File `{settings_path}` not found.")
    else:
        with open(settings_path, 'r') as settings_file:
            settings = json.load(settings_file)

        for name, value in settings.items():
            if hasattr(setting_obj, name):
                setattr(setting_obj, name, value)

    setting_obj.peering_lan["4"] = ipaddress.ip_network(setting_obj.peering_lan["4"])
    setting_obj.peering_lan["6"] = ipaddress.ip_network(setting_obj.peering_lan["6"])

    for rs in setting_obj.route_servers.values():
        rs["address"] = ipaddress.ip_address(rs["address"])

    if setting_obj.quarantine["probe_ips"]["4"]:
        setting_obj.quarantine["probe_ips"]["4"] = ipaddress.ip_address(setting_obj.quarantine["probe_ips"]["4"])
    if setting_obj.quarantine["probe_ips"]["6"]:
        setting_obj.quarantine["probe_ips"]["6"] = ipaddress.ip_address(setting_obj.quarantine["probe_ips"]["6"])
    