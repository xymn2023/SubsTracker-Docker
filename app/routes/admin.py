from flask import Blueprint, render_template, redirect, url_for, session, request, jsonify
from datetime import datetime, timedelta
import calendar
import random

from app.services.subscription_service import SubscriptionService
from app.services.auth_service import auth_required

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/')
@auth_required
def index():
    subscription_service = SubscriptionService()
    subscriptions = subscription_service.get_all_subscriptions()

    # 计算每个订阅的剩余天数
    for sub in subscriptions:
        # 修复ISO格式日期解析
        expiry_date_str = sub['expiry_date']
        # 移除可能存在的时间部分
        if 'T' in expiry_date_str:
            expiry_date_str = expiry_date_str.split('T')[0]
            # 格式化日期，移除T字符
            sub['expiry_date'] = expiry_date_str
        expiry_date = datetime.strptime(expiry_date_str, '%Y-%m-%d')
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        delta = expiry_date - today
        sub['days_left'] = delta.days

        # 添加周期单位标签
        period_unit_map = {
            'day': '天',
            'week': '周',
            'month': '月',
            'year': '年'
        }
        sub['period_unit_label'] = f"{sub['period_value']} {period_unit_map.get(sub['period_unit'], sub['period_unit'])}"

    return render_template('admin/index.html', subscriptions=subscriptions)

@admin_bp.route('/dashboard')
@auth_required
def dashboard():
    subscription_service = SubscriptionService()
    subscriptions = subscription_service.get_all_subscriptions()

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # 基本统计数据
    stats = {
        'total_count': len(subscriptions),
        'active_count': 0,
        'expiring_soon_count': 0,
        'expiring_soon': [],
        'monthly_cost': 0,
        'yearly_cost': 0
    }

    # 周期分布数据
    period_data = []
    period_costs = {
        'day': 0,
        'week': 0,
        'month': 0,
        'year': 0,
        'other': 0
    }

    # 状态分布数据
    status_data = [
        {'label': '活跃', 'value': 0},
        {'label': '即将到期', 'value': 0},
        {'label': '已过期', 'value': 0}
    ]

    # 计算月度支出趋势（未来12个月）
    trend_data = {'labels': [], 'values': []}
    monthly_expenses = {}

    # 初始化未来12个月的数据
    current_month = today.month
    current_year = today.year

    for i in range(12):
        month_idx = (current_month + i - 1) % 12 + 1
        year = current_year + (current_month + i - 1) // 12
        month_name = f"{year}-{month_idx:02d}"
        trend_data['labels'].append(month_name)
        monthly_expenses[month_name] = 0

    # 计算每个订阅的统计数据
    for sub in subscriptions:
        # 解析日期，处理ISO格式
        expiry_date_str = sub['expiry_date']
        # 移除可能存在的时间部分
        if 'T' in expiry_date_str:
            expiry_date_str = expiry_date_str.split('T')[0]
            # 格式化日期，移除T字符
            sub['expiry_date'] = expiry_date_str
        expiry_date = datetime.strptime(expiry_date_str, '%Y-%m-%d')
        delta = expiry_date - today
        days_left = delta.days

        # 计算价格数据
        price = float(sub['amount'])
        period_value = int(sub['period_value'])
        period_unit = sub['period_unit']

        # 月度和年度费用计算
        monthly_price = 0
        if period_unit == 'day':
            monthly_price = (price / period_value) * 30
        elif period_unit == 'week':
            monthly_price = (price / period_value) * 4.33
        elif period_unit == 'month':
            monthly_price = price / period_value
        elif period_unit == 'year':
            monthly_price = price / (period_value * 12)

        stats['monthly_cost'] += monthly_price
        stats['yearly_cost'] += monthly_price * 12

        # 按周期统计费用
        if period_unit in period_costs:
            period_costs[period_unit] += price
        else:
            period_costs['other'] += price

        # 活跃订阅计数
        if days_left >= 0:
            stats['active_count'] += 1

            # 计算状态分布
            if days_left <= 7:
                status_data[1]['value'] += 1
                stats['expiring_soon_count'] += 1
                stats['expiring_soon'].append({
                    'id': sub['id'],
                    'name': sub['name'],
                    'description': sub.get('description', ''),
                    'expiry_date': sub['expiry_date'],
                    'days_left': days_left
                })
            else:
                status_data[0]['value'] += 1

            # 计算月度支出趋势
            next_payment_date = expiry_date
            for i in range(12):
                month_date = today + timedelta(days=30 * i)
                month_name = f"{month_date.year}-{month_date.month:02d}"

                # 检查该月是否有付款
                if period_unit == 'month' and period_value == 1:
                    # 每月订阅
                    monthly_expenses[month_name] += price
                elif period_unit == 'year' and period_value == 1:
                    # 年度订阅，只在到期月计算
                    if next_payment_date.year == month_date.year and next_payment_date.month == month_date.month:
                        monthly_expenses[month_name] += price
                elif period_unit == 'day' or period_unit == 'week':
                    # 按比例分配到每个月
                    days_in_month = calendar.monthrange(month_date.year, month_date.month)[1]
                    if period_unit == 'day':
                        payments_in_month = days_in_month / period_value
                        monthly_expenses[month_name] += price * payments_in_month
                    else:  # week
                        payments_in_month = days_in_month / (7 * period_value)
                        monthly_expenses[month_name] += price * payments_in_month
        else:
            # 已过期订阅
            status_data[2]['value'] += 1

    # 格式化费用数据
    stats['monthly_cost'] = round(stats['monthly_cost'], 2)
    stats['yearly_cost'] = round(stats['yearly_cost'], 2)

    # 整理周期费用数据为图表格式
    period_labels = {
        'day': '每日订阅',
        'week': '每周订阅',
        'month': '每月订阅',
        'year': '每年订阅',
        'other': '其他周期'
    }

    for unit, cost in period_costs.items():
        if cost > 0:
            period_data.append({
                'label': period_labels[unit],
                'value': round(cost, 2)
            })

    # 整理趋势数据
    trend_data['values'] = [round(monthly_expenses[label], 2) for label in trend_data['labels']]

    # 添加额外的统计数据
    stats['period_data'] = period_data
    stats['status_data'] = status_data
    stats['trend_data'] = trend_data

    return render_template('admin/dashboard.html', stats=stats)

@admin_bp.route('/config')
@auth_required
def config():
    return render_template('admin/config.html')

@admin_bp.route('/logout')
def logout():
    session.pop('user_authenticated', None)
    return redirect(url_for('auth.index')) 
