## Server Setup: Ubuntu + PM2 + GitHub Actions

**เป้าหมาย**: ให้ push โค้ดขึ้น branch `main` แล้ว GitHub Actions จะ deploy ไป Ubuntu server และ restart app ด้วย PM2 อัตโนมัติ (ตาม workflow `deploy.yml`).

---

### 1. เตรียม Ubuntu Server

รันคำสั่งด้านล่างบน Ubuntu (ผ่าน SSH):

```bash
sudo apt update && sudo apt upgrade -y

# (แนะนำ) สร้าง user สำหรับ deploy
sudo adduser deploy
sudo usermod -aG sudo deploy

# เข้าเป็น user deploy
su - deploy
```

---

### 2. ติดตั้ง Node.js, npm, git, PM2

```bash
# ติดตั้ง Node.js 20 และ git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# ติดตั้ง pm2 แบบ global
sudo npm install -g pm2

# ตรวจสอบเวอร์ชัน
node -v
npm -v
git --version
pm2 -v
```

---

### 3. เตรียมโฟลเดอร์โปรเจกต์บน Server

ค่าที่ workflow ใช้งานปัจจุบันใน `deploy.yml`:

- `APP_DIR=/var/www/my-app`
- `PM2_NAME=my-app`
- `ENTRY_FILE=app.js`

ให้เตรียมโฟลเดอร์และ clone โปรเจกต์ให้ตรงกับ `APP_DIR`:

```bash
su - deploy

mkdir -p /var/www
cd /var/www

# เปลี่ยน <REPO_URL> เป็น URL ของ Git repo ของคุณ (https หรือ ssh)
git clone <REPO_URL> my-app

cd my-app

# ติดตั้ง dependencies และ build ครั้งแรก
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

npm run build --if-present
```

ถ้า path หรือชื่อ app ไม่ตรงกับที่ใช้ใน workflow ให้กลับไปแก้ใน `.github/workflows/deploy.yml`:

- `APP_DIR` → path โปรเจกต์จริงบน server
- `PM2_NAME` → ชื่อ process ใน PM2 ที่ต้องการใช้
- `ENTRY_FILE` → ไฟล์เริ่มต้นของแอป (เช่น `app.js`, `server.js`, `dist/server.js` เป็นต้น)

---

### 4. รันแอปด้วย PM2 ครั้งแรก

ทดสอบรันแอปให้ทำงานด้วย PM2 ก่อน เพื่อยืนยันว่า config ถูกต้อง:

```bash
cd /var/www/my-app

# ตัวอย่าง ถ้า entry คือ app.js (ต้องตรงกับ ENTRY_FILE)
pm2 start app.js --name my-app

# ตัวอย่างอื่น:
# pm2 start dist/server.js --name my-app

pm2 status
```

ให้ PM2 start อัตโนมัติเมื่อเครื่อง reboot:

```bash
pm2 save
pm2 startup systemd
# ทำตามคำสั่งที่ pm2 แสดง เช่น:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
```

---

### 5. ตั้งค่า SSH ให้ GitHub Actions เข้าถึง Server

#### 5.1 สร้าง SSH key สำหรับ GitHub Actions

ทำบนเครื่อง local หรือเครื่องใดก็ได้ที่ปลอดภัย:

```bash
ssh-keygen -t ed25519 -C "github-actions"
# จะได้ไฟล์ตัวอย่าง: ~/.ssh/id_ed25519 (private) และ ~/.ssh/id_ed25519.pub (public)
```

#### 5.2 เพิ่ม public key เข้า server

คัดลอกเนื้อหาในไฟล์ `id_ed25519.pub`  
จากนั้นไปที่ Ubuntu server (ล็อกอินเป็น user ที่ใช้ deploy เช่น `deploy`):

