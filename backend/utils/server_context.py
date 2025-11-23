from Kathara.model.Lab import Lab
from Kathara.model.Machine import Machine


class ServerContext:
    lab: Lab | None
    ixpconf_filename: str | None
    is_lab_discovered: bool | None
    total_machines: dict[str, Machine] | None

    @staticmethod
    def get_lab() -> Lab | None:
        return ServerContext.lab

    @staticmethod
    def set_lab(lab: Lab | None) -> None:
        ServerContext.lab = lab

    @staticmethod
    def get_ixpconf_filename() -> str | None:
        return ServerContext.ixpconf_filename

    @staticmethod
    def set_ixpconf_filename(ixpconf_filename: str | None) -> None:
        ServerContext.ixpconf_filename = ixpconf_filename

    @staticmethod
    def get_total_machines() -> dict[str, Machine]:
        return ServerContext.total_machines

    @staticmethod
    def set_total_machines(total_machines: dict[str, Machine]) -> None:
        ServerContext.total_machines = total_machines

    @staticmethod
    def get_is_lab_discovered() -> bool | None:
        return ServerContext.is_lab_discovered

    @staticmethod
    def set_is_lab_discovered(is_discovered: bool | None) -> None:
        ServerContext.is_lab_discovered = is_discovered
