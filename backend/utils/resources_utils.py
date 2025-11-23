import os

from utils.file_utils import exists_file_in_directory, create_file_in_directory, get_resource_file


def exists_file_in_resources(filename):
    return exists_file_in_directory(filename, "resources")


def create_file_in_resources(filename, content):
    return create_file_in_directory(filename, content, "resources")


def parse_resource_file_lines(filename: str) -> list[str]:
    lines = []
    if exists_file_in_resources(filename):
        with open(os.path.join("./", "resources", filename), "r") as file:
            for line in file:
                if isinstance(line, str):
                    lines.append(" ".join(line.split()))  # normalize spaces
    return lines


def parse_ribs(content: str) -> list[str]:

    def validate_lines(line: str) -> bool:
        return not line.startswith(("flags", "S = Stale", "origin"))

    result = content.split("\n")
    result = list(map(lambda item: item.strip(), result))  # remove trailing spaces
    result = list(map(lambda item: ' '.join(item.split()), result))  # normalize inner spaces
    result = list(map(lambda item: item[2:] if item.startswith("*>") else item, result))  # remove starting prefix "*>" if present
    result = list(map(lambda item: item.strip(), result))  # remove trailing spaces again
    result = list(filter(validate_lines, result))  # remove possible heading lines
    result = [item for item in result if item != ""]  # remove empty lines
    return result


def parse_ribs_v6(content: str) -> list[str]:
    print("Ribs v6")
    print(type(content), content)
    return []
