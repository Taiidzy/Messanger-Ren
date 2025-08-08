import pytest
import secrets
import string
from unittest.mock import patch
from app import generate_access_key

class TestCryptoFunctions:
    
    def test_generate_access_key_length(self):
        """Тест длины генерируемого ключа доступа"""
        key = generate_access_key()
        assert len(key) == 8
        
        key_long = generate_access_key(12)
        assert len(key_long) == 12
    
    def test_generate_access_key_characters(self):
        """Тест символов в ключе доступа"""
        key = generate_access_key()
        valid_chars = string.ascii_uppercase + string.digits
        assert all(char in valid_chars for char in key)
    
    def test_generate_access_key_uniqueness(self):
        """Тест уникальности генерируемых ключей"""
        keys = set()
        for _ in range(100):
            key = generate_access_key()
            assert key not in keys
            keys.add(key)
    
    def test_generate_access_key_randomness(self):
        """Тест случайности генерируемых ключей"""
        # Генерируем много ключей и проверяем распределение символов
        all_chars = ""
        for _ in range(1000):
            all_chars += generate_access_key()
        
        # Проверяем, что используются разные символы
        unique_chars = set(all_chars)
        assert len(unique_chars) > 10  # Должно быть достаточно разнообразия
    
    @patch('secrets.choice')
    def test_generate_access_key_uses_secrets(self, mock_choice):
        """Тест использования модуля secrets для генерации"""
        mock_choice.return_value = 'A'
        generate_access_key()
        assert mock_choice.called
    
    def test_generate_access_key_edge_cases(self):
        """Тест граничных случаев"""
        # Тест с длиной 0
        with pytest.raises(ValueError):
            generate_access_key(0)
        
        # Тест с отрицательной длиной
        with pytest.raises(ValueError):
            generate_access_key(-1)
        
        # Тест с очень большой длиной
        key = generate_access_key(100)
        assert len(key) == 100 