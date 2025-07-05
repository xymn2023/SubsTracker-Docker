from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required
from app.services.config_service import get_config, update_config
from app.services.subscription_service import (
    get_all_subscriptions, get_subscription, create_subscription, 
    update_subscription, delete_subscription, toggle_subscription_status,
    get_subscription_statistics
)
from app.services.notification_service import (
    send_notification, send_telegram_notification, 
    send_wecom_notification, send_notifyx_notification
)
import datetime
import uuid
from datetime import timedelta
import json
import os

from app.services.subscription_service import SubscriptionService
from app.services.config_service import ConfigService
from app.services.notification_service import NotificationService
from app.services.auth_service import auth_required_api

api_bp = Blueprint('api', __name__)

# 订阅模板数据
SUBSCRIPTION_TEMPLATES = [
    {
        "name": "Netflix 标准套餐",
        "description": "在线流媒体视频服务",
        "amount": 89.90,
        "period_value": 1,
        "period_unit": "month"
    },
    {
        "name": "Spotify 会员",
        "description": "高品质音乐串流服务",
        "amount": 18.00,
        "period_value": 1,
        "period_unit": "month"
    },
    {
        "name": "Apple Music",
        "description": "苹果音乐服务",
        "amount": 11.00,
        "period_value": 1,
        "period_unit": "month"
    },
    {
        "name": "哔哩哔哩大会员",
        "description": "视频弹幕网站会员",
        "amount": 148.00,
        "period_value": 1,
        "period_unit": "year"
    },
    {
        "name": "爱奇艺VIP",
        "description": "在线视频平台会员",
        "amount": 19.80,
        "period_value": 1,
        "period_unit": "month"
    },
    {
        "name": "腾讯视频VIP",
        "description": "在线视频平台会员",
        "amount": 20.00,
        "period_value": 1,
        "period_unit": "month"
    },
    {
        "name": "网易云音乐黑胶VIP",
        "description": "音乐平台会员",
        "amount": 198.00,
        "period_value": 1,
        "period_unit": "year"
    },
    {
        "name": "微软Office 365",
        "description": "微软办公软件套装",
        "amount": 498.00,
        "period_value": 1,
        "period_unit": "year"
    },
    {
        "name": "Adobe Creative Cloud",
        "description": "创意软件订阅",
        "amount": 888.00,
        "period_value": 1,
        "period_unit": "year"
    },
    {
        "name": "GitHub Pro",
        "description": "软件开发平台高级账户",
        "amount": 49.00,
        "period_value": 1,
        "period_unit": "month"
    },
    {
        "name": "JetBrains 全家桶",
        "description": "开发工具套件",
        "amount": 649.00,
        "period_value": 1,
        "period_unit": "year"
    }
]

# 配置API
@api_bp.route('/config', methods=['GET'])
@login_required
def get_config_api():
    """获取配置"""
    config = get_config()
    # 不返回敏感信息
    if 'SECRET_KEY' in config:
        del config['SECRET_KEY']
    return jsonify(config)

@api_bp.route('/config', methods=['POST'])
@login_required
def update_config_api():
    """更新配置"""
    new_config = request.json
    success = update_config(new_config)

    if success:
        return jsonify({"success": True}), 200
    else:
        return jsonify({"success": False, "message": "更新配置失败"}), 400

# 订阅API
@api_bp.route('/subscriptions', methods=['GET'])
@login_required
def get_subscriptions():
    """获取所有订阅"""
    subscriptions = get_all_subscriptions()
    return jsonify([s.to_dict() for s in subscriptions])

@api_bp.route('/subscriptions/<subscription_id>', methods=['GET'])
@login_required
def get_subscription_by_id(subscription_id):
    """获取单个订阅"""
    subscription = get_subscription(subscription_id)

    if subscription:
        return jsonify(subscription.to_dict())
    else:
        return jsonify({"message": "订阅不存在"}), 404

@api_bp.route('/subscriptions', methods=['POST'])
@login_required
def create_subscription_api():
    """创建新订阅"""
    result = create_subscription(request.json)

    if result["success"]:
        return jsonify(result), 201
    else:
        return jsonify(result), 400

@api_bp.route('/subscriptions/<subscription_id>', methods=['PUT'])
@login_required
def update_subscription_api(subscription_id):
    """更新订阅"""
    result = update_subscription(subscription_id, request.json)

    if result["success"]:
        return jsonify(result), 200
    else:
        return jsonify(result), 400

@api_bp.route('/subscriptions/<subscription_id>', methods=['DELETE'])
@login_required
def delete_subscription_api(subscription_id):
    """删除订阅"""
    result = delete_subscription(subscription_id)

    if result["success"]:
        return jsonify(result), 200
    else:
        return jsonify(result), 400

@api_bp.route('/subscriptions/<subscription_id>/toggle-status', methods=['POST'])
@login_required
def toggle_subscription_status_api(subscription_id):
    """切换订阅状态"""
    is_active = request.json.get('is_active', False)
    result = toggle_subscription_status(subscription_id, is_active)

    if result["success"]:
        return jsonify(result), 200
    else:
        return jsonify(result), 400

