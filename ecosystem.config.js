module.exports = {
  apps: [{
    name: 'coe33-dnd-tools',
    script: 'npx',
    args: 'serve -s build --listen 3000',  // Fixed: use --listen instead of -l
    cwd: '/var/www/coe33-dnd-tools',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/home/n_josh_ferdez/.pm2/logs/coe33-dnd-tools-error.log',
    out_file: '/home/n_josh_ferdez/.pm2/logs/coe33-dnd-tools-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};