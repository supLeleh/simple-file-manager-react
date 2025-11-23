import json

from globals import BACKEND_IXPCONFIGS_FOLDER 
from utils.file_utils import exists_file_in_directory, create_file_in_directory, get_resource_file, get_ixpconf_file

def exists_file_in_ixpconfigs(filename):
    return exists_file_in_directory(filename, BACKEND_IXPCONFIGS_FOLDER)


def create_file_in_ixpconfigs(filename, content):
    manipulated_content = manipulate_ixpcontent(content)
    return create_file_in_directory(filename, manipulated_content, BACKEND_IXPCONFIGS_FOLDER)


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
    if exists_file_in_ixpconfigs(ixpconf_name):
        rib_name = get_ixpconf_file(ixpconf_name)["rib_dumps"]
        return {
            4: rib_name["4"],
            6: rib_name["6"]
        }
    return None


def get_ribs_content_from_ixpconf_name(ixpconf_name: str):
    ribs_names = get_rib_names_from_ixpconf_name(ixpconf_name)
    return {
        4: get_resource_file(ribs_names[4]),
        6: get_resource_file(ribs_names[6])
    } if ribs_names else None
