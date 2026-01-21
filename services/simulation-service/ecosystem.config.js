module.exports = {
  apps: [{
    name: 'karmyq-simulation',
    script: 'dist/index.js',
    cwd: require('path').join(require('os').homedir(), 'karmyq/services/simulation-service'),
    instances: 1,
    exec_mode: 'fork',

    // Production Environment - 24/7 low-rate simulation
    env_production: {
      NODE_ENV: 'production',
      API_BASE_URL: 'https://karmyq.com/api',
      SIMULATION_ENABLED: 'true',
      ENVIRONMENT: 'production',
      MIN_CONCURRENT_SESSIONS: '2',
      MAX_CONCURRENT_SESSIONS: '5',
      TOTAL_USERS: '2059',
      BUSINESS_HOURS_ENABLED: 'false', // Run 24/7
      BUSINESS_HOURS_START: '00:00',
      BUSINESS_HOURS_END: '23:59',
      BUSINESS_HOURS_TIMEZONE: 'America/Los_Angeles',
      RESPECT_RATE_LIMITS: 'false',
      MIN_DELAY_MS: '10000', // Slower rate: 10 seconds between actions
      MAX_RETRIES: '3',
      LOG_LEVEL: 'info'
    },

    // Staging Environment
    env_staging: {
      NODE_ENV: 'staging',
      API_BASE_URL: 'https://staging.karmyq.com/api',
      SIMULATION_ENABLED: 'true',
      ENVIRONMENT: 'staging',
      MIN_CONCURRENT_SESSIONS: '2',
      MAX_CONCURRENT_SESSIONS: '5',
      TOTAL_USERS: '10',
      BUSINESS_HOURS_ENABLED: 'true',
      BUSINESS_HOURS_START: '10:00',
      BUSINESS_HOURS_END: '17:00',
      BUSINESS_HOURS_TIMEZONE: 'America/Los_Angeles',
      RESPECT_RATE_LIMITS: 'true',
      MIN_DELAY_MS: '3000',
      MAX_RETRIES: '3',
      LOG_LEVEL: 'debug'
    },

    // Development Environment
    env_development: {
      NODE_ENV: 'development',
      API_BASE_URL: 'http://localhost:3000/api',
      SIMULATION_ENABLED: 'true',
      ENVIRONMENT: 'dev',
      MIN_CONCURRENT_SESSIONS: '1',
      MAX_CONCURRENT_SESSIONS: '3',
      TOTAL_USERS: '5',
      BUSINESS_HOURS_ENABLED: 'false',
      RESPECT_RATE_LIMITS: 'false',
      MIN_DELAY_MS: '1000',
      MAX_RETRIES: '3',
      LOG_LEVEL: 'debug'
    },

    // Logging
    error_file: 'logs/error.log',
    out_file: 'logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Behavior
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    exp_backoff_restart_delay: 100,
    restart_delay: 4000,

    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
