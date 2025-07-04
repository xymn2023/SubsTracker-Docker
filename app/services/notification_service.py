import os
import json
import requests
import time
from datetime import datetime
from app.services.config_service import get_config
from app.services.subscription_service import get_all_subscriptions, update_subscription

def send_notification(message, custom_config=None):
    """根据配置选择通知方式发送通知"""
    try:
        config = custom_config or get_config()
        notification_type = config.get('NOTIFICATION_TYPE', 'telegram')

        if notification_type == 'telegram':
            return send_telegram_notification(message, config)
        elif notification_type == 'wecom':
            return send_wecom_notification(message, config)
        elif notification_type == 'notifyx':
            return send_notifyx_notification(message, config)
        else:
            error_msg = f"未知的通知类型: {notification_type}"
            print(f"[通知] {error_msg}")
            return False, error_msg
    except Exception as e:
        error_msg = f"发送通知失败: {str(e)}"
        print(f"[通知] {error_msg}")
        return False, error_msg

def send_telegram_notification(message, custom_config=None):
    """发送Telegram通知"""
    try:
        # 使用自定义配置或从配置文件获取
        config = custom_config or get_config()

        # 获取Telegram配置，优先使用TG_前缀的配置，如果不存在则尝试使用TELEGRAM_前缀的配置
        bot_token = config.get('TG_BOT_TOKEN') or config.get('TELEGRAM_BOT_TOKEN', '')
        chat_id = config.get('TG_CHAT_ID') or config.get('TELEGRAM_CHAT_ID', '')

        # 检查是否配置了Telegram通知
        if not bot_token or not chat_id:
            error_msg = "通知未配置，缺少Bot Token或Chat ID"
            print(f"[Telegram] {error_msg}")
            return False, error_msg

        print(f"[Telegram] 开始发送通知到 Chat ID: {chat_id}")

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "Markdown"
        }

        response = requests.post(url, json=payload)
        result = response.json()

        print(f"[Telegram] 发送结果: {result}")
        if result.get('ok', False):
            return True, ""
        else:
            error_msg = f"Telegram API错误: {result.get('description', '未知错误')}"
            return False, error_msg
    except Exception as e:
        error_msg = f"发送通知失败: {str(e)}"
        print(f"[Telegram] {error_msg}")
        return False, error_msg

def get_wecom_access_token(config):
    """获取企业微信访问令牌"""
    try:
        # 检查是否配置了企业微信
        if not config.get('WECOM_CORP_ID') or not config.get('WECOM_CORP_SECRET'):
            return None, "缺少 Corp ID 或 Corp Secret"

        # 构建企业微信API请求URL
        url = f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={config.get('WECOM_CORP_ID')}&corpsecret={config.get('WECOM_CORP_SECRET')}"

        response = requests.get(url)
        if not response.ok:
            return None, f"HTTP错误 {response.status_code}"

        data = response.json()
        if data.get('errcode') != 0:
            error_msg = f"错误码: {data.get('errcode')}, 错误信息: {data.get('errmsg')}"
            print(f"[企业微信] 获取token失败 - {error_msg}")
            return None, error_msg

        return data.get('access_token'), ""
    except Exception as e:
        error_msg = f"获取token失败: {str(e)}"
        print(f"[企业微信] {error_msg}")
        return None, error_msg

