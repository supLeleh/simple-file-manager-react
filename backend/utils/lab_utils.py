from Kathara.manager.Kathara import Kathara, Lab


def get_running_machines_names(lab_hash: str) -> list[str]:
    return list(Kathara.get_instance().get_lab_from_api(lab_hash).machines.keys())


def execute_command_on_machine(machine_name: str, command: str, lab: Lab) -> str:
    """
    Execute a command on a machine and return the output as a string
    
    Args:
        machine_name: Name of the machine
        command: Command to execute
        lab: Lab instance
        
    Returns:
        str: Command output
    """
    import logging
    
    try:
        logging.info(f"Executing command on {machine_name}: {command}")
        
        # Kathara.exec restituisce un generatore
        result = Kathara.get_instance().exec(
            machine_name, 
            command, 
            lab=lab, 
            stream=False
        )
        
        # Converti il generatore in lista
        output_lines = list(result)
        
        # L'output può essere in vari formati
        output_text = ""
        exit_code = None
        
        for item in output_lines:
            if item is None:
                continue
            
            # Se è un intero, è l'exit code
            if isinstance(item, int):
                exit_code = item
                continue
            
            # Se è bytes, è l'output del comando
            if isinstance(item, bytes):
                output_text += item.decode("UTF-8", errors='replace')
                continue
            
            # Se è una tupla (stdout, stderr)
            if isinstance(item, (tuple, list)) and len(item) >= 2:
                stdout_part = item[0]
                stderr_part = item[1]
                
                if stdout_part:
                    if isinstance(stdout_part, bytes):
                        output_text += stdout_part.decode("UTF-8", errors='replace')
                    else:
                        output_text += str(stdout_part)
                
                if stderr_part:
                    if isinstance(stderr_part, bytes):
                        output_text += "\n--- STDERR ---\n" + stderr_part.decode("UTF-8", errors='replace')
                    else:
                        output_text += "\n--- STDERR ---\n" + str(stderr_part)
                continue
            
            # Altrimenti, prova a convertire in stringa
            output_text += str(item)
        
        # Se l'output è vuoto
        if not output_text or output_text.strip() == "":
            output_text = "(Command executed successfully - no output)"
        else:
            output_text = output_text.strip()
        
        # Aggiungi info sull'exit code se diverso da 0
        if exit_code is not None and exit_code != 0:
            output_text = f"⚠️ Command exited with code {exit_code}\n\n{output_text}"
        
        logging.info(f"Command completed on {machine_name}")
        return output_text
        
    except Exception as e:
        logging.error(f"Error executing command on {machine_name}: {e}")
        import traceback
        logging.error(traceback.format_exc())
        raise Exception(f"Failed to execute command: {str(e)}")


def filter_machines_info(machines_info):
    machines = {}
    for name, infos in machines_info.items():
        full_infos = infos.to_dict()
        machines[name] = {
            key: value
            for key, value in full_infos.items()
            if key in ["status", "network_scenario_id", "name"]
        }
    return machines


def discover_running_lab():
    try:
        filtered_machines = filter_machines_info(
            next(Kathara.get_instance().get_machines_stats())
        )
        lab = None
        for stats in filtered_machines.values():
            lab = (
                stats["network_scenario_id"]
                if stats["network_scenario_id"] and stats["status"] == "running"
                else None
            )
            if lab:  # Esci non appena trovi un lab
                break
        return lab
    except StopIteration:
        # Nessuna macchina in esecuzione
        return None
    except Exception as e:
        import logging

        logging.error(f"Error discovering running lab: {e}")
        return None
