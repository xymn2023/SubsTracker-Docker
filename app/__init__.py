import os
from flask import Flask
from flask_login import LoginManager
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

# 初始化Flask应用
def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default-secret-key')
    
    # 初始化登录管理器
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    
    # 确保数据目录存在
    data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    if not os.path.exists(data_path):
        os.makedirs(data_path)
    
    # 注册蓝图
    from app.routes.auth import auth_bp
    from app.routes.admin import admin_bp
    from app.routes.api import api_bp
    
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(api_bp, url_prefix='/api')
    
    # 用户加载器
    from app.models.user import User
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.get(user_id)
    
    # 设置定时任务检查即将到期的订阅
    from app.services.notification_service import check_expiring_subscriptions
    
    scheduler = BackgroundScheduler()
    scheduler.add_job(check_expiring_subscriptions, 'cron', hour=8, minute=0)  # 每天早上8点检查
    scheduler.start()
    
    return app 