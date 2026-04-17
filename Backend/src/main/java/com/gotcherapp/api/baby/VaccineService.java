package com.gotcherapp.api.baby;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class VaccineService extends KeyedRecordService {

    public VaccineService(JdbcTemplate jdbc, BabyProfileRepository repo) {
        super(jdbc, repo, "vaccine_records", "vaccine_key", "administered_at");
    }

    public void markAdministered(Long userId, String key) {
        doMark(userId, key);
    }

    public void markNotAdministered(Long userId, String key) {
        doUnmark(userId, key);
    }
}
