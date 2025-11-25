from datetime import datetime, timedelta
import logging

class StatsCache:
    def __init__(self, ttl_seconds=5):
        self._cache = {}
        self.ttl = timedelta(seconds=ttl_seconds)
    
    def get(self, key):
        if key in self._cache:
            data, timestamp = self._cache[key]
            if datetime.now() - timestamp < self.ttl:
                logging.debug(f"Cache HIT for {key}")
                return data
            else:
                logging.debug(f"Cache EXPIRED for {key}")
                del self._cache[key]
        logging.debug(f"Cache MISS for {key}")
        return None
    
    def set(self, key, data):
        self._cache[key] = (data, datetime.now())
    
    def clear(self):
        self._cache.clear()
        logging.info("Cache cleared")

# Singleton
_stats_cache = StatsCache(ttl_seconds=5)

def get_stats_cache():
    return _stats_cache
