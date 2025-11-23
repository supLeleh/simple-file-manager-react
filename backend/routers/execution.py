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

    logging.info("Namex API Started")
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

