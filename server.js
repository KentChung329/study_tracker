const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
// 設定 Port 號，這是為了之後上雲端準備的
const PORT = process.env.PORT || 3000;

// 自動建立一個資料夾來放照片
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 設定 multer：告訴系統照片存在哪、檔名怎麼取
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // 檔名會自動加上時間，避免檔名重複被覆蓋
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// 讓伺服器可以讀取我們剛剛寫好的 public 網頁
app.use(express.static('public'));

// 接收照片的通道
app.post('/upload', upload.single('photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('沒有選擇照片');
    }
    console.log('叮咚！收到女朋友的新進度照片：', req.file.filename);
    res.send('上傳成功');
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`伺服器啟動成功！請打開瀏覽器輸入 http://localhost:${PORT}`);
});