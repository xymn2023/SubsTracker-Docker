from functools import wraps
from flask import session, redirect, url_for, request, jsonify

def auth_required(f):
    """验证用户是否已登录的装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('user_authenticated'):
            return redirect(url_for('auth.index'))
        return f(*args, **kwargs)
    return decorated_function

def auth_required_api(f):
    """API接口验证用户是否已登录的装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('user_authenticated'):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function 