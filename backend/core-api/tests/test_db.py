import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../'))
from db.database import engine
from config.config import settings

# Тихая проверка подключения к базе данных

try:
    with engine.connect() as connection:
        result = connection.execute("SELECT version();")
        version = result.fetchone()[0]
        pass
except ImportError as e:
    raise
except Exception as e:
    raise