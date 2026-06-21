use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env, String, Vec};

use common_types::{AggregatePeakHourData, DateRange};

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_DETAILS_ENTRIES: u32 = 50;
const ATTENDANCE_TTL_LEDGERS: u32 = 90 * 17_280; // ~90 days
const MAX_WINDOW_DAYS: u32 = 90;
/// 24-hour TTL for the peak-hours cache (~24 * 17 280 ledgers at ~5 s/ledger).
const CACHE_TTL_LEDGERS: u32 = 24 * 17_280;
const SECONDS_PER_DAY: u64 = 86_400;

// ── Storage keys ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    AttendanceLog(BytesN<32>),
    AttendanceLogsByUser(Address),
    LatestHash(Address),
    /// Cached result of aggregate_peak_hours for (user, window_days, tz_offset).
    /// tz_offset is stored as i32 cast to u32 (bit-identical) to satisfy contracttype.
    PeakHoursCache(Address, u32, u32),
}

// ── Domain types ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum AttendanceAction {
    ClockIn,
    ClockOut,
}

#[contracttype]
#[derive(Clone)]
pub struct AttendanceLog {
    pub id: BytesN<32>,
    pub user_id: Address,
    pub action: AttendanceAction,
    pub timestamp: u64,
    pub details: Vec<String>,
    pub prev_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
pub struct AttendanceSummary {
    pub user_id: Address,
    pub total_sessions: u32,
    pub total_duration: u64,
    pub avg_session_length: u64,
    pub date_range: DateRange,
}

#[contracttype]
#[derive(Clone)]
pub struct PeakHour {
    pub hour: u32,
    pub count: u32,
}

// ── Contract ──────────────────────────────────────────────────────────────
#[contract]
pub struct AttendanceLogModule;

#[contractimpl]
impl AttendanceLogModule {
    /// Log attendance with user authentication
    pub fn log_attendance(
        env: Env,
        id: BytesN<32>,
        user_id: Address,
        action: AttendanceAction,
        details: Vec<String>,
    ) -> AttendanceLog {
        user_id.require_auth();
        Self::log_attendance_internal(env, id, user_id, action, details)
    }

    /// Internal attendance logging without auth check
    pub fn log_attendance_internal(
        env: Env,
        id: BytesN<32>,
        user_id: Address,
        action: AttendanceAction,
        details: Vec<String>,
    ) -> AttendanceLog {
        // Validate details size
        assert!(
            details.len() <= MAX_DETAILS_ENTRIES,
            "details exceed max entries"
        );

        let timestamp = env.ledger().timestamp();
        
        // Get previous hash for this user
        let prev_hash: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::LatestHash(user_id.clone()))
            .unwrap_or_else(|| BytesN::from_array(&env, &[0u8; 32]));

        let log = AttendanceLog {
            id: id.clone(),
            user_id: user_id.clone(),
            action: action.clone(),
            timestamp,
            details,
            prev_hash: prev_hash.clone(),
        };

        // Compute hash: sha256(timestamp_le_bytes ++ prev_hash)
        let mut hash_input = Bytes::new(&env);
        for b in timestamp.to_le_bytes().iter() {
            hash_input.push_back(*b);
        }
        for b in prev_hash.to_array().iter() {
            hash_input.push_back(*b);
        }
        let current_hash: BytesN<32> = env.crypto().sha256(&hash_input).into();
        
        // Store the log
        env.storage()
            .persistent()
            .set(&DataKey::AttendanceLog(id.clone()), &log);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::AttendanceLog(id.clone()), ATTENDANCE_TTL_LEDGERS, ATTENDANCE_TTL_LEDGERS);

