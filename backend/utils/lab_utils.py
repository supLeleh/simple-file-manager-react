from Kathara.manager.Kathara import Kathara, Lab


def get_running_machines_names(lab_hash: str) -> list[str]:
    return list(Kathara.get_instance().get_lab_from_api(lab_hash).machines.keys())


def execute_command_on_machine(machine_name: str, command: str, lab: Lab) -> dict[str, list[str]]:
    std_out_and_err_str = [line for line in Kathara.get_instance().exec(machine_name, command, lab=lab, stream=False)]
    stderr = [line[1].decode("UTF-8") if line[1] else line[1] for line in std_out_and_err_str]
    if stderr is None or stderr is [None]:
        stderr = ""
    return {
        "stdout": [line[0].decode("UTF-8") if line[0] else line[0] for line in std_out_and_err_str],
        "stderr": stderr
    }


def filter_machines_info(machines_info):
    machines = {}
    for name, infos in machines_info.items():
        full_infos = infos.to_dict()
        machines[name] = {key: value for key, value in full_infos.items() if
                          key in ["status", "network_scenario_id", "name"]}
    return machines


def discover_running_lab():
    filtered_machines = filter_machines_info(next(Kathara.get_instance().get_machines_stats()))
    lab = None
    for stats in filtered_machines.values():
        lab = stats["network_scenario_id"] if stats["network_scenario_id"] and stats["status"] == "running" else None
        break
    return lab