def send_wecom_notification(message, custom_config=None):
    """发送企业微信通知"""
    try:
        # 使用自定义配置或从配置文件获取
        config = custom_config or get_config()

        # 检查是否配置了企业微信
        if not config.get('WECOM_CORP_ID') or not config.get('WECOM_CORP_SECRET') or not config.get('WECOM_AGENT_ID'):
            error_msg = "通知未配置，缺少Corp ID、Corp Secret或Agent ID"
            print(f"[企业微信] {error_msg}")
            return False, error_msg

        print(f"[企业微信] 开始发送通知")

        # 获取访问令牌
        access_token, error = get_wecom_access_token(config)
        if not access_token:
            return False, f"获取企业微信访问令牌失败: {error}"

        # 构建消息数据
        url = f"https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token={access_token}"

        payload = {
            "touser": config.get('WECOM_TO_USER', '@all'),
            "msgtype": "text",
            "agentid": int(config.get('WECOM_AGENT_ID')),
            "text": {
                "content": message.replace('*', '').replace('\n\n', '\n')  # 移除Markdown格式，保留换行
            }
        }

        response = requests.post(url, json=payload)
        data = response.json()

        if data.get('errcode') != 0:
            error_msg = f"错误码: {data.get('errcode')}, 错误信息: {data.get('errmsg')}"
            print(f"[企业微信] 发送失败 - {error_msg}")
            return False, error_msg

        print(f"[企业微信] 发送成功 - msgid: {data.get('msgid')}")
        return True, ""
    except Exception as e:
        error_msg = f"发送通知失败: {str(e)}"
        print(f"[企业微信] {error_msg}")
        return False, error_msg

def send_notifyx_notification(message, custom_config=None):
    """发送NotifyX通知"""
    try:
        # 使用自定义配置或从配置文件获取
        config = custom_config or get_config()

        # 获取NotifyX配置，优先使用NOTIFYX_TOKEN，如果不存在则尝试使用NOTIFYX_API_KEY
        token = config.get('NOTIFYX_TOKEN') or config.get('NOTIFYX_API_KEY', '')

        # 检查是否配置了NotifyX
        if not token:
            error_msg = "通知未配置，缺少Token"
            print(f"[NotifyX] {error_msg}")
            return False, error_msg

        print(f"[NotifyX] 开始发送通知")

        # 从消息中提取标题和内容
        message_parts = message.split('\n\n', 1)
        title = message_parts[0].replace('*', '')
        content = message_parts[1] if len(message_parts) > 1 else "无内容"

        # 使用固定的NotifyX API地址，将token作为URL的一部分
        url = f"https://www.notifyx.cn/api/v1/send/{token}"
        payload = {
            "title": title,
            "content": content,
            "description": "订阅管理系统通知"
        }
        headers = {"Content-Type": "application/json"}

        response = requests.post(url, data=json.dumps(payload), headers=headers)
        data = response.json()

        print(f"[NotifyX] 发送结果: {data}")

        # 判断NotifyX返回结果
        # 如果status为queued，则表示成功
        if data.get('status') == 'queued':
            return True, ""
        else:
            error_msg = f"{data}"
            print(f"[NotifyX] 发送失败: {error_msg}")
            return False, error_msg
    except Exception as e:
        error_msg = f"发送通知失败: {str(e)}"
        print(f"[NotifyX] {error_msg}")
        return False, error_msg

