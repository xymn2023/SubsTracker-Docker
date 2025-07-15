// 企业微信API交互模块
// 封装与企业微信API的HTTP请求

const axios = require('axios');

class WeChatService {
    constructor(apiBase = 'https://qyapi.weixin.qq.com') {
        this.apiBase = apiBase;
        this.tokenCache = new Map(); // 缓存access_token
    }

    // 获取访问凭证
    async getToken(corpid, corpsecret) {
        try {
            // 检查缓存
            const cacheKey = `${corpid}_${corpsecret}`;
            const cached = this.tokenCache.get(cacheKey);
            
            if (cached && cached.expires > Date.now()) {
                console.log('使用缓存的access_token');
                return cached.token;
            }

            // 调用企业微信API获取token
            const response = await axios.get(`${this.apiBase}/cgi-bin/gettoken`, {
                params: {
                    corpid: corpid,
                    corpsecret: corpsecret
                }
            });

            const { data } = response;
            
            if (data.errcode !== 0) {
                throw new Error(`获取token失败: ${data.errmsg} (错误码: ${data.errcode})`);
            }

            // 缓存token (提前5分钟过期)
            const expiresIn = (data.expires_in || 7200) * 1000;
            this.tokenCache.set(cacheKey, {
                token: data.access_token,
                expires: Date.now() + expiresIn - 300000 // 提前5分钟过期
            });

            console.log('获取access_token成功');
            return data.access_token;
        } catch (error) {
            console.error('获取access_token失败:', error.message);
            throw error;
        }
    }

    // 发送应用消息
    async sendMessage(accessToken, agentid, touser, message) {
        try {
            // 构造消息体
            const messageBody = {
                touser: Array.isArray(touser) ? touser.join('|') : touser,
                msgtype: 'text',
                agentid: agentid,
                text: {
                    content: message
                }
            };

            // 发送消息
            const response = await axios.post(
                `${this.apiBase}/cgi-bin/message/send?access_token=${accessToken}`,
                messageBody
            );

            const { data } = response;
            
            if (data.errcode !== 0) {
                throw new Error(`发送消息失败: ${data.errmsg} (错误码: ${data.errcode})`);
            }

            console.log('消息发送成功');
            return data;
        } catch (error) {
            console.error('发送消息失败:', error.message);
            throw error;
        }
    }

    // 获取部门列表
    async getDepartmentList(accessToken) {
        try {
            const response = await axios.get(`${this.apiBase}/cgi-bin/department/list`, {
                params: {
                    access_token: accessToken
                }
            });

            const { data } = response;
            
            if (data.errcode !== 0) {
                throw new Error(`获取部门列表失败: ${data.errmsg} (错误码: ${data.errcode})`);
            }

            return data.department || [];
        } catch (error) {
            console.error('获取部门列表失败:', error.message);
            throw error;
        }
    }

    // 获取部门成员
    async getUserList(accessToken, departmentId = 1) {
        try {
            const response = await axios.get(`${this.apiBase}/cgi-bin/user/list`, {
                params: {
                    access_token: accessToken,
                    department_id: departmentId
                }
            });

            const { data } = response;
            
            if (data.errcode !== 0) {
                throw new Error(`获取成员列表失败: ${data.errmsg} (错误码: ${data.errcode})`);
            }

            return data.userlist || [];
        } catch (error) {
            console.error('获取成员列表失败:', error.message);
            throw error;
        }
    }

    // 获取所有成员（遍历所有部门）
    async getAllUsers(accessToken) {
        try {
            const departments = await this.getDepartmentList(accessToken);
            const allUsers = [];
            const userSet = new Set(); // 用于去重

            for (const dept of departments) {
                const users = await this.getUserList(accessToken, dept.id);
                users.forEach(user => {
                    if (!userSet.has(user.userid)) {
                        userSet.add(user.userid);
                        allUsers.push({
                            userid: user.userid,
                            name: user.name,
                            department: dept.name
                        });
                    }
                });
            }

            return allUsers;
        } catch (error) {
            console.error('获取所有成员失败:', error.message);
            throw error;
        }
    }
}

module.exports = WeChatService; 