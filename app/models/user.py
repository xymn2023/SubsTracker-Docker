import os
import json
import hashlib
from flask_login import UserMixin

class User(UserMixin):
    def __init__(self, id, username, password_hash):
        self.id = id
        self.username = username
        self.password_hash = password_hash
    
    @staticmethod
    def get(user_id):
        from app.services.config_service import get_config
        config = get_config()
        
        if user_id == '1' and config.get('ADMIN_USERNAME'):
            return User(
                id='1',
                username=config.get('ADMIN_USERNAME'),
                password_hash=config.get('ADMIN_PASSWORD')
            )
        return None
    
    @staticmethod
    def authenticate(username, password):
        from app.services.config_service import get_config
        config = get_config()
        
        if username == config.get('ADMIN_USERNAME'):
            # 简单密码比较，实际使用中应该使用安全的密码哈希
            if password == config.get('ADMIN_PASSWORD'):
                return User(
                    id='1',
                    username=config.get('ADMIN_USERNAME'),
                    password_hash=config.get('ADMIN_PASSWORD')
                )
        return None 