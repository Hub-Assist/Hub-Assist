use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, String, Vec};

use common_types::DateRange;

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_DETAILS_ENTRIES: u32 = 50;
const ATTENDANCE_TTL_LEDGERS: u32 = 90 * 17_280; // ~90 days

// ── Storage keys ──────────────────────────────────────────────────────────
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    AttendanceLog(BytesN<32>),
    AttendanceLogsByUser(Address),
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
        let log = AttendanceLog {
            id: id.clone(),
            user_id: user_id.clone(),
            action: action.clone(),
            timestamp,
            details,
        };

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

        // Emit event
        match action {
            AttendanceAction::ClockIn => {
                env.events()
                    .publish((symbol_short!("clk_in"),), (user_id, timestamp));
            }
            AttendanceAction::ClockOut => {
                env.events()
                    .publish((symbol_short!("clk_out"),), (user_id, timestamp));
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
}
