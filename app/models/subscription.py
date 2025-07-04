import os
import json
import time
from datetime import datetime, timedelta
import uuid

class Subscription:
    def __init__(self, id=None, name=None, custom_type=None, notes=None, 
                 start_date=None, expiry_date=None, period_value=None, 
                 period_unit=None, reminder_days=None, is_active=True, 
                 amount=None, payment_method=None, recurring=True,
                 created_at=None, updated_at=None):
        self.id = id or str(uuid.uuid4())
        self.name = name
        self.custom_type = custom_type or ""
        self.notes = notes or ""
        self.start_date = start_date
        self.expiry_date = expiry_date
        self.period_value = period_value or 1
        self.period_unit = period_unit or "month"
        self.reminder_days = reminder_days or 7
        self.is_active = is_active if is_active is not None else True
        self.amount = amount or 0.0  # 新增费用字段
        self.payment_method = payment_method or ""  # 新增支付方式字段
        self.recurring = recurring if recurring is not None else True  # 是否重复订阅
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "custom_type": self.custom_type,
            "notes": self.notes,
            "start_date": self.start_date,
            "expiry_date": self.expiry_date,
            "period_value": self.period_value,
            "period_unit": self.period_unit,
            "reminder_days": self.reminder_days,
            "is_active": self.is_active,
            "amount": self.amount,
            "payment_method": self.payment_method,
            "recurring": self.recurring,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id"),
            name=data.get("name"),
            custom_type=data.get("custom_type"),
            notes=data.get("notes"),
            start_date=data.get("start_date"),
            expiry_date=data.get("expiry_date"),
            period_value=data.get("period_value"),
            period_unit=data.get("period_unit"),
            reminder_days=data.get("reminder_days"),
            is_active=data.get("is_active"),
            amount=data.get("amount"),
            payment_method=data.get("payment_method"),
            recurring=data.get("recurring"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at")
        )

    def calculate_expiry_date(self):
        """基于开始日期和周期计算到期日期"""
        if not self.start_date:
            return None
        
        start_date = datetime.fromisoformat(self.start_date.replace('Z', '+00:00'))
        expiry_date = start_date
        
        if self.period_unit == "day":
            expiry_date = start_date + timedelta(days=self.period_value)
        elif self.period_unit == "month":
            # 月份添加逻辑
            month = start_date.month - 1 + self.period_value
            year = start_date.year + month // 12
            month = month % 12 + 1
            day = min(start_date.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month-1])
            expiry_date = datetime(year, month, day)
        elif self.period_unit == "year":
            expiry_date = datetime(start_date.year + self.period_value, start_date.month, min(start_date.day, 29 if (start_date.year + self.period_value) % 4 == 0 and ((start_date.year + self.period_value) % 100 != 0 or (start_date.year + self.period_value) % 400 == 0) and start_date.month == 2 else [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][start_date.month-1]))
        
        # 如果计算出的到期日期已过期，则更新为下一个周期
        now = datetime.now()
        while expiry_date < now and self.recurring:
            if self.period_unit == "day":
                expiry_date = expiry_date + timedelta(days=self.period_value)
            elif self.period_unit == "month":
                month = expiry_date.month - 1 + self.period_value
                year = expiry_date.year + month // 12
                month = month % 12 + 1
                day = min(expiry_date.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month-1])
                expiry_date = datetime(year, month, day)
            elif self.period_unit == "year":
                expiry_date = datetime(expiry_date.year + self.period_value, expiry_date.month, min(expiry_date.day, 29 if (expiry_date.year + self.period_value) % 4 == 0 and ((expiry_date.year + self.period_value) % 100 != 0 or (expiry_date.year + self.period_value) % 400 == 0) and expiry_date.month == 2 else [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][expiry_date.month-1]))
        
        return expiry_date.isoformat()
    
    def days_remaining(self):
        """计算剩余天数"""
        if not self.expiry_date:
            return 0
        
        expiry_date = datetime.fromisoformat(self.expiry_date.replace('Z', '+00:00'))
        now = datetime.now()
        return (expiry_date - now).days 