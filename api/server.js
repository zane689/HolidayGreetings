const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 从环境变量读取密钥，不暴露在代码中
const API_KEY = process.env.DEEPSEEK_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 用户数据文件路径
const usersFilePath = path.join(__dirname, 'users.json');

// 读取用户数据
function readUsers() {
    try {
        const data = fs.readFileSync(usersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取用户数据失败:', error);
        return { users: [] };
    }
}

// 写入用户数据
function writeUsers(usersData) {
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2));
        return true;
    } catch (error) {
        console.error('写入用户数据失败:', error);
        return false;
    }
}

// 注册接口
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        
        // 检查用户名是否已存在
        const usersData = readUsers();
        const existingUser = usersData.users.find(user => user.username === username);
        
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 创建新用户
        const newUser = {
            id: Date.now().toString(),
            username,
            password: hashedPassword
        };
        
        usersData.users.push(newUser);
        
        if (writeUsers(usersData)) {
            res.status(201).json({ message: '注册成功' });
        } else {
            res.status(500).json({ error: '注册失败，请稍后重试' });
        }
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

// 登录接口
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        
        // 查找用户
        const usersData = readUsers();
        const user = usersData.users.find(user => user.username === username);
        
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 生成JWT令牌
        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ message: '登录成功', token, username: user.username });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

// 认证中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: '无效的认证令牌' });
    }
}

// 代理接口（需要认证）
app.post('/api/generate-blessing', authenticateToken, async (req, res) => {
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
