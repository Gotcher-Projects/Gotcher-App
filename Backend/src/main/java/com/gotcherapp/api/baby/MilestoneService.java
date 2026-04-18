package com.gotcherapp.api.baby;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class MilestoneService extends KeyedRecordService {

    public MilestoneService(JdbcTemplate jdbc, BabyProfileRepository repo) {
        super(jdbc, repo, "milestones", "milestone_key", "achieved_at");
    }

    public void achieve(Long userId, String key) {
        doMark(userId, key);
    }

    public void unachieve(Long userId, String key) {
        doUnmark(userId, key);
    }
}
