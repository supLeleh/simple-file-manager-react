import threading
import logging
import os

from Kathara.setting.Setting import Setting

from log import set_logging
from digital_twin.ixp.configuration.frr_scenario_configuration_applier import FrrScenarioConfigurationApplier
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
    """
    Build lab from IXP configuration file
    
    Args:
        ixp_configs_filename: Name of the config file (e.g., 'ixp.conf', 'prova.conf')
    """
    set_logging()

    logging.info("Building lab..")
    logging.info(f"Config filename received: {ixp_configs_filename}")
    
    # Get Settings singleton instance
    settings: Settings = Settings.get_instance()
    settings.load_from_disk()
    logging.info(f"settings: {settings}")
    
    # ✅ CORRETTO - USA IL PARAMETRO RICEVUTO
    config_file_path = os.path.join(BACKEND_IXPCONFIGS_FOLDER, ixp_configs_filename)
    
    logging.info(f"Loading config file from: {config_file_path}")
    
    # Verifica che il file esista
    if not os.path.exists(config_file_path):
        raise FileNotFoundError(f"Config file not found: {config_file_path}")
    
    # Carica settings dal file specificato
    load_settings_from_disk(settings, config_file_path)

    # Configura Kathara per usare Docker
    Setting.get_instance().load_from_dict({"manager_type": "docker"})

    logging.info(f"Peering configuration: {settings.peering_configuration}")
    
    # Carica member dump
    member_dump_class = MemberDumpFactory(submodule_package="digital_twin").get_class_from_name(
        settings.peering_configuration["type"]
    )
    entries = member_dump_class().load_from_file(
        os.path.join(BACKEND_RESOURCES_FOLDER, settings.peering_configuration["path"])
    )

    # Carica table dump
    table_dump = TableDumpFactory(submodule_package="digital_twin").get_class_from_name(
        settings.rib_dumps["type"]
    )(entries)
    
    for v, file in settings.rib_dumps["dumps"].items():
        dump_path = os.path.join(BACKEND_RESOURCES_FOLDER, file)
        logging.info(f"Loading RIB dump from: {dump_path}")
        table_dump.load_from_file(dump_path)

    # Enable for debug - limit to 5 entries
    table_dump.entries = dict(list(table_dump.entries.items())[0:5])

    # Build network scenario
    net_scenario_manager = NetworkScenarioManager()
    frr_conf = FrrScenarioConfigurationApplier(table_dump)
    rs_manager = RouteServerManager()

    net_scenario = net_scenario_manager.build(table_dump)
    frr_conf.apply_to_network_scenario(net_scenario)
    rs_manager.apply_to_network_scenario(net_scenario)
    net_scenario_manager.interconnect(table_dump)
    
    logging.info(f"Lab built successfully, hash: {net_scenario.hash}")
    logging.info(f"Machines in lab: {list(net_scenario.machines.keys())}")
    
    return net_scenario, net_scenario_manager


def start_lab(net_scenario_manager):
    """
    Start lab deployment in a separate thread
    """
    deployer_thread = threading.Thread(
        target=start_deploy,
        args=(net_scenario_manager,)
    )
    deployer_thread.start()


# Used to test locally backend functionalities
if __name__ == "__main__":
    # Per test locale, specifica il file desiderato
    lab, manager = build_lab("ixp.conf")
    start_lab(manager)
