require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. 設定 Cloudinary 金鑰
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));

function getTaiwanDateString() {
    const now = new Date();
    const adjustedTime = now.getTime() + (8 * 60 * 60 * 1000) - (2 * 60 * 60 * 1000);
    return new Date(adjustedTime).toISOString().split('T')[0];
}

function getTaiwanTimeString() {
    const now = new Date();
    const twTime = now.getTime() + (8 * 60 * 60 * 1000);
    return new Date(twTime).toISOString().split('T')[1].substring(0, 5);
}

// 2. 接收照片 ➔ 存圖床 ➔ 【發送 Discord 通知】
app.post('/upload', upload.array('photos', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).send('沒有選擇照片');

    const todayTag = getTaiwanDateString();
    const timeStr = getTaiwanTimeString();
    const userNote = req.body.note || '';
    const finalNote = userNote ? `⏰ ${timeStr} ｜ ${userNote}` : `⏰ ${timeStr}`;

    try {
        const uploadPromises = req.files.map(file => {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'study-tracker',
                        tags: [todayTag], 
                        context: `note=${finalNote}`,
                        fetch_format: 'auto',
                        quality: 'auto'
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result); // 成功的話，回傳圖床的資料
                    }
                );
                uploadStream.end(file.buffer);
            });
        });

        // 等待所有照片都成功上傳到 Cloudinary
        const uploadedResults = await Promise.all(uploadPromises);

        // ==========================================
        // 🔥 新增：發送 Discord 通知
        // ==========================================
        const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
        
        if (discordWebhookUrl) {
            // 把剛剛上傳成功的照片網址，打包成 Discord 支援的格式
            const embeds = uploadedResults.map(img => ({
                image: { url: img.secure_url }
            }));

            // 組合通知文字
            const messageContent = userNote 
                ? `💖 **叮咚！有新的進度打卡囉！**\n⏰ 時間：${timeStr}\n💬 備註：${userNote}` 
                : `💖 **叮咚！有新的進度打卡囉！**\n⏰ 時間：${timeStr}`;

            // 發送給 Discord
            fetch(discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: messageContent,
                    embeds: embeds
                })
            }).catch(err => console.error('Discord 通知發送失敗:', err));
        }
        // ==========================================

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).send('上傳失敗');
    }
});

// 3. 讀取照片
app.get('/api/photos', async (req, res) => {
    const targetDate = req.query.date;
    if (!targetDate) return res.status(400).send('請提供日期');

    try {
        const result = await cloudinary.api.resources_by_tag(targetDate, { 
            max_results: 30,
            context: true 
        });
        
        const photos = result.resources.map(img => ({
            id: img.public_id,
            url: img.secure_url,
            note: img.context && img.context.custom && img.context.custom.note ? img.context.custom.note : ''
        }));
        res.json({ photos: photos });
    } catch (error) {
        if (error.http_code === 404) return res.json({ photos: [] });
        res.status(500).send('讀取失敗');
    }
});

// 4. 刪除照片
app.delete('/api/photos', async (req, res) => {
    const public_id = req.body.public_id;
    if (!public_id) return res.status(400).send('缺少照片 ID');

    try {
        const resource = await cloudinary.api.resource(public_id);
        const todayTag = getTaiwanDateString();

        if (!resource.tags || !resource.tags.includes(todayTag)) {
            return res.status(403).json({ 
                success: false, 
                message: '不可刪除歷史紀錄！只能刪除今天上傳的照片喔 🙅‍♂️' 
            });
        }

        await cloudinary.uploader.destroy(public_id);
        res.json({ success: true });

    } catch (error) {
        console.error(error);
        if (error.http_code === 404) return res.status(404).send('找不到該照片');
        res.status(500).send('刪除失敗');
    }
});

app.listen(PORT, () => console.log(`伺服器啟動成功！Port: ${PORT}`));