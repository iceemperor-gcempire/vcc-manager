const config = {
  monitoring: {
    queueStatusInterval: parseInt(process.env.REACT_APP_QUEUE_STATUS_INTERVAL) || 5000, // 5초
    recentJobsInterval: parseInt(process.env.REACT_APP_RECENT_JOBS_INTERVAL) || 15000, // 15초
    userStatsInterval: parseInt(process.env.REACT_APP_USER_STATS_INTERVAL) || 30000, // 30초
  },
  api: {
    baseURL: process.env.REACT_APP_API_URL || '/api',
    timeout: parseInt(process.env.REACT_APP_API_TIMEOUT) || 10000,
  },
};

export default config;