const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 設定你的 Cloudinary 專屬金鑰 (務必確認是你剛才申請的那三組)
cloudinary.config({ 
    cloud_name: 'dkmpezxqx', 
    api_key: '327316197578417', 
    api_secret: 'LsDwEHShAnEM09eQ9XEd8OXA_JM' 
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));

// 取得台灣時間的日期字串 (格式：YYYY-MM-DD)
function getTaiwanDateString() {
    const date = new Date();
    // 台灣是 UTC+8
    const twDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    return twDate.toISOString().split('T')[0];
}

// 2. 接收照片並貼上「日期標籤」
app.post('/upload', upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).send('沒有選擇照片');

    const todayTag = getTaiwanDateString(); // 取得今天的日期當作標籤

    const uploadStream = cloudinary.uploader.upload_stream(
        {
            folder: 'study-tracker',
            tags: [todayTag],        // 幫照片貼上日期的標籤！
            fetch_format: 'auto',
            quality: 'auto'
        },
        (error, result) => {
            if (error) return res.status(500).send('上傳失敗');
            res.json({ success: true, url: result.secure_url });
        }
    );
    uploadStream.end(req.file.buffer);
});

// 3. 【新功能】根據日期去圖床把照片找出來！
app.get('/api/photos', async (req, res) => {
    const targetDate = req.query.date; // 網頁傳來的日期
    if (!targetDate) return res.status(400).send('請提供日期');

    try {
        // 去圖床搜尋擁有這個日期標籤的照片
        const result = await cloudinary.api.resources_by_tag(targetDate, { max_results: 30 });
        const urls = result.resources.map(img => img.secure_url);
        res.json({ urls: urls });
    } catch (error) {
        // 如果那天沒有上傳照片，Cloudinary 會回傳 404 錯誤，我們就回傳空陣列
        if (error.http_code === 404) {
            return res.json({ urls: [] });
        }
        res.status(500).send('讀取歷史照片失敗');
    }
});

app.listen(PORT, () => console.log(`伺服器啟動成功！Port: ${PORT}`));