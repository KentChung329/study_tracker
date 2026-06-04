require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. 設定你的 Cloudinary 專屬金鑰
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));

// 取得台灣時間的日期 (格式：YYYY-MM-DD)
function getTaiwanDateString() {
    const date = new Date();
    const twDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    return twDate.toISOString().split('T')[0];
}

// 【新功能】取得台灣時間的時間點 (格式：HH:MM)
function getTaiwanTimeString() {
    const date = new Date();
    const twDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    return twDate.toISOString().split('T')[1].substring(0, 5);
}

// 2. 接收多張照片並【自動加上時間備註】
app.post('/upload', upload.array('photos', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).send('沒有選擇照片');

    const todayTag = getTaiwanDateString();
    const timeStr = getTaiwanTimeString(); // 抓取當下的時間點 (例如 20:45)
    const userNote = req.body.note || '';  // 夾帶的女友手打備註

    // 自動合成最終備註：時間 ＋ 手打內容
    const finalNote = userNote ? `⏰ ${timeStr} ｜ ${userNote}` : `⏰ ${timeStr}`;

    try {
        const uploadPromises = req.files.map(file => {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'study-tracker',
                        tags: [todayTag],
                        context: `note=${finalNote}`, // 存入自動合成的備註
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

// 3. 讀取照片與備註
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
        await cloudinary.uploader.destroy(public_id);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).send('刪除失敗');
    }
});

app.listen(PORT, () => console.log(`伺服器啟動成功！Port: ${PORT}`));