import os
import json
from datetime import datetime
from app.models.subscription import Subscription

def get_subscriptions_path():
    """获取订阅数据文件路径"""
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data')
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    return os.path.join(data_dir, 'subscriptions.json')

def get_all_subscriptions():
    """获取所有订阅"""
    file_path = get_subscriptions_path()
    
    if not os.path.exists(file_path):
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            subscriptions = [Subscription.from_dict(item) for item in data]
            return subscriptions
    except Exception as e:
        print(f"读取订阅失败: {str(e)}")
        return []

def get_subscription(subscription_id):
    """获取单个订阅"""
    subscriptions = get_all_subscriptions()
    for subscription in subscriptions:
        if subscription.id == subscription_id:
            return subscription
    return None

def create_subscription(subscription_data):
    """创建新订阅"""
    try:
        # 验证必填字段
        if not subscription_data.get('name'):
            return {"success": False, "message": "名称不能为空"}
        
        # 创建新订阅对象
        subscription = Subscription(
            name=subscription_data.get('name'),
            custom_type=subscription_data.get('custom_type'),
            notes=subscription_data.get('notes'),
            start_date=subscription_data.get('start_date'),
            period_value=int(subscription_data.get('period_value', 1)),
            period_unit=subscription_data.get('period_unit', 'month'),
            reminder_days=int(subscription_data.get('reminder_days', 7)),
            is_active=subscription_data.get('is_active') if subscription_data.get('is_active') is not None else True,
            amount=float(subscription_data.get('amount', 0.0)),
            payment_method=subscription_data.get('payment_method', ''),
            recurring=subscription_data.get('recurring') if subscription_data.get('recurring') is not None else True
        )
        
        # 计算到期日期
        if subscription.start_date:
            subscription.expiry_date = subscription.calculate_expiry_date()
        else:
            return {"success": False, "message": "开始日期不能为空"}
        
        # 获取现有订阅并添加新订阅
        subscriptions = get_all_subscriptions()
        subscriptions.append(subscription)
        
        # 保存到文件
        save_subscriptions(subscriptions)
        
        return {"success": True, "subscription": subscription.to_dict()}
    except Exception as e:
        print(f"创建订阅失败: {str(e)}")
        return {"success": False, "message": f"创建订阅失败: {str(e)}"}

def update_subscription(subscription_id, subscription_data):
    """更新订阅"""
    try:
        subscriptions = get_all_subscriptions()
        
        # 查找要更新的订阅
        for i, subscription in enumerate(subscriptions):
            if subscription.id == subscription_id:
                # 验证必填字段
                if not subscription_data.get('name'):
                    return {"success": False, "message": "名称不能为空"}
                
                # 更新字段
                subscription.name = subscription_data.get('name')
                subscription.custom_type = subscription_data.get('custom_type', subscription.custom_type)
                subscription.notes = subscription_data.get('notes', subscription.notes)
                subscription.start_date = subscription_data.get('start_date', subscription.start_date)
                
                if 'period_value' in subscription_data:
                    subscription.period_value = int(subscription_data.get('period_value'))
                
                if 'period_unit' in subscription_data:
                    subscription.period_unit = subscription_data.get('period_unit')
                
                if 'reminder_days' in subscription_data:
                    subscription.reminder_days = int(subscription_data.get('reminder_days'))
                
                if 'is_active' in subscription_data:
                    subscription.is_active = subscription_data.get('is_active')
                
                if 'amount' in subscription_data:
                    subscription.amount = float(subscription_data.get('amount'))
                
                if 'payment_method' in subscription_data:
                    subscription.payment_method = subscription_data.get('payment_method')
                
                if 'recurring' in subscription_data:
                    subscription.recurring = subscription_data.get('recurring')
                
                # 计算到期日期
                if subscription.start_date:
                    subscription.expiry_date = subscription.calculate_expiry_date()
                
                subscription.updated_at = datetime.now().isoformat()
                
                # 保存到文件
                save_subscriptions(subscriptions)
                
                return {"success": True, "subscription": subscription.to_dict()}
        
        return {"success": False, "message": "订阅不存在"}
    except Exception as e:
        print(f"更新订阅失败: {str(e)}")
        return {"success": False, "message": f"更新订阅失败: {str(e)}"}

def delete_subscription(subscription_id):
    """删除订阅"""
    try:
        subscriptions = get_all_subscriptions()
        new_subscriptions = [s for s in subscriptions if s.id != subscription_id]
        
        if len(new_subscriptions) == len(subscriptions):
            return {"success": False, "message": "订阅不存在"}
        
        # 保存到文件
        save_subscriptions(new_subscriptions)
        
        return {"success": True}
    except Exception as e:
        print(f"删除订阅失败: {str(e)}")
        return {"success": False, "message": f"删除订阅失败: {str(e)}"}

