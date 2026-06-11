const config = {
  version: {
    major: 3,
    minor: 5
  },
  monitoring: {
    // 작업 목록 모니터링 주기 (기본 3초)
    recentJobsInterval: parseInt(process.env.REACT_APP_RECENT_JOBS_INTERVAL, 10) || 3000,
    // 큐 상태 모니터링 주기 (기본 10초)
    queueStatusInterval: parseInt(process.env.REACT_APP_QUEUE_STATUS_INTERVAL, 10) || 10000
  }
};

export default config;