def check_expiring_subscriptions():
    """检查即将到期的订阅并发送通知"""
    try:
        print(f"[定时任务] 开始检查即将到期的订阅: {datetime.now().isoformat()}")

        subscriptions = get_all_subscriptions()
        print(f"[定时任务] 共找到 {len(subscriptions)} 个订阅")

        config = get_config()
        now = datetime.now()
        expiring_subscriptions = []
        needs_update = []

        for subscription in subscriptions:
            # 跳过已停用的订阅
            if subscription.is_active is False:
                print(f"[定时任务] 订阅 \"{subscription.name}\" 已停用，跳过")
                continue

            expiry_date = datetime.fromisoformat(subscription.expiry_date.replace('Z', '+00:00')) if subscription.expiry_date else now
            days_diff = (expiry_date - now).days

            print(f"[定时任务] 订阅 \"{subscription.name}\" 到期日期: {expiry_date.isoformat()}, 剩余天数: {days_diff}")

            # 如果已过期，且设置了周期，则自动更新到下一个周期
            if days_diff < 0 and subscription.period_value and subscription.period_unit and subscription.recurring:
                print(f"[定时任务] 订阅 \"{subscription.name}\" 已过期，正在更新到下一个周期")

                # 计算新的到期日期
                subscription.expiry_date = subscription.calculate_expiry_date()
                needs_update.append(subscription)

                # 重新计算天数差
                expiry_date = datetime.fromisoformat(subscription.expiry_date.replace('Z', '+00:00'))
                days_diff = (expiry_date - now).days

                print(f"[定时任务] 订阅 \"{subscription.name}\" 更新到期日期: {expiry_date.isoformat()}, 新剩余天数: {days_diff}")

                # 如果新的到期日期在提醒范围内，添加到提醒列表
                if days_diff <= subscription.reminder_days:
                    print(f"[定时任务] 订阅 \"{subscription.name}\" 在提醒范围内，将发送通知")
                    expiring_subscriptions.append({
                        "subscription": subscription,
                        "days_remaining": days_diff
                    })
            elif days_diff <= subscription.reminder_days and days_diff >= 0:
                # 如果在提醒范围内且未过期，正常添加到提醒列表
                print(f"[定时任务] 订阅 \"{subscription.name}\" 在提醒范围内，将发送通知")
                expiring_subscriptions.append({
                    "subscription": subscription,
                    "days_remaining": days_diff
                })

        # 更新需要更新的订阅
        if needs_update:
            print(f"[定时任务] 有 {len(needs_update)} 个订阅需要更新到下一个周期")
            for subscription in needs_update:
                update_subscription(subscription.id, subscription.to_dict())
                print(f"[定时任务] 已更新订阅 \"{subscription.name}\" 到下一个周期")

        # 发送通知
        if expiring_subscriptions:
            print(f"[定时任务] 有 {len(expiring_subscriptions)} 个订阅需要发送通知")

            message = '*订阅到期提醒*\n\n'

            for item in expiring_subscriptions:
                subscription = item["subscription"]
                days_remaining = item["days_remaining"]

                # 使用自定义类型
                type_text = subscription.custom_type or '其他'

                # 周期信息
                unit_map = {"day": "天", "month": "月", "year": "年"}
                period_text = f"{subscription.period_value} {unit_map.get(subscription.period_unit, subscription.period_unit)}" if subscription.period_value and subscription.period_unit else ""
                period_info = f"(周期: {period_text})" if period_text else ""

                # 金额信息
                amount_text = f"￥{subscription.amount}" if subscription.amount > 0 else ""
                amount_info = f"💰 {amount_text}" if amount_text else ""

                if days_remaining == 0:
                    message += f"⚠️ *{subscription.name}* ({type_text}) {period_info} 今天到期！ {amount_info}\n"
                else:
                    message += f"📅 *{subscription.name}* ({type_text}) {period_info} 将在 {days_remaining} 天后到期 {amount_info}\n"

                if subscription.notes:
                    message += f"备注: {subscription.notes}\n"

                message += '\n'

            success, error = send_notification(message, config)
            if success:
                print(f"[定时任务] 发送通知 成功")
            else:
                print(f"[定时任务] 发送通知 失败: {error}")
        else:
            print(f"[定时任务] 没有需要提醒的订阅")

        print('[定时任务] 检查完成')
        return True
    except Exception as e:
        print(f"[定时任务] 检查即将到期的订阅失败: {str(e)}")
        return False

# 在文件末尾添加NotificationService类
class NotificationService:
    """通知服务类，封装通知相关操作"""

    def send_notification(self, message, custom_config=None):
        """发送通知"""
        return send_notification(message, custom_config)

    def send_telegram_notification(self, message, custom_config=None):
        """发送Telegram通知"""
        return send_telegram_notification(message, custom_config)

    def send_wecom_notification(self, message, custom_config=None):
        """发送企业微信通知"""
        return send_wecom_notification(message, custom_config)

    def send_notifyx_notification(self, message, custom_config=None):
        """发送NotifyX通知"""
        return send_notifyx_notification(message, custom_config)

    def check_expiring_subscriptions(self):
        """检查即将到期的订阅"""
        return check_expiring_subscriptions() 
