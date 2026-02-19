#!/bin/bash
#
# Oracle Cloud Free Tier Setup Script for Reddit Multi-Poster
# 
# This script sets up a fresh Oracle Cloud ARM VM with:
# - Node.js 20
# - PM2 process manager
# - Nginx reverse proxy
# - Certbot for SSL
# - Firewall configuration
#
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/reddit-multi-poster/main/scripts/oracle-setup.sh | bash
#
# Or: bash scripts/oracle-setup.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect OS
detect_os() {
    if [ -f /etc/oracle-release ] || [ -f /etc/redhat-release ]; then
        OS="oracle"
        PKG_MANAGER="dnf"
    elif [ -f /etc/debian_version ]; then
        OS="ubuntu"
        PKG_MANAGER="apt"
    else
        log_error "Unsupported OS. This script supports Oracle Linux and Ubuntu."
        exit 1
    fi
    log_info "Detected OS: $OS"
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    if [ "$OS" = "oracle" ]; then
        sudo dnf update -y
    else
        sudo apt update && sudo apt upgrade -y
    fi
}

# Install Node.js 20
install_nodejs() {
    log_info "Installing Node.js 20..."
    if [ "$OS" = "oracle" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
        sudo apt install -y nodejs
    fi
    
    node --version
    npm --version
}

# Install PM2
install_pm2() {
    log_info "Installing PM2 process manager..."
    sudo npm install -g pm2
    pm2 --version
}

# Install Nginx
install_nginx() {
    log_info "Installing Nginx..."
    if [ "$OS" = "oracle" ]; then
        sudo dnf install -y nginx
    else
        sudo apt install -y nginx
    fi
    
    sudo systemctl enable nginx
    nginx -v
}

# Install Certbot
install_certbot() {
    log_info "Installing Certbot for SSL..."
    if [ "$OS" = "oracle" ]; then
        sudo dnf install -y certbot python3-certbot-nginx
    else
        sudo apt install -y certbot python3-certbot-nginx
    fi
    
    certbot --version
}

# Install Git
install_git() {
    log_info "Installing Git..."
    if [ "$OS" = "oracle" ]; then
        sudo dnf install -y git
    else
        sudo apt install -y git
    fi
    
    git --version
}

# Configure firewall
configure_firewall() {
    log_info "Configuring firewall..."
    if [ "$OS" = "oracle" ]; then
        # Oracle Linux uses firewalld
        sudo systemctl start firewalld
        sudo systemctl enable firewalld
        sudo firewall-cmd --permanent --add-port=80/tcp
        sudo firewall-cmd --permanent --add-port=443/tcp
        sudo firewall-cmd --reload
        sudo firewall-cmd --list-all
    else
        # Ubuntu uses ufw
        sudo ufw allow 22/tcp
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        sudo ufw --force enable
        sudo ufw status
    fi
}

# Clone repository
clone_repository() {
    log_info "Cloning repository..."
    
    if [ -d ~/reddit-multi-poster ]; then
        log_warn "Repository already exists. Pulling latest changes..."
        cd ~/reddit-multi-poster
        git pull origin main
    else
        read -p "Enter your GitHub username: " GITHUB_USER
        git clone "https://github.com/${GITHUB_USER}/reddit-multi-poster.git" ~/reddit-multi-poster
        cd ~/reddit-multi-poster
    fi
}

# Install dependencies and build
build_application() {
    log_info "Installing dependencies and building application..."
    cd ~/reddit-multi-poster
    npm ci --production
    npm run build
}

# Create environment file template
create_env_template() {
    log_info "Creating environment file template..."
    cd ~/reddit-multi-poster
    
    if [ -f .env.local ]; then
        log_warn ".env.local already exists. Skipping..."
        return
    fi
    
    cat > .env.local << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Reddit OAuth
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=reddit-multi-poster:v1.0.0 (by /u/your_username)

# NextAuth
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=CHANGE_THIS_TO_RANDOM_STRING

# Optional: Sentry Error Tracking
# SENTRY_DSN=your_sentry_dsn
EOF
    
    log_warn "Please edit .env.local with your actual values:"
    log_warn "  nano ~/reddit-multi-poster/.env.local"
}

# Create Nginx configuration
create_nginx_config() {
    log_info "Creating Nginx configuration..."
    
    read -p "Enter your domain name (e.g., reddit.example.com): " DOMAIN
    
    sudo tee /etc/nginx/conf.d/reddit-poster.conf > /dev/null << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # No payload limit (unlike Vercel's 4.5MB)
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Longer timeouts for file uploads
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
EOF

    # Remove default config if exists
    if [ -f /etc/nginx/conf.d/default.conf ]; then
        sudo mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak
    fi
    
    # Test and restart Nginx
    sudo nginx -t
    sudo systemctl restart nginx
    
    log_info "Nginx configured for domain: $DOMAIN"
}

# Setup PM2 startup
setup_pm2() {
    log_info "Setting up PM2..."
    cd ~/reddit-multi-poster
    
    # Start the application
    pm2 start npm --name "reddit-poster" -- start
    
    # Save process list
    pm2 save
    
    # Configure startup script
    log_info "Run the following command to enable PM2 startup on boot:"
    pm2 startup
    
    pm2 status
}

# Setup SSL (optional)
setup_ssl() {
    read -p "Would you like to set up SSL with Let's Encrypt? (y/n): " SETUP_SSL
    
    if [ "$SETUP_SSL" = "y" ]; then
        read -p "Enter your domain name: " SSL_DOMAIN
        read -p "Enter your email for Let's Encrypt: " SSL_EMAIL
        
        sudo certbot --nginx -d "$SSL_DOMAIN" -d "www.$SSL_DOMAIN" --email "$SSL_EMAIL" --agree-tos --non-interactive
        
        log_info "SSL configured successfully!"
        log_info "Certbot will automatically renew certificates."
    else
        log_warn "Skipping SSL setup. You can run 'sudo certbot --nginx' later."
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}Setup Complete!${NC}"
    echo "=============================================="
    echo ""
    echo "Next steps:"
    echo "1. Edit environment variables:"
    echo "   nano ~/reddit-multi-poster/.env.local"
    echo ""
    echo "2. Rebuild after adding env vars:"
    echo "   cd ~/reddit-multi-poster && npm run build"
    echo ""
    echo "3. Restart the application:"
    echo "   pm2 restart reddit-poster"
    echo ""
    echo "4. Set up SSL (if not done):"
    echo "   sudo certbot --nginx -d yourdomain.com"
    echo ""
    echo "5. Enable PM2 startup on boot (run the command from pm2 startup output)"
    echo ""
    echo "Useful commands:"
    echo "  pm2 status          - Check app status"
    echo "  pm2 logs            - View app logs"
    echo "  pm2 restart all     - Restart all apps"
    echo "  sudo nginx -t       - Test nginx config"
    echo ""
}

# Main execution
main() {
    log_info "Starting Oracle Cloud setup for Reddit Multi-Poster..."
    
    detect_os
    update_system
    install_nodejs
    install_pm2
    install_nginx
    install_certbot
    install_git
    configure_firewall
    clone_repository
    build_application
    create_env_template
    create_nginx_config
    setup_pm2
    setup_ssl
    print_summary
}

main "$@"
