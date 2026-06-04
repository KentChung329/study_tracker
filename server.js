require('dotenv').config(); // 召喚隱形斗篷，讀取 .env 密碼本
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. 改成從環境變數讀取金鑰，程式碼裡再也沒有明碼了！
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));

// ... 下面的程式碼都不用動！ ...

function getTaiwanDateString() {
    const date = new Date();
    const twDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    return twDate.toISOString().split('T')[0];
}

// 2. 接收【多張照片】與【備註】
// upload.array('photos', 10) 代表一次最多可以傳 10 張
app.post('/upload', upload.array('photos', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).send('沒有選擇照片');

    const todayTag = getTaiwanDateString();
    const note = req.body.note || ''; // 抓取前端傳來的備註

    try {
        // 使用 Promise.all 讓多張照片同時上傳
        const uploadPromises = req.files.map(file => {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'study-tracker',
                        tags: [todayTag],
                        context: `note=${note}`, // 將備註存入照片的 metadata 裡
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
        // 加入 context: true 才能把備註一起抓回來
        const result = await cloudinary.api.resources_by_tag(targetDate, { 
            max_results: 30,
            context: true 
        });
        
        // 整理照片資料（網址、專屬ID、備註）
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

// 4. 【新功能】刪除照片
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