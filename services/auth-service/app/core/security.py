import bcrypt
from jose import jwt
from datetime import datetime, timedelta

from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # hashed_password is stored as a string in DB; bcrypt expects bytes
    if hashed_password is None:
        return False
    hashed = hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed)

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
def generate_access_key(length: int = 8) -> str:
    import secrets
    import string

    if length <= 0:
        raise ValueError("Длина ключа должна быть положительным числом")
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))