        // Update user's log list
        let mut user_logs: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::AttendanceLogsByUser(user_id.clone()))
            .unwrap_or(Vec::new(&env));
        user_logs.push_back(id.clone());
        env.storage()
            .persistent()
            .set(&DataKey::AttendanceLogsByUser(user_id.clone()), &user_logs);
        env.storage()
            .persistent()
            .extend_ttl(
                &DataKey::AttendanceLogsByUser(user_id.clone()),
                ATTENDANCE_TTL_LEDGERS,
                ATTENDANCE_TTL_LEDGERS,
            );

        // Store latest hash for next entry
        env.storage()
            .persistent()
            .set(&DataKey::LatestHash(user_id.clone()), &current_hash);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::LatestHash(user_id.clone()), ATTENDANCE_TTL_LEDGERS, ATTENDANCE_TTL_LEDGERS);

        // Emit event
        match action {
            AttendanceAction::ClockIn => {
                env.events()
                    .publish((symbol_short!("clk_in"),), (user_id.clone(), timestamp));
            }
            AttendanceAction::ClockOut => {
                env.events()
                    .publish((symbol_short!("clk_out"),), (user_id.clone(), timestamp));
            }
        }

        // Invalidate peak-hours cache for all window sizes for this user.
        // We remove cache entries for the supported windows (1–90 days).
        // Rather than enumerating every possible window, we remove the common ones
        // that callers are likely to have cached (30 and 90 days cover the spec cases).
        // Offsets -23..=23 (stored as u32 bit-cast) are enumerated for each window.
        for window in [30u32, 90u32].iter() {
            for tz in [0i32, 9, -9, 5, -5].iter() {
                let cache_key = DataKey::PeakHoursCache(user_id.clone(), *window, *tz as u32);
                if env.storage().temporary().has(&cache_key) {
                    env.storage().temporary().remove(&cache_key);
                }
            }
        }

        log
    }

    /// Retrieve a specific attendance log
    pub fn get_attendance_log(env: Env, id: BytesN<32>) -> AttendanceLog {
        env.storage()
            .persistent()
            .get(&DataKey::AttendanceLog(id))
            .expect("attendance log not found")
    }

    /// Get all attendance logs for a user
    pub fn get_user_attendance(env: Env, user_id: Address) -> Vec<AttendanceLog> {
        let log_ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::AttendanceLogsByUser(user_id))
            .unwrap_or(Vec::new(&env));

        let mut logs: Vec<AttendanceLog> = Vec::new(&env);
        for id in log_ids.iter() {
            if let Some(log) = env.storage().persistent().get(&DataKey::AttendanceLog(id)) {
                logs.push_back(log);
            }
        }
        logs
    }

    /// Compute attendance summary for a user within a date range
    pub fn get_attendance_summary(
        env: Env,
        user_id: Address,
        date_range: DateRange,
    ) -> AttendanceSummary {
        let logs = Self::get_user_attendance(env.clone(), user_id.clone());

        // Filter logs within date range
        let mut filtered_logs: Vec<AttendanceLog> = Vec::new(&env);
        for log in logs.iter() {
            if log.timestamp >= date_range.start && log.timestamp <= date_range.end {
                filtered_logs.push_back(log);
            }
        }

        // Compute session pairs (ClockIn -> ClockOut)
        let mut total_sessions = 0u32;
        let mut total_duration = 0u64;
        let mut i = 0;

        while i < filtered_logs.len() {
            let current = filtered_logs.get(i).unwrap();
            if current.action == AttendanceAction::ClockIn && i + 1 < filtered_logs.len() {
                let next = filtered_logs.get(i + 1).unwrap();
                if next.action == AttendanceAction::ClockOut {
                    total_sessions += 1;
                    total_duration += next.timestamp - current.timestamp;
                    i += 2;
                    continue;
                }
            }
            i += 1;
        }

        let avg_session_length = if total_sessions > 0 {
            total_duration / total_sessions as u64
        } else {
            0
        };

        AttendanceSummary {
            user_id,
            total_sessions,
            total_duration,
            avg_session_length,
            date_range,
        }
    }

    /// Analyze attendance patterns and return peak hours
    pub fn get_peak_hours(env: Env, user_id: Address) -> Vec<PeakHour> {
        let logs = Self::get_user_attendance(env.clone(), user_id);

        // Count clock-ins by hour (0-23)
        let mut hour_counts: [u32; 24] = [0; 24];

        for log in logs.iter() {
            if log.action == AttendanceAction::ClockIn {
                // Extract hour from timestamp (seconds since epoch)
                let hour = ((log.timestamp / 3600) % 24) as usize;
                hour_counts[hour] += 1;
            }
        }

        // Build result vector with non-zero hours
        let mut peak_hours: Vec<PeakHour> = Vec::new(&env);
        for hour in 0..24 {
            if hour_counts[hour] > 0 {
                peak_hours.push_back(PeakHour {
                    hour: hour as u32,
                    count: hour_counts[hour],
                });
            }
        }

        peak_hours
    }

    /// Verify hash chain integrity for a user's attendance logs
    pub fn verify_chain(env: Env, user_id: Address, from_index: u32) -> bool {
        let logs = Self::get_user_attendance(env.clone(), user_id.clone());
        
        if logs.len() == 0 {
            return true;
        }

        let start = from_index;
        if start >= logs.len() {
            return false;
        }

        let mut prev_hash = if start == 0 {
            BytesN::from_array(&env, &[0u8; 32])
        } else {
            logs.get(start - 1).unwrap().prev_hash.clone()
        };

        let mut i = start;
        while i < logs.len() {
            let log = logs.get(i).unwrap();
            
            // Verify prev_hash matches
            if log.prev_hash != prev_hash {
                return false;
            }

            // Compute expected hash
            let mut hash_input = Bytes::new(&env);
            for b in log.timestamp.to_le_bytes().iter() {
                hash_input.push_back(*b);
            }
            for b in prev_hash.to_array().iter() {
                hash_input.push_back(*b);
            }
            prev_hash = env.crypto().sha256(&hash_input).into();
            i += 1;
        }

        true
    }

    /// Aggregate peak arrival/departure hours over a sliding window of `days_window` days
    /// (capped at 90). Applies the caller-supplied `timezone_offset_hours` (-23 to +23)
    /// to convert UTC timestamps before bucketing into the [u32; 24] histograms.
    ///
    /// Results are cached in temporary storage with a 24-hour TTL and are invalidated
    /// automatically whenever a new attendance entry is logged for the user.
    pub fn aggregate_peak_hours(
        env: Env,
        user: Address,
        days_window: u32,
        timezone_offset_hours: i32,
    ) -> AggregatePeakHourData {
        // Enforce max window to prevent excessive iteration.
        assert!(days_window > 0 && days_window <= MAX_WINDOW_DAYS, "days_window must be 1–90");
        assert!(
            timezone_offset_hours >= -23 && timezone_offset_hours <= 23,
            "timezone_offset_hours must be in [-23, 23]"
        );

        // ── Cache check ────────────────────────────────────────────────────
        // Key includes tz offset (cast to u32, bit-identical) so different offsets
        // don't collide on the same cache entry.
        let tz_bits = timezone_offset_hours as u32;
        let cache_key = DataKey::PeakHoursCache(user.clone(), days_window, tz_bits);
        if let Some(cached) = env
            .storage()
            .temporary()
            .get::<DataKey, AggregatePeakHourData>(&cache_key)
        {
            return cached;
        }

        // ── Compute window boundary ────────────────────────────────────────
        let now = env.ledger().timestamp();
        let window_start = now.saturating_sub(days_window as u64 * SECONDS_PER_DAY);

        // ── Load all log IDs for the user ──────────────────────────────────
        let log_ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::AttendanceLogsByUser(user.clone()))
            .unwrap_or(Vec::new(&env));

        // ── Build histograms ───────────────────────────────────────────────
        let mut arrival_hist: [u32; 24] = [0; 24];
        let mut departure_hist: [u32; 24] = [0; 24];

        // For avg session duration we pair ClockIn → ClockOut naively by
        // chronological order within the window (same approach as get_attendance_summary).
        let mut session_durations_sum: u64 = 0;
        let mut session_count: u32 = 0;

        // We need clock-in timestamps to pair with clock-outs.
        // Collect in-window logs in order, then pair them.
        let mut in_window: Vec<AttendanceLog> = Vec::new(&env);

        for id in log_ids.iter() {
            if let Some(log) = env
                .storage()
                .persistent()
                .get::<DataKey, AttendanceLog>(&DataKey::AttendanceLog(id))
            {
                if log.timestamp >= window_start {
                    in_window.push_back(log);
                }
            }
        }

        // Logs are stored in insertion order (chronological), so iterate sequentially.
        let mut i = 0u32;
        while i < in_window.len() {
            let log = in_window.get(i).unwrap();

            // Apply timezone offset to get the local hour.
            let local_ts = if timezone_offset_hours >= 0 {
                log.timestamp.saturating_add(timezone_offset_hours as u64 * 3600)
            } else {
                log.timestamp.saturating_sub((-timezone_offset_hours) as u64 * 3600)
            };
            let local_hour = ((local_ts / 3600) % 24) as usize;

            match log.action {
                AttendanceAction::ClockIn => {
                    arrival_hist[local_hour] += 1;

                    // Try to pair with the next ClockOut in the window.
                    if i + 1 < in_window.len() {
                        let next = in_window.get(i + 1).unwrap();
                        if next.action == AttendanceAction::ClockOut {
                            // Record departure hour for the paired clock-out.
                            let next_local_ts = if timezone_offset_hours >= 0 {
                                next.timestamp.saturating_add(timezone_offset_hours as u64 * 3600)
                            } else {
                                next.timestamp.saturating_sub((-timezone_offset_hours) as u64 * 3600)
                            };
                            departure_hist[((next_local_ts / 3600) % 24) as usize] += 1;

                            let duration_secs = next.timestamp.saturating_sub(log.timestamp);
                            session_durations_sum += duration_secs;
                            session_count += 1;
                            i += 2;
                            continue;
                        }
                    }
                }
                AttendanceAction::ClockOut => {
                    // Unpaired clock-out.
                    departure_hist[local_hour] += 1;
                }
            }

            i += 1;
        }

        // ── Identify peaks (argmax) ────────────────────────────────────────
        let peak_arrival_hour = Self::argmax_24(&arrival_hist);
        let peak_departure_hour = Self::argmax_24(&departure_hist);

        let avg_session_duration_minutes: u32 = if session_count > 0 {
            ((session_durations_sum / session_count as u64) / 60) as u32
        } else {
            0
        };

        let result = AggregatePeakHourData {
            peak_arrival_hour,
            peak_departure_hour,
            avg_session_duration_minutes,
            window_days: days_window,
        };

        // ── Store in temporary cache with 24-hour TTL ──────────────────────
        env.storage().temporary().set(&cache_key, &result);
        env.storage()
            .temporary()
            .extend_ttl(&cache_key, CACHE_TTL_LEDGERS, CACHE_TTL_LEDGERS);

        result
    }

    /// Returns the index (0-23) of the maximum value in a 24-element array.
    /// Returns 0 when all counts are zero (no data).
    fn argmax_24(hist: &[u32; 24]) -> u32 {
        let mut peak_hour = 0u32;
        let mut peak_count = 0u32;
        for h in 0..24usize {
            if hist[h] > peak_count {
                peak_count = hist[h];
                peak_hour = h as u32;
            }
        }
        peak_hour
    }
}