def toggle_subscription_status(subscription_id, is_active):
    """切换订阅状态"""
    try:
        subscriptions = get_all_subscriptions()
        
        for subscription in subscriptions:
            if subscription.id == subscription_id:
                subscription.is_active = is_active
                subscription.updated_at = datetime.now().isoformat()
                
                # 保存到文件
                save_subscriptions(subscriptions)
                
                return {"success": True, "subscription": subscription.to_dict()}
        
        return {"success": False, "message": "订阅不存在"}
    except Exception as e:
        print(f"更新订阅状态失败: {str(e)}")
        return {"success": False, "message": f"更新订阅状态失败: {str(e)}"}

def save_subscriptions(subscriptions):
    """保存订阅数据到文件"""
    file_path = get_subscriptions_path()
    
    try:
        subscription_dicts = [s.to_dict() for s in subscriptions]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(subscription_dicts, f, ensure_ascii=False, indent=4)
        
        return True
    except Exception as e:
        print(f"保存订阅失败: {str(e)}")
        return False

def get_subscription_statistics():
    """获取订阅统计信息（用于图表显示）"""
    subscriptions = get_all_subscriptions()
    
    # 类型统计
    type_stats = {}
    for subscription in subscriptions:
        type_name = subscription.custom_type or "其他"
        if type_name in type_stats:
            type_stats[type_name]["count"] += 1
            type_stats[type_name]["amount"] += subscription.amount
        else:
            type_stats[type_name] = {"count": 1, "amount": subscription.amount}
    
    # 按月费用统计
    monthly_stats = {}
    for subscription in subscriptions:
        if not subscription.is_active:
            continue
            
        # 将年付转换为月付
        monthly_amount = subscription.amount
        if subscription.period_unit == "year":
            monthly_amount = subscription.amount / 12
        elif subscription.period_unit == "day":
            monthly_amount = subscription.amount * 30  # 假设每月30天
            
        type_name = subscription.custom_type or "其他"
        if type_name in monthly_stats:
            monthly_stats[type_name] += monthly_amount
        else:
            monthly_stats[type_name] = monthly_amount
    
    # 付款方式统计
    payment_stats = {}
    for subscription in subscriptions:
        payment_method = subscription.payment_method or "未指定"
        if payment_method in payment_stats:
            payment_stats[payment_method] += 1
        else:
            payment_stats[payment_method] = 1
    
    # 到期时间统计
    expiry_stats = {"soon": 0, "normal": 0, "expired": 0}
    for subscription in subscriptions:
        if not subscription.is_active:
            continue
            
        days_remaining = subscription.days_remaining()
        if days_remaining < 0:
            expiry_stats["expired"] += 1
        elif days_remaining <= subscription.reminder_days:
            expiry_stats["soon"] += 1
        else:
            expiry_stats["normal"] += 1
    
    # 计算总花费
    total_amount = sum(subscription.amount for subscription in subscriptions if subscription.is_active)
    active_count = sum(1 for subscription in subscriptions if subscription.is_active)
    
    return {
        "type_stats": type_stats,
        "monthly_stats": monthly_stats,
        "payment_stats": payment_stats,
        "expiry_stats": expiry_stats,
        "total_amount": total_amount,
        "total_count": len(subscriptions),
        "active_count": active_count
    }

# 添加SubscriptionService类，包装现有功能
class SubscriptionService:
    """订阅服务类，封装订阅相关操作"""
    
    def get_all_subscriptions(self):
        """获取所有订阅"""
        subscriptions = get_all_subscriptions()
        return [sub.to_dict() for sub in subscriptions]
    
    def get_subscription(self, subscription_id):
        """获取单个订阅"""
        subscription = get_subscription(subscription_id)
        return subscription.to_dict() if subscription else None
    
    def create_subscription(self, subscription_data):
        """创建新订阅"""
        return create_subscription(subscription_data)
    
    def update_subscription(self, subscription_id, subscription_data):
        """更新订阅"""
        return update_subscription(subscription_id, subscription_data)
    
    def delete_subscription(self, subscription_id):
        """删除订阅"""
        return delete_subscription(subscription_id)
    
    def toggle_subscription_status(self, subscription_id, is_active):
        """切换订阅状态"""
        return toggle_subscription_status(subscription_id, is_active)
    
    def get_subscription_statistics(self):
        """获取订阅统计信息"""
        return get_subscription_statistics() 