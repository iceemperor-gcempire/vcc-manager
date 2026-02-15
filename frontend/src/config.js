const config = {
  version: {
    major: 1,
    minor: 4
  },
  monitoring: {
    // 작업 목록 모니터링 주기 (3초)
    recentJobsInterval: 3000,
    // 큐 상태 모니터링 주기 (10초)
    queueStatusInterval: 10000
  }
};

export default config;