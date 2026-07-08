package com.gotcherapp.api.family;

import com.gotcherapp.api.baby.BabyProfileRepository;
import com.gotcherapp.api.family.dto.FamilyMemberRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class FamilyMemberService {

    private static final String COLS =
        "id, baby_profile_id, name, role, role_category, photo_url, bio, sort_order, linked_member_id";

    private final JdbcTemplate jdbc;
    private final BabyProfileRepository babyProfileRepository;

    public FamilyMemberService(JdbcTemplate jdbc, BabyProfileRepository babyProfileRepository) {
        this.jdbc = jdbc;
        this.babyProfileRepository = babyProfileRepository;
    }

    public List<FamilyMember> findAll(Long userId) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        return jdbc.queryForList(
            "SELECT " + COLS + " FROM family_members WHERE baby_profile_id = ? " +
            "ORDER BY sort_order NULLS LAST, id",
            profileId.get()
        ).stream().map(this::mapRow).toList();
    }

    public FamilyMember create(Long userId, FamilyMemberRequest req) {
        Long profileId = babyProfileRepository.requireProfileId(userId);
        if (req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (req.role() == null || req.role().isBlank()) {
            throw new IllegalArgumentException("role is required");
        }
        Integer nextOrder = jdbc.queryForObject(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM family_members WHERE baby_profile_id = ?",
            Integer.class, profileId);
        String category = blankToNull(req.roleCategory());
        // A side-link only makes sense for a grandparent; ignore it otherwise.
        Long linkedId = "grandparent".equals(category) ? validLinkedId(req.linkedMemberId(), profileId) : null;
        Map<String, Object> row = jdbc.queryForMap("""
            INSERT INTO family_members (baby_profile_id, name, role, role_category, photo_url, bio, sort_order, linked_member_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """ + "RETURNING " + COLS,
            profileId,
            req.name().trim(),
            req.role().trim(),
            category,
            blankToNull(req.photoUrl()),
            req.bio(),
            nextOrder,
            linkedId
        );
        return mapRow(row);
    }

    public Optional<FamilyMember> update(Long userId, Long id, FamilyMemberRequest req) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return Optional.empty();

        List<String> set = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (req.name() != null)         { set.add("name = ?");          params.add(req.name().trim()); }
        if (req.role() != null)         { set.add("role = ?");          params.add(req.role().trim()); }
        if (req.roleCategory() != null) {
            String category = blankToNull(req.roleCategory());
            set.add("role_category = ?"); params.add(category);
            // A side-link only makes sense for a grandparent — clear it if the tier changed away.
            if (!"grandparent".equals(category)) set.add("linked_member_id = NULL");
        }
        if (req.photoUrl() != null)     { set.add("photo_url = ?");     params.add(blankToNull(req.photoUrl())); }
        if (req.bio() != null)          { set.add("bio = ?");           params.add(req.bio()); }
        if (req.linkedMemberId() != null) { set.add("linked_member_id = ?"); params.add(validLinkedId(req.linkedMemberId(), profileId.get())); }

        if (set.isEmpty()) return getOwned(id, profileId.get());
        set.add("updated_at = NOW()");
        params.add(id);
        params.add(profileId.get());

        List<Map<String, Object>> rows = jdbc.queryForList(
            "UPDATE family_members SET " + String.join(", ", set) +
            " WHERE id = ? AND baby_profile_id = ? RETURNING " + COLS,
            params.toArray()
        );
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    public boolean delete(Long userId, Long id) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return false;
        return jdbc.update(
            "DELETE FROM family_members WHERE id = ? AND baby_profile_id = ?",
            id, profileId.get()
        ) > 0;
    }

    /** Renumbers sort_order to match orderedIds (only ids owned by this profile are touched). */
    public List<FamilyMember> reorder(Long userId, List<Long> orderedIds) {
        Optional<Long> profileId = babyProfileRepository.findProfileIdByUserId(userId);
        if (profileId.isEmpty()) return List.of();
        if (orderedIds != null) {
            int order = 0;
            for (Long id : orderedIds) {
                jdbc.update(
                    "UPDATE family_members SET sort_order = ?, updated_at = NOW() WHERE id = ? AND baby_profile_id = ?",
                    order++, id, profileId.get());
            }
        }
        return findAll(userId);
    }

    private Optional<FamilyMember> getOwned(Long id, Long profileId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT " + COLS + " FROM family_members WHERE id = ? AND baby_profile_id = ?",
            id, profileId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(mapRow(rows.get(0)));
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    // A grandparent's side-link must point at another member of the SAME profile (avoid cross-profile
    // linking). Returns the id if it's owned, else null.
    private Long validLinkedId(Long linkedId, Long profileId) {
        if (linkedId == null) return null;
        Integer c = jdbc.queryForObject(
            "SELECT COUNT(*) FROM family_members WHERE id = ? AND baby_profile_id = ?",
            Integer.class, linkedId, profileId);
        return (c != null && c > 0) ? linkedId : null;
    }

    private FamilyMember mapRow(Map<String, Object> row) {
        Object so = row.get("sort_order");
        Object lm = row.get("linked_member_id");
        return new FamilyMember(
            ((Number) row.get("id")).longValue(),
            ((Number) row.get("baby_profile_id")).longValue(),
            (String) row.get("name"),
            (String) row.get("role"),
            (String) row.get("role_category"),
            (String) row.get("photo_url"),
            (String) row.get("bio"),
            so != null ? ((Number) so).intValue() : null,
            lm != null ? ((Number) lm).longValue() : null
        );
    }
}
