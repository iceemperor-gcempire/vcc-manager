const config = {
  version: {
    major: 3,
    minor: 13
  },
  monitoring: {
    // 작업 목록 모니터링 주기 (기본 3초)
    recentJobsInterval: parseInt(import.meta.env.VITE_RECENT_JOBS_INTERVAL, 10) || 3000,
    // 큐 상태 모니터링 주기 (기본 10초)
    queueStatusInterval: parseInt(import.meta.env.VITE_QUEUE_STATUS_INTERVAL, 10) || 10000
  }
};

export default config;
