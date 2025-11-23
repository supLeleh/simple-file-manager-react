import json
import logging
import os.path

from globals import BACKEND_IXPCONFIGS_FOLDER, BACKEND_RESOURCES_FOLDER


def exists_file_in_directory(filename, path):
    logging.debug(f"Checking the existence of '{filename}' in '{path}'")
    if not os.path.isdir(os.path.join(path)):
        logging.warning(f"'{path}' does not exist")
        return False
    file_path = os.path.join(path, filename)
    result = os.path.exists(file_path)
    if result:
        logging.debug(f"File '{filename}' exists")
    else:
        logging.warning(f"File '{filename}' does not exist")
    return result


def create_file_in_directory(filename, content, path):
    logging.info(f"Attempting creation of file '{filename}' in '{path}'")
    if not os.path.isdir(path):
        logging.error(f"Path: '{path}' is not valid")
        return False
    file_path = os.path.join(path, filename)
    try:
        with open(file_path, "w") as file:
            logging.info(f"Creating file {filename} in '{path}'")
            file.write(content)
            logging.info("File successfully created and content added")
            return True
    except Exception as e:
        logging.error(f"An error occurred creating file {filename} in '{path}': {e}")
        return False


def get_file_content(filename, directory):
    if exists_file_in_directory(filename, directory):
        with open(os.path.join(directory, filename), "r") as file:
            return file.read()
    else:
        return None
    
def get_file_content_lines(filename, directory):
    if exists_file_in_directory(filename, directory):
        with open(os.path.join(directory, filename), "r") as file:
            return file.readline()
    else:
        return None

def get_resource_file(filename):
    return get_file_content(filename, BACKEND_RESOURCES_FOLDER)

def get_resource_file_lines(filename):
    return get_file_content_lines(filename, BACKEND_RESOURCES_FOLDER)

def get_ixpconf_file(filename):
    return json.loads(get_file_content(filename, BACKEND_IXPCONFIGS_FOLDER))
