import re
import logging


def isHeader(line: str) -> bool:
    """
    Verifica se una linea è parte dell'header del RIB dump
    
    Args:
        line: Linea da verificare
        
    Returns:
        bool: True se è un header, False altrimenti
    """
    if not line or line.strip() == "":
        return True
    
    line_lower = line.lower().strip()
    
    # Pattern di header specifici
    header_patterns = [
        r'^flags:',
        r'^origin validation',
        r'^origin:',
        r'^\s*ovs\s+destination',
        r'valid.*selected.*announced',
    ]
    
    for pattern in header_patterns:
        if re.match(pattern, line_lower):
            return True
    
    # Se contiene solo keyword senza dati, è header
    if all(keyword in line_lower for keyword in ['flags', 'destination']):
        return True
    
    return False


class RibLine:
    """
    Rappresenta una singola entry del RIB dump
    
    Il confronto si basa SOLO sul prefisso di rete normalizzato
    """
    
    def __init__(self, line: str) -> None:
        """
        Inizializza una RibLine dal contenuto della linea
        
        Args:
            line: Linea del RIB dump
        """
        # Pulisci e normalizza la linea
        line = " ".join(line.strip().split())
        
        if not line:
            raise ValueError("Cannot create RibLine from empty line")
        
        self.raw_line = line
        self.params = line.split()
        
        # Estrai il prefisso di rete (campo più importante per il confronto)
        self.prefix = self._extract_prefix(line)
        
        if not self.prefix:
            raise ValueError(f"Cannot extract network prefix from line: {line[:100]}")
        
        # Normalizza il prefisso
        self.prefix = self._normalize_prefix(self.prefix)
    
    def _extract_prefix(self, line: str) -> str:
        """
        Estrae il prefisso di rete dalla linea
        
        Args:
            line: Linea del RIB
            
        Returns:
            str: Prefisso di rete (es: '2.21.164.0/22')
        """
        # Cerca IPv4 (più comune)
        ipv4_match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2})', line)
        if ipv4_match:
            return ipv4_match.group(1)
        
        # Cerca IPv6
        ipv6_match = re.search(r'([0-9a-fA-F:]+::[0-9a-fA-F:]*\/\d{1,3})', line)
        if ipv6_match:
            return ipv6_match.group(1)
        
        # IPv6 full format
        ipv6_full_match = re.search(r'([0-9a-fA-F:]{2,}\/\d{1,3})', line)
        if ipv6_full_match:
            return ipv6_full_match.group(1)
        
        return None
    
    def _normalize_prefix(self, prefix: str) -> str:
        """
        Normalizza il prefisso per garantire confronti consistenti
        
        Args:
            prefix: Prefisso da normalizzare
            
        Returns:
            str: Prefisso normalizzato
        """
        # Rimuovi spazi
        prefix = prefix.strip()
        
        # Per IPv6, converti in minuscolo
        if ':' in prefix:
            prefix = prefix.lower()
        
        return prefix
    
    def __hash__(self):
        """
        Hash basato sul prefisso normalizzato
        """
        return hash(self.prefix)
    
    def __eq__(self, other):
        """
        Confronto basato sul prefisso normalizzato
        
        Args:
            other: Altra RibLine da confrontare
            
        Returns:
            bool: True se hanno lo stesso prefisso
        """
        if isinstance(other, RibLine):
            return self.prefix == other.prefix
        return False
    
    def __str__(self):
        """Rappresentazione stringa"""
        return self.prefix
    
    def __repr__(self):
        """Rappresentazione per debug"""
        return f"RibLine({self.prefix})"


