const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 設定你的 Cloudinary 專屬金鑰
cloudinary.config({ 
    cloud_name: 'dkmpezxqx', 
    api_key: '327316197578417', 
    api_secret: 'LsDwEHShAnEM09eQ9XEd8OXA_JM' 
});

// 2. 設定 Multer 使用記憶體來暫存照片，不寫入容易失憶的免費硬碟
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));

// 3. 接收照片並自動轉傳到 Cloudinary
app.post('/upload', upload.single('photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('沒有選擇照片');
    }

    console.log('準備將照片上傳至 Cloudinary...');

    // 開啟通往 Cloudinary 的上傳通道
    const uploadStream = cloudinary.uploader.upload_stream(
        {
            folder: 'study-tracker', // 會在圖床自動建立分類資料夾
            fetch_format: 'auto',    // f_auto
            quality: 'auto'          // q_auto
        },
        (error, result) => {
            if (error) {
                console.error('上傳至 Cloudinary 失敗：', error);
                return res.status(500).send('圖床連線失敗');
            }
            
            // 這裡會印出照片的真實網址
            console.log('✅ 照片永久保存成功！');
            console.log('檔案大小：', result.bytes, 'bytes');
            console.log('照片專屬網址：', result.secure_url);
            
            res.send('上傳成功');
        }
    );

    // 將網頁收到的照片資料直接灌進通道裡上傳
    uploadStream.end(req.file.buffer);
});

app.listen(PORT, () => {
    console.log(`伺服器啟動成功！Port: ${PORT}`);
});