```bash
su - deploy

mkdir -p ~/.ssh
chmod 700 ~/.ssh

echo "<เนื้อหาใน id_ed25519.pub>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

ทดสอบว่า SSH เข้าได้ด้วย key นี้ (จากเครื่องที่ถือ private key):

```bash
ssh -i /path/to/id_ed25519 deploy@<SSH_HOST>
```

#### 5.3 เพิ่ม private key เข้า GitHub Secrets

ในหน้า GitHub repo:

1. ไปที่ `Settings` → `Secrets and variables` → `Actions`
2. สร้าง Secrets ดังนี้:
   - `SSH_HOST` = IP หรือ domain ของ Ubuntu server (เช่น `1.2.3.4` หรือ `api.example.com`)
   - `SSH_USER` = ชื่อ user บน server (เช่น `deploy`)
   - `SSH_KEY` = เนื้อหาไฟล์ `id_ed25519` ทั้งไฟล์ (private key)

---

### 6. ตรวจ workflow `deploy.yml` ให้ตรงกับ server

ไฟล์อยู่ที่:

```text
.github/workflows/deploy.yml
```

ตรวจให้แน่ใจว่า:

- branch ที่ใช้ trigger ตรงกับที่ต้องการ (ปัจจุบันคือ `main`)
- ค่าด้านล่างใน section script ของ SSH ตรงกับ server:
  - `APP_DIR=/var/www/my-app`
  - `PM2_NAME=my-app`
  - `ENTRY_FILE=app.js`

เมื่อทุกอย่างตรง:

1. `git add` / `git commit` / `git push` ขึ้น branch `main`
2. ไปหน้า `Actions` บน GitHub → เลือก workflow `Deploy to Ubuntu with PM2`
3. ตรวจ log ให้แน่ใจว่า step ต่าง ๆ รันผ่าน และแอปถูก restart บน server ด้วย PM2 ตามที่คาดไว้

---

### 7. Troubleshooting (เบื้องต้น)

- ถ้าเข้า server ไม่ได้จาก GitHub Actions:
  - ตรวจ `SSH_HOST`, `SSH_USER`, `SSH_KEY` ใน Secrets
  - ตรวจว่า key ถูกเพิ่มใน `~/.ssh/authorized_keys` แล้ว
  - ตรวจ firewall / security group ว่า port 22 เปิด

- ถ้า PM2 หา app ไม่เจอ:
  - ตรวจ path ใน `APP_DIR`
  - ตรวจ `ENTRY_FILE` ว่ามีไฟล์จริงในโปรเจกต์
  - ลอง SSH เข้าไป manual: `cd APP_DIR` แล้ว `pm2 start <ENTRY_FILE> --name <PM2_NAME>`
---

### 8. ตั้งค่า Nginx เป็น Reverse Proxy (Option สำหรับ Web App)

หากแอปของคุณเป็น HTTP API / Web App และต้องการให้เข้าผ่าน port 80/443 (เช่น `https://your-domain.com`) แนะนำให้ใช้ Nginx เป็น reverse proxy หน้า PM2:

#### 8.1 ติดตั้ง Nginx

```bash
sudo apt install -y nginx

# เปิด firewall สำหรับ nginx (ถ้าใช้ ufw)
sudo ufw allow 'Nginx Full'
sudo ufw enable   # ถ้ายังไม่ enable
```

ตรวจสอบว่า Nginx ทำงานอยู่:

```bash
sudo systemctl status nginx
```

#### 8.2 ตรวจ port ที่แอปรันอยู่

ในโค้ดของคุณ ให้ตรวจว่า server ฟังที่ port ไหน เช่น 3000:

```js
// ตัวอย่าง
app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
```

จำค่า port นี้ไว้ (เช่น `3000`) เพื่อใช้ใน config ของ Nginx (`proxy_pass http://127.0.0.1:3000;`).

#### 8.3 สร้าง Nginx server block

สร้างไฟล์ config ใหม่ (เช่น `my-app`) ใน `/etc/nginx/sites-available/`:

```bash
sudo nano /etc/nginx/sites-available/my-app
```

ตัวอย่าง config พื้นฐาน (HTTP):

```nginx
server {
    listen 80;
    server_name your-domain.com;  # แก้เป็น domain หรือ IP ของคุณ

    location / {
        proxy_pass http://127.0.0.1:3000;  # แก้ port ให้ตรงกับแอป
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

จากนั้น enable site และ reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/my-app /etc/nginx/sites-enabled/

sudo nginx -t         # เช็คว่า config ถูกต้อง
sudo systemctl reload nginx
```

ตอนนี้การเรียก `http://your-domain.com` จะถูกส่งไปที่แอป Node ที่รันด้วย PM2 บน `127.0.0.1:3000`.

#### 8.4 (แนะนำ) เพิ่ม HTTPS ด้วย Let's Encrypt (Certbot)

ถ้ามี domain จริง แนะนำให้ใช้ HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d your-domain.com
```

ทำตาม wizard เพื่อออก certificate และตั้งค่า redirect HTTP → HTTPS อัตโนมัติ  
Certbot จะตั้ง cron/ระบบต่ออายุ certificate ให้อัตโนมัติอยู่แล้ว

---

ตอนนี้ flow เต็มชุดคือ:

1. User เข้าเว็บ → Nginx (80/443)
2. Nginx reverse proxy → แอป Node (รันด้วย PM2 บน port ภายใน เช่น 3000)
3. Dev `git push` → GitHub Actions รัน workflow `deploy.yml`
4. Workflow SSH เข้า Ubuntu → `git pull` + `npm install/build` + `pm2 restart`

