import os
import json
import uuid

def get_config_path():
    """获取配置文件路径"""
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    return os.path.join(data_dir, 'config.json')

def get_config():
    """获取配置"""
    config_path = get_config_path()

    if not os.path.exists(config_path):
        # 默认配置
        default_config = {
            'ADMIN_USERNAME': os.environ.get('ADMIN_USERNAME', 'admin'),
            'ADMIN_PASSWORD': os.environ.get('ADMIN_PASSWORD', 'password'),
            # Telegram 配置
            'TG_BOT_TOKEN': os.environ.get('TG_BOT_TOKEN', ''),
            'TG_CHAT_ID': os.environ.get('TG_CHAT_ID', ''),
            # 企业微信配置
            'WECOM_CORP_ID': os.environ.get('WECOM_CORP_ID', ''),
            'WECOM_AGENT_ID': os.environ.get('WECOM_AGENT_ID', ''),
            'WECOM_CORP_SECRET': os.environ.get('WECOM_CORP_SECRET', ''),
            # NotifyX配置
            'NOTIFYX_API_KEY': os.environ.get('NOTIFYX_API_KEY', ''),
            'NOTIFYX_TOKEN': os.environ.get('NOTIFYX_TOKEN', ''),
            'NOTIFYX_ENDPOINT': os.environ.get('NOTIFYX_ENDPOINT', ''),
            # 通知方式 (telegram, wecom, notifyx)
            'NOTIFICATION_TYPE': os.environ.get('NOTIFICATION_TYPE', 'telegram'),
            'SECRET_KEY': os.environ.get('SECRET_KEY', str(uuid.uuid4()))
        }

        # 保存默认配置
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, indent=4)

        return default_config

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"读取配置失败: {str(e)}")
        return {
            'ADMIN_USERNAME': os.environ.get('ADMIN_USERNAME', 'admin'),
            'ADMIN_PASSWORD': os.environ.get('ADMIN_PASSWORD', 'password'),
            'TG_BOT_TOKEN': '',
            'TG_CHAT_ID': '',
            'WECOM_CORP_ID': '',
            'WECOM_AGENT_ID': '',
            'WECOM_CORP_SECRET': '',
            'NOTIFYX_API_KEY': '',
            'NOTIFYX_TOKEN': '',
            'NOTIFYX_ENDPOINT': '',
            'NOTIFICATION_TYPE': 'telegram',
            'SECRET_KEY': os.environ.get('SECRET_KEY', 'fallback-secret-key')
        }

def update_config(new_config):
    """更新配置"""
    config_path = get_config_path()
    current_config = get_config()

    # 合并配置，但保持SECRET_KEY不变
    updated_config = {**current_config, **new_config}

    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(updated_config, f, indent=4)
        return True
    except Exception as e:
        print(f"保存配置失败: {str(e)}")
        return False

class ConfigService:
    """配置服务类，封装配置相关操作"""

    def get_config(self):
        """获取配置"""
        return get_config()

    def update_config(self, new_config):
        """更新配置"""
        return update_config(new_config) 