# 通知相关API
@api_bp.route('/test-notification', methods=['POST'])
@login_required
def test_notification():
    """测试通知"""
    notification_type = request.json.get('notification_type', None)
    message = '*测试通知*\n\n这是一条测试通知，用于验证通知功能是否正常工作。\n\n发送时间: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # 如果指定了通知类型，创建临时配置
    config = None
    if notification_type:
        config = get_config()
        config['NOTIFICATION_TYPE'] = notification_type

    try:
        success, error_msg = send_notification(message, config)

        # 在控制台输出更详细的错误信息
        if not success:
            print(f"测试通知详细错误: {error_msg}")
        
        return jsonify({
            "success": success,
            "message": "通知发送成功" if success else f"通知发送失败: {error_msg}"
        })
    except Exception as e:
        print(f"测试通知出错: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"通知发送失败: {str(e)}"
        })

@api_bp.route('/test-telegram', methods=['POST'])
@login_required
def test_telegram():
    """测试Telegram配置"""
    test_config = {
        'TG_BOT_TOKEN': request.json.get('TG_BOT_TOKEN'),
        'TG_CHAT_ID': request.json.get('TG_CHAT_ID')
    }

    if not test_config['TG_BOT_TOKEN'] or not test_config['TG_CHAT_ID']:
        return jsonify({
            "success": False,
            "message": "Telegram配置不完整"
        })

    message = '*Telegram配置测试*\n\n这是一条测试消息，如果您收到这条消息，说明Telegram配置正确。\n\n发送时间: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    success = send_telegram_notification(message, test_config)

    return jsonify({
        "success": success,
        "message": "Telegram配置测试成功" if success else "Telegram配置测试失败，请检查Bot Token和Chat ID"
    })

@api_bp.route('/test-wecom', methods=['POST'])
@login_required
def test_wecom():
    """测试企业微信配置"""
    test_config = {
        'WECOM_CORP_ID': request.json.get('WECOM_CORP_ID'),
        'WECOM_CORP_SECRET': request.json.get('WECOM_CORP_SECRET'),
        'WECOM_AGENT_ID': request.json.get('WECOM_AGENT_ID')
    }

    if not test_config['WECOM_CORP_ID'] or not test_config['WECOM_CORP_SECRET'] or not test_config['WECOM_AGENT_ID']:
        return jsonify({
            "success": False,
            "message": "企业微信配置不完整"
        })

    message = '*企业微信配置测试*\n\n这是一条测试消息，如果您收到这条消息，说明企业微信配置正确。\n\n发送时间: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    success, error_msg = send_wecom_notification(message, test_config)
    
    # 在控制台输出更详细的错误信息
    if not success:
        print(f"企业微信测试详细错误: {error_msg}")

    return jsonify({
        "success": success,
        "message": "企业微信配置测试成功" if success else f"企业微信配置测试失败: {error_msg}"
    })

@api_bp.route('/test-notifyx', methods=['POST'])
@login_required
def test_notifyx():
    """测试NotifyX配置"""
    test_config = {
        'NOTIFYX_TOKEN': request.json.get('NOTIFYX_TOKEN')
    }

    if not test_config['NOTIFYX_TOKEN']:
        return jsonify({
            "success": False,
            "message": "NotifyX配置不完整，请提供Token"
        })

    message = '*NotifyX配置测试*\n\n这是一条测试消息，如果您收到这条消息，说明NotifyX配置正确。\n\n发送时间: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    success = send_notifyx_notification(message, test_config)

    return jsonify({
        "success": success,
        "message": "NotifyX配置测试成功" if success else "NotifyX配置测试失败，请检查API密钥"
    })

# 统计数据API
@api_bp.route('/statistics', methods=['GET'])
@login_required
def get_statistics():
    """获取统计数据"""
    stats = get_subscription_statistics()
    return jsonify(stats)

@api_bp.route('/subscription-templates', methods=['GET'])
@auth_required_api
def get_subscription_templates():
    """获取订阅模板列表"""
    return jsonify(SUBSCRIPTION_TEMPLATES)

@api_bp.route('/test-subscription', methods=['POST'])
@login_required
def test_subscription_api():
    """测试订阅配置"""
    try:
        subscription_data = request.json
        if not subscription_data:
            return jsonify({
                "success": False,
                "message": "请提供订阅数据"
            }), 400
        
        # 导入测试函数
        from app.services.subscription_service import test_subscription
        
        # 执行测试
        result = test_subscription(subscription_data)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"测试订阅失败: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"测试订阅失败: {str(e)}"
        }), 500

@api_bp.route('/test-subscription-notify/<subscription_id>', methods=['POST'])
@login_required
def test_subscription_notify(subscription_id):
    from app.services.subscription_service import get_subscription
    from app.services.notification_service import send_notification

    subscription = get_subscription(subscription_id)
    if not subscription:
        return jsonify({"success": False, "message": "订阅不存在"}), 404

    # 组装推送内容
    message = f"""*订阅推送测试*\n\n名称：{subscription.name}\n到期日：{subscription.expiry_date}\n金额：¥{subscription.amount}\n\n本消息用于测试订阅推送功能。"""
    success, error_msg = send_notification(message)
    return jsonify({
        "success": success,
        "message": "推送成功" if success else f"推送失败: {error_msg}"
    })
