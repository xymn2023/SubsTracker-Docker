// 数据库初始化与操作模块
// 管理SQLite数据库连接和表结构

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    // 初始化数据库连接和表结构
    async init() {
        return new Promise((resolve, reject) => {
            // 确保数据库目录存在
            const dbDir = path.dirname(this.dbPath);
            const fs = require('fs');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            // 创建数据库连接
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('数据库连接失败:', err.message);
                    reject(err);
                    return;
                }
                console.log('SQLite数据库连接成功');

                // 创建configurations表
                this.createTables()
                    .then(() => resolve())
                    .catch(reject);
            });
        });
    }

    // 创建数据表
    async createTables() {
        return new Promise((resolve, reject) => {
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS configurations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    corpid TEXT NOT NULL,
                    encrypted_corpsecret TEXT NOT NULL,
                    agentid INTEGER NOT NULL,
                    touser TEXT NOT NULL,
                    description TEXT,
                    callback_token TEXT,
                    encrypted_encoding_aes_key TEXT,
                    callback_enabled BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(corpid, agentid, touser)
                )
            `;

            this.db.run(createTableSQL, (err) => {
                if (err) {
                    console.error('创建表失败:', err.message);
                    reject(err);
                    return;
                }
                console.log('数据表创建成功');
                resolve();
            });
        });
    }

    // 保存配置
    async saveConfiguration(config) {
        return new Promise((resolve, reject) => {
            const { 
                code, corpid, encrypted_corpsecret, agentid, touser, description,
                 callback_token, encrypted_encoding_aes_key, callback_enabled 
            } = config;
            const sql = `
                INSERT INTO configurations (
                    code, corpid, encrypted_corpsecret, agentid, touser, description,
                    callback_token, encrypted_encoding_aes_key, callback_enabled
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(sql, [
                code, corpid, encrypted_corpsecret, agentid, touser, description,
                callback_token, encrypted_encoding_aes_key, callback_enabled || 0
            ], function(err) {
                if (err) {
                    console.error('保存配置失败:', err.message);
                    reject(err);
                    return;
                }
                console.log('配置保存成功, ID:', this.lastID);
                resolve({ id: this.lastID, code });
            });
        });
    }

    // 根据code获取配置
    async getConfigurationByCode(code) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM configurations WHERE code = ?`;

            this.db.get(sql, [code], (err, row) => {
                if (err) {
                    console.error('查询配置失败:', err.message);
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    // 更新配置
    async updateConfiguration(config) {
        return new Promise((resolve, reject) => {
            const { 
                code, corpid, encrypted_corpsecret, agentid, touser, description,
                callback_token, encrypted_encoding_aes_key, callback_enabled 
            } = config;
            const sql = `
                UPDATE configurations 
                SET corpid = ?, encrypted_corpsecret = ?, agentid = ?, touser = ?, description = ?,
                    callback_token = ?, encrypted_encoding_aes_key = ?, callback_enabled = ?
                WHERE code = ?
            `;
            this.db.run(sql, [
                corpid, encrypted_corpsecret, agentid, touser, description,
                callback_token, encrypted_encoding_aes_key, callback_enabled,
                code
            ], function(err) {
                if (err) {
                    console.error('更新配置失败:', err.message);
                    reject(err);
                    return;
                }
                console.log('配置更新成功, code:', code);
                resolve({ code });
            });
        });
    }

    // 根据字段查询配置
    async getConfigurationByFields(corpid, agentid, touser) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM configurations WHERE corpid = ? AND agentid = ? AND touser = ?`;
            this.db.get(sql, [corpid, agentid, touser], (err, row) => {
                if (err) {
                    console.error('查询配置失败:', err.message);
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    // 根据完整字段查询配置（包括回调配置）
    async getConfigurationByCompleteFields(corpid, agentid, touser, callback_enabled, callback_token) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM configurations WHERE corpid = ? AND agentid = ? AND touser = ? AND callback_enabled = ? AND (callback_token = ? OR (callback_token IS NULL AND ? IS NULL))`;
            this.db.get(sql, [corpid, agentid, touser, callback_enabled, callback_token, callback_token], (err, row) => {
                if (err) {
                    console.error('查询完整配置失败:', err.message);
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    // 保存回调配置（第一步）
    async saveCallbackConfiguration(config) {
        return new Promise((resolve, reject) => {
            const { code, corpid, callback_token, encrypted_encoding_aes_key } = config;
            
            // 使用 INSERT OR REPLACE 语法
            // 这会根据唯一约束自动决定是插入新记录还是更新现有记录
            const sql = `
                INSERT OR REPLACE INTO configurations (
                    code, corpid, callback_token, encrypted_encoding_aes_key, callback_enabled,
                    encrypted_corpsecret, agentid, touser, description,
                    id, created_at
                )
                SELECT
                    ?, ?, ?, ?, 1,
                    '', 0, '', '',
                    id, created_at
                FROM configurations
                WHERE corpid = ? AND callback_token = ? AND callback_enabled = 1
                UNION ALL
                SELECT
                    ?, ?, ?, ?, 1,
                    '', 0, ?, '',
                    NULL, CURRENT_TIMESTAMP
                WHERE NOT EXISTS (
                    SELECT 1 FROM configurations 
                    WHERE corpid = ? AND callback_token = ? AND callback_enabled = 1
                )
                LIMIT 1
            `;
            
            // 为新配置生成唯一的touser值
            const uniqueTouser = `callback_${code.substring(0, 8)}`;
            
            this.db.run(sql, [
                // 更新现有记录的值
                code, corpid, callback_token, encrypted_encoding_aes_key,
                // 查找条件
                corpid, callback_token,
                // 插入新记录的值
                code, corpid, callback_token, encrypted_encoding_aes_key, uniqueTouser,
                // 检查是否存在的条件
                corpid, callback_token
            ], function(err) {
                if (err) {
                    console.error('保存回调配置失败:', err.message);
                    reject(err);
                    return;
                }
                console.log('回调配置保存成功, changes:', this.changes);
                resolve({ code });
            });
        });
    }

    // 查询回调配置
    async getCallbackConfiguration(corpid, callback_token) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM configurations WHERE corpid = ? AND callback_token = ? AND callback_enabled = 1`;
            this.db.get(sql, [corpid, callback_token], (err, row) => {
                if (err) {
                    console.error('查询回调配置失败:', err.message);
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    // 更新回调配置
    async updateCallbackConfiguration(config) {
        return new Promise((resolve, reject) => {
            const { code, corpid, callback_token, encrypted_encoding_aes_key } = config;
            const sql = `
                UPDATE configurations
                SET corpid = ?, callback_token = ?, encrypted_encoding_aes_key = ?
                WHERE code = ?
            `;
            this.db.run(sql, [corpid, callback_token, encrypted_encoding_aes_key, code], function(err) {
                if (err) {
                    console.error('更新回调配置失败:', err.message);
                    reject(err);
                    return;
                }
                console.log('回调配置更新成功, code:', code);
                resolve({ code });
            });
        });
    }

    // 完善配置（第二步）
    async completeConfiguration(config) {
        return new Promise((resolve, reject) => {
            const { code, encrypted_corpsecret, agentid, touser, description } = config;
            const sql = `
                UPDATE configurations
                SET encrypted_corpsecret = ?, agentid = ?, touser = ?, description = ?
                WHERE code = ?
            `;
            this.db.run(sql, [encrypted_corpsecret, agentid, touser, description, code], function(err) {
                if (err) {
                    console.error('完善配置失败:', err.message);
                    reject(err);
                    return;
                }
                console.log('配置完善成功, code:', code);
                resolve({ code });
            });
        });
    }

    // 关闭数据库连接
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('关闭数据库失败:', err.message);
                } else {
                    console.log('数据库连接已关闭');
                }
            });
        }
    }
}

module.exports = Database; 
