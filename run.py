from app import create_app
from flask import redirect, url_for

app = create_app()

# 添加主页重定向
@app.route('/')
def index():
    return redirect(url_for('auth.index'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 