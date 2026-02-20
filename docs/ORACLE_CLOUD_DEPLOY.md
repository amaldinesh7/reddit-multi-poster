# Oracle Cloud Free Tier Deployment Guide

This guide walks you through deploying Reddit Multi-Poster to Oracle Cloud's Always Free tier with auto-deployment from GitHub.

## Why Oracle Cloud?

- **Always Free**: 4 OCPU ARM VM with 24GB RAM (no credit card required after initial verification)
- **No Payload Limits**: Unlike Vercel's 4.5MB limit, you control the Nginx configuration
- **Full Control**: Run long-running processes, cron jobs, and background workers
- **Object Storage**: 10GB free for backups and assets

## Prerequisites

1. Oracle Cloud account (sign up at [cloud.oracle.com](https://cloud.oracle.com))
2. SSH key pair for server access
3. A domain name (optional but recommended)
4. GitHub repository with this codebase

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Oracle Cloud VCN                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    ARM VM (A1.Flex)                      │   │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │   │
│  │  │  Nginx   │───▶│  PM2     │───▶│ Next.js App      │   │   │
│  │  │ (SSL)    │    │ (Daemon) │    │ (Port 3000)      │   │   │
│  │  └──────────┘    └──────────┘    └──────────────────┘   │   │
│  │        │                                                 │   │
│  │        ▼                                                 │   │
│  │  ┌──────────┐                                           │   │
│  │  │ Certbot  │                                           │   │
│  │  │ (Let's   │                                           │   │
│  │  │ Encrypt) │                                           │   │
│  │  └──────────┘                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Security List: Allow 22 (SSH), 80 (HTTP), 443 (HTTPS)         │
└─────────────────────────────────────────────────────────────────┘
```

## Step 1: Create Oracle Cloud VM

### 1.1 Create Compute Instance

1. Go to **Compute > Instances > Create Instance**
2. Configure:
   - **Name**: `reddit-poster`
   - **Image**: Oracle Linux 8 or Ubuntu 22.04
   - **Shape**: VM.Standard.A1.Flex (Always Free eligible)
   - **OCPUs**: 4
   - **Memory**: 24 GB
3. Add your SSH public key
4. Click **Create**

### 1.2 Configure Network Security

1. Go to **Networking > Virtual Cloud Networks**
2. Click your VCN > **Security Lists** > Default Security List
3. Add **Ingress Rules**:

| Source CIDR | Protocol | Destination Port | Description |
|-------------|----------|------------------|-------------|
| 0.0.0.0/0   | TCP      | 22               | SSH         |
| 0.0.0.0/0   | TCP      | 80               | HTTP        |
| 0.0.0.0/0   | TCP      | 443              | HTTPS       |

### 1.3 Configure OS Firewall

After SSHing into your instance:

```bash
# For Oracle Linux / CentOS
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload

# For Ubuntu
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

## Step 2: Initial Server Setup

SSH into your new instance:

```bash
ssh -i ~/.ssh/your_key opc@<PUBLIC_IP>
# or for Ubuntu: ssh -i ~/.ssh/your_key ubuntu@<PUBLIC_IP>
```

Run the setup script (see `scripts/oracle-setup.sh`):

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/reddit-multi-poster/main/scripts/oracle-setup.sh | bash
```

Or manually:

```bash
# Update system
sudo dnf update -y  # Oracle Linux
# sudo apt update && sudo apt upgrade -y  # Ubuntu

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs  # Oracle Linux
# sudo apt install -y nodejs  # Ubuntu

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo dnf install -y nginx  # Oracle Linux
# sudo apt install -y nginx  # Ubuntu

# Install Certbot for SSL
sudo dnf install -y certbot python3-certbot-nginx  # Oracle Linux
# sudo apt install -y certbot python3-certbot-nginx  # Ubuntu

# Clone repository
git clone https://github.com/YOUR_USERNAME/reddit-multi-poster.git ~/reddit-multi-poster
cd ~/reddit-multi-poster

# Install dependencies and build
npm ci --production
npm run build
```

## Step 3: Configure Environment Variables

Create your `.env.local` file:

```bash
cd ~/reddit-multi-poster
cp .env.example .env.local
nano .env.local
```

Add your production values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Reddit OAuth
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=reddit-multi-poster:v1.0.0 (by /u/your_username)

# NextAuth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# Optional: Sentry
SENTRY_DSN=your_sentry_dsn
```

## Step 4: Configure Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/conf.d/reddit-poster.conf
```

Add:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # No payload limit (unlike Vercel's 4.5MB)
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Longer timeouts for file uploads
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
```

Test and reload:

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

## Step 5: Set Up SSL with Let's Encrypt

Point your domain's DNS A record to the Oracle Cloud public IP, then:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will automatically:
- Obtain SSL certificates
- Configure Nginx for HTTPS
- Set up auto-renewal

Verify auto-renewal:

```bash
sudo certbot renew --dry-run
```

## Step 6: Start Application with PM2

```bash
cd ~/reddit-multi-poster

# Start the application
pm2 start npm --name "reddit-poster" -- start

# Save PM2 process list for auto-restart on reboot
pm2 save

# Configure PM2 to start on boot
pm2 startup
# Run the command it outputs
```

## Step 7: Set Up GitHub Auto-Deploy

### 7.1 Add GitHub Secrets

Go to your repository **Settings > Secrets and variables > Actions** and add:

| Secret Name      | Value                         |
|------------------|-------------------------------|
| `ORACLE_HOST`    | Your VM's public IP           |
| `ORACLE_USER`    | `opc` (Oracle Linux) or `ubuntu` |
| `ORACLE_SSH_KEY` | Your private SSH key contents |

### 7.2 Create GitHub Action

The workflow file `.github/workflows/deploy-oracle.yml` is already included. It will:
1. Trigger on every push to `main`
2. SSH into your Oracle Cloud VM
3. Pull latest code
4. Install dependencies
5. Build the application
6. Restart PM2

## Monitoring & Maintenance

### View Application Logs

```bash
pm2 logs reddit-poster
```

### View Nginx Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart Application

```bash
pm2 restart reddit-poster
```

### Update Application Manually

```bash
cd ~/reddit-multi-poster
git pull origin main
npm ci --production
npm run build
pm2 restart reddit-poster
```

### Check PM2 Status

```bash
pm2 status
pm2 monit  # Real-time monitoring
```

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs reddit-poster --lines 100

# Check if port 3000 is in use
sudo lsof -i :3000

# Check Node.js version
node --version
```

### Nginx 502 Bad Gateway

```bash
# Check if app is running
pm2 status

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Verify proxy settings
curl http://localhost:3000
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Check Nginx SSL config
sudo nginx -t
```

### Firewall Issues

```bash
# Check firewall status (Oracle Linux)
sudo firewall-cmd --list-all

# Check iptables (Ubuntu)
sudo iptables -L -n
```

## Cost Optimization

This setup stays within Oracle's Always Free tier:
- **Compute**: 4 OCPU ARM instance (Always Free)
- **Storage**: 200GB boot volume (Always Free up to 200GB)
- **Bandwidth**: 10TB/month outbound (Always Free)
- **Load Balancer**: Not used (Nginx on VM)

## Security Recommendations

1. **Keep system updated**: `sudo dnf update -y` regularly
2. **Use SSH keys only**: Disable password authentication
3. **Configure fail2ban**: Protect against brute force attacks
4. **Use environment variables**: Never commit secrets
5. **Enable Nginx rate limiting**: Prevent abuse
6. **Set up monitoring**: Use PM2 monitoring or external services

## Alternative: Docker Deployment

If you prefer Docker:

```bash
# Install Docker
sudo dnf install -y docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# Build and run
docker build -t reddit-poster .
docker run -d --name reddit-poster -p 3000:3000 --env-file .env.local reddit-poster
```

---

For questions or issues, open a GitHub issue or check the main README.
