import threading
import logging
import os

from Kathara.setting.Setting import Setting


from log import set_logging
from digital_twin.ixp.configuration.frr_scenario_configuration_applier import FrrScenarioConfigurationApplier
# from digital_twin.ixp.dumps.member_dump import MemberDump
# from digital_twin.ixp.dumps.table_dump import TableDump
from digital_twin.ixp.foundation.dumps.member_dump.member_dump_factory import MemberDumpFactory
from digital_twin.ixp.foundation.dumps.table_dump.table_dump_factory import TableDumpFactory
from globals import BACKEND_RESOURCES_FOLDER, BACKEND_IXPCONFIGS_FOLDER
from digital_twin.ixp.network_scenario.network_scenario_manager import NetworkScenarioManager
from digital_twin.ixp.network_scenario.rs_manager import RouteServerManager
from digital_twin.ixp.settings.settings import Settings
from utils.dt_utils import load_settings_from_disk

def start_deploy(net_scenario_manager: NetworkScenarioManager):
    logging.info("Deploying lab..")
    net_scenario_manager.undeploy()
    net_scenario_manager.deploy_chunks()
    logging.info("Deploy lab complete")


def build_lab(ixp_configs_filename: str):
    set_logging()

    logging.info("Building lab..")
    settings: Settings = Settings.get_instance()
    settings.load_from_disk()
    print(f"settings: {settings}")
    #load_settings_from_disk(settings, ixp_configs_filename)
    ixp_configs_filename = "ixp.conf"  # Deve essere il nome del file!
    config_file_path = os.path.join(BACKEND_IXPCONFIGS_FOLDER, ixp_configs_filename)
    print(f"Loading config file from: {config_file_path}")
    load_settings_from_disk(settings, config_file_path)

    Setting.get_instance().load_from_dict({"manager_type": "docker"})

    print(settings.peering_configuration)
    member_dump_class = MemberDumpFactory(submodule_package="digital_twin").get_class_from_name(settings.peering_configuration["type"])
    entries = member_dump_class().load_from_file(os.path.join(BACKEND_RESOURCES_FOLDER, settings.peering_configuration["path"]))


    table_dump = TableDumpFactory(submodule_package="digital_twin").get_class_from_name(settings.rib_dumps["type"])(entries)
    for v, file in settings.rib_dumps["dumps"].items():
        table_dump.load_from_file(os.path.join(BACKEND_RESOURCES_FOLDER, file))

    # Enable for debug
    table_dump.entries = dict(list(table_dump.entries.items())[0:5])

    net_scenario_manager = NetworkScenarioManager()
    frr_conf = FrrScenarioConfigurationApplier(table_dump)
    rs_manager = RouteServerManager()

    net_scenario = net_scenario_manager.build(table_dump)
    frr_conf.apply_to_network_scenario(net_scenario)
    rs_manager.apply_to_network_scenario(net_scenario)
    net_scenario_manager.interconnect(table_dump)
    logging.info(f"Lab build, hash: {net_scenario.hash}")
    return net_scenario, net_scenario_manager

def start_lab(net_scenario_manager):
    deployer_thread = threading.Thread(
        target=start_deploy,
        args=(net_scenario_manager,))
    deployer_thread.start()


# Used to test locally backend functionalities
if __name__ == "__main__":
    lab = build_lab("ixp.conf")
    start_lab()
