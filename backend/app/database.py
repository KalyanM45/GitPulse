from pymongo import MongoClient
from .config import MONGODB_URI, DB_NAME

_client: MongoClient = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI)
    return _client[DB_NAME]


def close_db():
    global _client
    if _client:
        _client.close()
        _client = None