class RibDump:
    """
    Rappresenta un dump completo del RIB
    """
    
    def __init__(self, dump_content: list | str) -> None:
        """
        Inizializza un RibDump dal contenuto
        
        Args:
            dump_content: Contenuto del RIB (lista di stringhe o stringa unica)
        """
        self.rib_lines = set()
        self.errors = []
        self.raw_content = dump_content
        
        # Se dump_content è una lista (da execute_command)
        if isinstance(dump_content, list):
            self._parse_from_list(dump_content)
        # Se dump_content è una stringa (da file)
        elif isinstance(dump_content, str):
            self._parse_from_string(dump_content)
        else:
            raise ValueError(f"Invalid dump_content type: {type(dump_content)}")
        
        logging.info(f"RibDump parsed: {len(self.rib_lines)} routes, {len(self.errors)} errors")
        
        # Debug: mostra alcune rotte
        if len(self.rib_lines) > 0:
            sample_routes = list(self.rib_lines)[:5]
            logging.debug(f"Sample routes: {[str(r) for r in sample_routes]}")
    
    def _parse_from_list(self, dump_content: list) -> None:
        """
        Parsa il dump da una lista di stringhe (output comando)
        
        Args:
            dump_content: Lista di stringhe
        """
        # Converti in stringa unica e poi parsa
        merged_content = "\n".join([str(line) for line in dump_content if line])
        self._parse_from_string(merged_content)
    
    def _parse_from_string(self, dump_content: str) -> None:
        """
        Parsa il dump da una stringa (file dump o comando)
        
        Args:
            dump_content: Stringa con il contenuto del dump
        """
        lines_processed = 0
        lines_skipped = 0
        
        # Splitta per linee
        for line in dump_content.splitlines():
            lines_processed += 1
            
            # Pulisci la linea
            line = line.strip()
            
            if not line:
                continue
            
            # Skip header
            if isHeader(line):
                lines_skipped += 1
                logging.debug(f"Skipping header: {line[:60]}")
                continue
            
            # Prova a creare RibLine
            try:
                rib_line = RibLine(line)
                self.rib_lines.add(rib_line)
            except ValueError as e:
                lines_skipped += 1
                logging.debug(f"Skipping invalid line: {str(e)[:100]}")
                self.errors.append(str(e)[:200])
        
        logging.info(f"Processed {lines_processed} lines, added {len(self.rib_lines)} routes, skipped {lines_skipped}")
    
    def intersection(self, other: 'RibDump') -> set[RibLine]:
        """
        Trova le rotte presenti in entrambi i dump
        
        Args:
            other: Altro RibDump da confrontare
            
        Returns:
            set: Rotte presenti in entrambi
        """
        result = self.rib_lines & other.rib_lines
        logging.debug(f"Intersection: {len(result)} routes")
        return result
    
    def difference(self, other: 'RibDump') -> set[RibLine]:
        """
        Trova le rotte presenti in questo dump ma non nell'altro
        
        Args:
            other: Altro RibDump da confrontare
            
        Returns:
            set: Rotte presenti solo in questo dump
        """
        result = self.rib_lines - other.rib_lines
        logging.debug(f"Difference: {len(result)} routes in self but not in other")
        
        # Debug: mostra alcune differenze
        if len(result) > 0 and len(result) <= 10:
            logging.debug(f"Routes in self but not in other: {[str(r) for r in result]}")
        
        return result
    
    def symmetric_difference(self, other: 'RibDump') -> set[RibLine]:
        """
        Trova le rotte presenti in uno solo dei due dump
        
        Args:
            other: Altro RibDump da confrontare
            
        Returns:
            set: Rotte presenti in uno solo dei due dump
        """
        return self.rib_lines ^ other.rib_lines
    
    def __len__(self):
        """Restituisce il numero di rotte nel dump"""
        return len(self.rib_lines)
    
    def __str__(self):
        """Rappresentazione stringa"""
        return f"RibDump({len(self.rib_lines)} routes)"
    
    def get_prefixes(self) -> list[str]:
        """
        Restituisce la lista ordinata dei prefissi di rete
        
        Returns:
            list: Lista ordinata di prefissi
        """
        return sorted([str(rib_line) for rib_line in self.rib_lines])
    
    def get_summary(self) -> dict:
        """
        Restituisce un sommario del dump
        
        Returns:
            dict: Sommario con statistiche
        """
        prefixes = self.get_prefixes()
        return {
            'total_routes': len(self.rib_lines),
            'total_errors': len(self.errors),
            'sample_prefixes': prefixes[:10] if len(prefixes) > 10 else prefixes,
            'first_prefix': prefixes[0] if prefixes else None,
            'last_prefix': prefixes[-1] if prefixes else None
        }
