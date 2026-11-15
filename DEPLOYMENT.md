# Production Deployment Guide: Lodge Management System

This guide outlines deployment options for deploying the Lodge Management System to a Linux VPS (Ubuntu 22.04 / 24.04 LTS) using either Docker or native Node.js / PM2 with PostgreSQL.

---

## Architecture Overview
- **Application:** Next.js 16 (App Router, Standalone build)
- **Database:** PostgreSQL 16 (via Prisma ORM)
- **Reverse Proxy:** Nginx with SSL (Let's Encrypt / Certbot)
- **Process Manager:** Docker Compose or PM2

---

## Method 1: Docker Compose Deployment (Recommended)

### 1. Prerequisites on VPS
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Clone Repository & Setup Environment
```bash
git clone <YOUR_GIT_REPO_URL> /opt/lodge-system
cd /opt/lodge-system

# Create production environment file
cp .env.example .env
nano .env
```

Ensure production variables are configured:
```env
LOCAL_TEST_MODE="false"
POSTGRES_USER=lodge_admin
POSTGRES_PASSWORD=<STRONG_RANDOM_PASSWORD>
POSTGRES_DB=lodge_db
DATABASE_URL=postgresql://lodge_admin:<STRONG_RANDOM_PASSWORD>@postgres:5432/lodge_db?schema=public

# Clerk Production Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# OpenClaw AI Key
OPENCLAW_API_KEY=<SECURE_PRODUCTION_OPENCLAW_TOKEN>
```

### 3. Switch Prisma to PostgreSQL for Production
In `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 4. Build & Launch Containers
```bash
docker compose up -d --build

# Run migrations & seed room inventory inside container
docker compose exec app npx prisma db push
docker compose exec app npx tsx prisma/seed.ts
```

---

## Method 2: Native Node.js & PM2 Deployment

### 1. Install Node.js 20 & PostgreSQL
```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx certbot python3-certbot-nginx

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Configure PostgreSQL Database
```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE lodge_db;
CREATE USER lodge_admin WITH ENCRYPTED PASSWORD 'StrongSecretPassword123!';
GRANT ALL PRIVILEGES ON DATABASE lodge_db TO lodge_admin;
ALTER DATABASE lodge_db OWNER TO lodge_admin;
\q
```

### 3. Build Application
```bash
cd /opt/lodge-system
npm ci
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run build
```

### 4. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Nginx Reverse Proxy & SSL Configuration

Create `/etc/nginx/sites-available/lodge.conf`:
```nginx
server {
    server_name lodge.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site & acquire SSL:
```bash
sudo ln -s /etc/nginx/sites-available/lodge.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d lodge.yourdomain.com
```

---

## Maintenance & Backups

### Automated Daily Database Backup (Cron)
```bash
crontab -e
# Add daily backup at 2:00 AM:
0 2 * * * pg_dump -U lodge_admin lodge_db > /backup/lodge_db_$(date +\%F).sql
```
