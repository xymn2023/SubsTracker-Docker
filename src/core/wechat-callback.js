// 企业微信回调验证模块
// 使用官方wxcrypt库实现，与Python WXBizMsgCrypt完全兼容

const WXBizMsgCrypt = require('wxcrypt');
const { x2o } = require('wxcrypt'); // XML解析工具

class WeChatCallbackCrypto {
    constructor(token, encodingAESKey, corpId) {
        this.token = token;
        this.encodingAESKey = encodingAESKey;
        this.corpId = corpId;

        // 使用官方wxcrypt库
        this.wxcrypt = new WXBizMsgCrypt(token, encodingAESKey, corpId);
    }

    /**
     * 验证URL - 用于开启回调模式时的验证
     * @param {string} msgSignature - 企业微信加密签名
     * @param {string} timestamp - 时间戳
     * @param {string} nonce - 随机数
     * @param {string} echoStr - 加密的随机字符串
     * @returns {Object} { success: boolean, data: string }
     */
    verifyURL(msgSignature, timestamp, nonce, echoStr) {
        try {
            // 使用官方wxcrypt库进行验证，与Python版本完全兼容
            const decrypted = this.wxcrypt.verifyURL(msgSignature, timestamp, nonce, echoStr);
            return { success: true, data: decrypted };
        } catch (error) {
            console.error('URL验证失败:', error.message, 'errcode:', error.errcode);
            return {
                success: false,
                error: error.errmsg || error.message,
                errcode: error.errcode
            };
        }
    }

    /**
     * 解密消息
     * @param {string} encryptedMsg - 加密的消息
     * @param {string} msgSignature - 消息签名
     * @param {string} timestamp - 时间戳
     * @param {string} nonce - 随机数
     * @returns {Object} { success: boolean, data: string }
     */
    decryptMsg(encryptedMsg, msgSignature, timestamp, nonce) {
        try {
            // 使用官方wxcrypt库进行解密，与Python版本完全兼容
            const decrypted = this.wxcrypt.decryptMsg(msgSignature, timestamp, nonce, encryptedMsg);
            return { success: true, data: decrypted };
        } catch (error) {
            console.error('消息解密失败:', error.message, 'errcode:', error.errcode);
            return {
                success: false,
                error: error.errmsg || error.message,
                errcode: error.errcode
            };
        }
    }



    /**
     * 解析XML消息
     * @param {string} xmlString - XML字符串
     * @returns {Object} 解析后的消息对象
     */
    parseXMLMessage(xmlString) {
        try {
            // 使用wxcrypt库的XML解析工具
            const parsed = x2o(xmlString);

            // 提取消息内容（通常在xml根节点下）
            const xml = parsed.xml || parsed;

            return {
                fromUserName: xml.FromUserName || '',
                toUserName: xml.ToUserName || '',
                msgType: xml.MsgType || '',
                content: xml.Content || '',
                picUrl: xml.PicUrl || '',
                msgId: xml.MsgId || '',
                agentId: xml.AgentID || '',
                createTime: xml.CreateTime || ''
            };
        } catch (error) {
            console.error('XML解析失败:', error.message);
            throw error;
        }
    }
}

module.exports = WeChatCallbackCrypto;