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

// 【夜貓子換日邏輯🔥】取得台灣時間的日期，但凌晨 2 點前都算昨天！
function getTaiwanDateString() {
    const now = new Date();
    // 台灣是 UTC+8，再減去 2 小時的延遲 = 實加 6 小時
    const adjustedTime = now.getTime() + (8 * 60 * 60 * 1000) - (2 * 60 * 60 * 1000);
    return new Date(adjustedTime).toISOString().split('T')[0];
}

// 取得台灣時間的時間點（維持真實時間，凌晨 1 點就是顯示 01:XX）
function getTaiwanTimeString() {
    const now = new Date();
    const twTime = now.getTime() + (8 * 60 * 60 * 1000);
    return new Date(twTime).toISOString().split('T')[1].substring(0, 5);
}

// 2. 接收多張照片並自動加上時間備註
app.post('/upload', upload.array('photos', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).send('沒有選擇照片');

    const todayTag = getTaiwanDateString();
    const timeStr = getTaiwanTimeString();
    const userNote = req.body.note || '';

    // 自動合成最終備註：時間 ＋ 手打內容
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
                        else resolve(result);
                    }
                );
                uploadStream.end(file.buffer);
            });
        });

        await Promise.all(uploadPromises);
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

// 4. 【安全升級🔥】刪除照片（套用夜貓子換日邏輯）
app.delete('/api/photos', async (req, res) => {
    const public_id = req.body.public_id;
    if (!public_id) return res.status(400).send('缺少照片 ID');

    try {
        const resource = await cloudinary.api.resource(public_id);
        const todayTag = getTaiwanDateString();

        // 檢查照片標籤，如果不是今天的，直接拒絕刪除
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