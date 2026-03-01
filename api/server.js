const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 从环境变量读取密钥，不暴露在代码中
const API_KEY = process.env.DEEPSEEK_API_KEY;

// 代理接口
app.post('/api/generate-blessing', async (req, res) => {
    console.log('收到生成祝福语请求:', req.body);
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            console.log('请求缺少prompt参数');
            return res.status(400).json({ error: '缺少prompt参数' });
        }
        
        // 调用 DeepSeek API
        console.log('开始调用DeepSeek API...');
        try {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: '你是一个充满温情的祝福语创作专家，擅长创作有人情味、个性化的节日祝福。你的祝福语要：1.语言温暖真诚，像朋友聊天一样自然；2.结合具体的生活场景和情感细节；3.避免空洞的套话，要有具体的关怀；4.根据节日特点融入相关的元素和情感；5.如果有收件人姓名，要让祝福显得特别为他/她定制。'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 200,
                    temperature: 0.9,
                    top_p: 0.95
                })
            });

            console.log('DeepSeek API响应状态:', response.status);
            if (!response.ok) {
                const errorData = await response.text();
                console.log('DeepSeek API错误响应:', errorData);
                throw new Error(`API调用失败: ${response.status}`);
            }

            const data = await response.json();
            console.log('DeepSeek API响应数据:', JSON.stringify(data, null, 2));
            res.json(data);
        } catch (apiError) {
            console.error('调用DeepSeek API时出错:', apiError);
            throw apiError;
        }
    } catch (error) {
        console.error('生成祝福语失败:', error);
        res.status(500).json({ error: '生成祝福语失败' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`代理服务运行在 http://localhost:${PORT}`);
});
