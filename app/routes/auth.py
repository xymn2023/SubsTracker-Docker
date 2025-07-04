from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from flask_login import login_user, logout_user, login_required, current_user
from app.models.user import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/', methods=['GET'])
def index():
    """登录页面"""
    if current_user.is_authenticated or session.get('user_authenticated'):
        return redirect(url_for('admin.index'))
    return render_template('login.html')

@auth_bp.route('/login', methods=['POST'])
def login():
    """登录处理"""
    username = request.form.get('username')
    password = request.form.get('password')
    
    user = User.authenticate(username, password)
    
    if user:
        login_user(user, remember=True)
        session['user_authenticated'] = True
        return {"success": True}, 200
    else:
        return {"success": False, "message": "用户名或密码错误"}, 401

@auth_bp.route('/logout')
def logout():
    """注销"""
    logout_user()
    session.pop('user_authenticated', None)
    return redirect(url_for('auth.index')) 