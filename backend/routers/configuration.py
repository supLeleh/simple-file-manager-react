import os

from fastapi import APIRouter, UploadFile, Response, status

from start_lab import build_lab
from utils.responses import success_2xx, error_4xx, error_5xx
from model.IXPConfFile import IXPConfFile
from model.file import ConfigFileModel
from utils.ixpconf_util import exists_file_in_ixpconfigs, create_file_in_ixpconfigs, get_ribs_content_from_ixpconf_name, get_rib_names_from_ixpconf_name
from utils.server_context import ServerContext

router = APIRouter(prefix="/namex/file", tags=["Namex Lab Configuration"])


@router.post("/running_ixpconf", status_code=status.HTTP_202_ACCEPTED)
async def set_running_ixpconf(ixp_filename: ConfigFileModel, response: Response):
    filename = ixp_filename.filename
    if not ServerContext.get_is_lab_discovered():
        return error_4xx(response=response,
                         status_code=status.HTTP_406_NOT_ACCEPTABLE,
                         message="ixp.conf file is already known")
    if not exists_file_in_ixpconfigs(filename):
        return error_4xx(response=response,
                         status_code=status.HTTP_406_NOT_ACCEPTABLE,
                         message="ixp.conf file does not exist")
    lab, _ = build_lab(filename)
    ServerContext.set_ixpconf_filename(filename)
    ServerContext.set_lab(lab)
    ServerContext.set_is_lab_discovered(False)
    ServerContext.set_total_machines(lab.machines)
    return success_2xx(message="ixp.conf file set successfully")


@router.post("/ixpconfigs", status_code=status.HTTP_202_ACCEPTED)
async def upload_ixp_config_file(file: UploadFile, response: Response):
    try:
        file_path = f"ixpconfigs/{file.filename}"
        with open(file_path, "wb") as f:
            f.write(file.file.read())
        return success_2xx(message="file saved successfully")
    except Exception as _:
        return error_5xx(response=response,
                         message="server error")


@router.post("/resources")  # TODO add support to delete files and add support to not override file
async def upload_resource_file(file: UploadFile, response: Response):
    try:
        file_path = f"resources/{file.filename}"
        with open(file_path, "wb") as f:  # TODO add error and refuse if file already exists
            f.write(file.file.read())
        return success_2xx(message="file saved successfully")
    except Exception as _:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return error_5xx(response=response,
                         message="server error")


@router.get("/ixpconfigs/all", status_code=status.HTTP_200_OK)  # Important: routes order is important
async def get_all_ixp_config_files(response: Response):
    try:
        ixp_config_files = os.listdir("ixpconfigs")
        filenames = [file for file in ixp_config_files if os.path.isfile(os.path.join("ixpconfigs", file))]
        # TODO put parameter for os.path.join
        return success_2xx(key_mess="filenames",
                           message=filenames)
    except Exception as _:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return error_5xx(response=response,
                         message="server error")


@router.get("/resources/all", status_code=status.HTTP_200_OK)
async def get_all_resource_config_files(response: Response):
    directory = "resources"  # TODO as external constant
    try:
        ixp_config_files = os.listdir(directory)
        filenames = [file for file in ixp_config_files if os.path.isfile(os.path.join(directory, file))]
        return success_2xx(key_mess="filenames",
                           message=filenames)
    except Exception as _:
        return error_5xx(response=response,
                         message="server error")


@router.get("/ixpconfigs/{filename}", status_code=status.HTTP_200_OK)
async def get_ixp_config_file(filename: str, response: Response):
    try:
        with open(f"ixpconfigs/{filename}", 'r') as file:
            content = file.read()
            return success_2xx(key_mess="file_content",
                               message=content)
    except FileNotFoundError:
        return error_4xx(response=response,
                         status_code=status.HTTP_404_NOT_FOUND,
                         message="file not found")
    except Exception as _:
        return error_5xx(response=response,
                         message="server error")


@router.get("/resources/{filename}", status_code=status.HTTP_200_OK)
async def get_resource_config_file(filename: str, response: Response):
    try:
        with open(f"resources/{filename}", 'r') as file:
            content = file.read()
            return success_2xx(key_mess="file_content",
                               message=content)
    except FileNotFoundError:
        return error_4xx(response=response,
                         status_code=status.HTTP_404_NOT_FOUND,
                         message="file not found")
    except Exception as _:
        return error_5xx(response=response,
                         message="server error")


@router.put("/ixpconfigs/", status_code=status.HTTP_201_CREATED)
async def put_ixpconfigs_file(ixp_conf_file: IXPConfFile, response: Response):
    filename = ixp_conf_file.filename
    content = ixp_conf_file.content.model_dump_json()  # TODO create utils for this method, will be a bit articulated
    if exists_file_in_ixpconfigs(filename):
        return error_4xx(response=response,
                         status_code=status.HTTP_406_NOT_ACCEPTABLE,
                         message="file already exists")
    create_file_in_ixpconfigs(filename, content)
    return success_2xx()


@router.delete("/ixpconfigs/{filename}", status_code=status.HTTP_200_OK)
async def delete_ixpconfigs_file(filename: str, response: Response):
    if filename != "" and os.path.exists(file_path := f"ixpconfigs/{filename}"):
        os.remove(file_path)
        return success_2xx(message="deleted")
    else:
        return error_4xx(response=response,
                         status_code=status.HTTP_404_NOT_FOUND,
                         message="file not found")


@router.delete("/resources/{filename}", status_code=status.HTTP_200_OK)
async def delete_resources_file(filename: str, response: Response):
    if filename != "" and os.path.exists(file_path := f"resources/{filename}"):
        os.remove(file_path)
        return success_2xx(message="deleted")
    else:
        return error_4xx(response=response,
                         status_code=status.HTTP_404_NOT_FOUND,
                         message="file not found")


