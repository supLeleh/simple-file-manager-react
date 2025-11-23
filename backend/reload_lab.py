import logging
import os

from Kathara.setting.Setting import Setting

from log import set_logging
from digital_twin.ixp.configuration.frr_scenario_configuration_applier import FrrScenarioConfigurationApplier
# from digital_twin.ixp.dumps.member_dump import MemberDump
# from digital_twin.ixp.dumps.table_dump import TableDump
from digital_twin.ixp.foundation.dumps.member_dump.member_dump_factory import MemberDumpFactory
from digital_twin.ixp.foundation.dumps.table_dump.table_dump_factory import TableDumpFactory
from digital_twin.ixp.globals import RESOURCES_FOLDER
from digital_twin.ixp.network_scenario.network_scenario_manager import NetworkScenarioManager
from digital_twin.ixp.network_scenario.rs_manager import RouteServerManager
from digital_twin.ixp.settings.settings import Settings


def reload_lab(ixp_configs: str):
    set_logging()

    settings = Settings.get_instance()
    settings.load_from_disk(ixp_configs)

    Setting.get_instance().load_from_dict({"manager_type": "docker"})

    member_dump = MemberDumpFactory()
    entries = member_dump.load_from_file(os.path.join(RESOURCES_FOLDER, settings.peering_configuration))

    table_dump = TableDumpFactory(entries)
    for v, file in settings.rib_dumps.items():
        table_dump.load_from_file(os.path.join(RESOURCES_FOLDER, file))

    # Enable for debug
    # table_dump.entries = dict(list(table_dump.entries.items())[0:4])

    net_scenario_manager = NetworkScenarioManager()
    frr_conf = FrrScenarioConfigurationApplier(table_dump)

    net_scenario = net_scenario_manager.build_diff(table_dump)
    new_devices = dict(x for x in net_scenario.machines.items() if "new" in x[1].meta and x[1].meta["new"])
    frr_conf.apply_to_devices(new_devices)

    net_scenario_manager.deploy_devices(new_devices)
    net_scenario_manager.update_interconnection(table_dump, new_devices)

    # Upload RS configurations
    rs_manager = RouteServerManager()
    rs_info = rs_manager.get_device_info(net_scenario)
    return_code = net_scenario_manager.copy_and_exec_by_device_info(rs_info)
    if return_code != 0:
        raise Exception("Error while hot reloading lab: RS Copy and Exec phase")

    # Upload peerings configurations
    peerings_info = frr_conf.get_device_info(net_scenario)
    return_code = net_scenario_manager.copy_and_exec_by_device_info(peerings_info)
    if return_code != 0:
        raise Exception("Error while hot reloading lab: Peerings Copy and Exec phase")

    logging.success("Configurations reload finished!")
    return net_scenario


if __name__ == "__main__":
    reload_lab("ixp.conf")
