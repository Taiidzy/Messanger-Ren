from app.db.base import Base
from sqlalchemy import Column, Integer, String, Date, Text

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    login = Column(String(50), unique=True, index=True, nullable=False)
    userName = Column(String(100), nullable=True)
    password = Column(String(255), nullable=False)  # Хэш пароля
    publicKey = Column(Text, nullable=True)  # Публичный ключ пользователя (TEXT для больших данных)
    encryptedPrivateKeyByUser = Column(Text, nullable=True)  # Приватный ключ, зашифрованный мастер-ключом (TEXT)
    encryptedPrivateKeyByAccessKey = Column(Text, nullable=True)  # Приватный ключ, зашифрованный ключом доступа (TEXT)
    salt = Column(String(255), nullable=True)  # Соль для деривации ключа
    avatar = Column(String(255), nullable=True)
    created_at = Column(Date, nullable=False)
    
    def __repr__(self):
        return f"<User(login='{self.login}', userName='{self.userName}', publicKey='{self.publicKey})>" 