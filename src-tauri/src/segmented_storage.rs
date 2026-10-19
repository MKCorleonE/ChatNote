use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashSet;

#[derive(Deserialize)]
pub struct SessionChange {
    pub id: String,
    pub payload: String,
}

pub fn read(db: &Connection) -> Result<Option<String>, String> {
    let head: Option<String> = db
        .query_row("SELECT payload FROM workspace_head WHERE id=1", [], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    let Some(head) = head else {
        return db
            .query_row("SELECT payload FROM workspace WHERE id=1", [], |r| r.get(0))
            .optional()
            .map_err(|e| e.to_string());
    };
    let mut value: Value = serde_json::from_str(&head).map_err(|_| "Invalid workspace header")?;
    let get = |id: &str| -> Result<Value, String> {
        let payload: String = db
            .query_row(
                "SELECT payload FROM session_records WHERE id=?1",
                [id],
                |r| r.get(0),
            )
            .map_err(|_| "A saved conversation is missing")?;
        serde_json::from_str(&payload).map_err(|_| "Invalid saved conversation".into())
    };
    let sessions = value["sessions"]
        .as_array()
        .ok_or("Invalid session list")?
        .iter()
        .map(|id| get(id.as_str().ok_or("Invalid session ID")?))
        .collect::<Result<Vec<_>, String>>()?;
    let trash=value["trash"].as_array().ok_or("Invalid recycle bin")?.iter().map(|e|Ok(serde_json::json!({"session":get(e["id"].as_str().ok_or("Invalid recycled ID")?)?,"deletedAt":e["deletedAt"]}))).collect::<Result<Vec<_>,String>>()?;
    value["sessions"] = sessions.into();
    value["trash"] = trash.into();
    Ok(Some(value.to_string()))
}
pub fn write(tx: &Transaction<'_>, head: &str, changes: &[SessionChange]) -> Result<(), String> {
    if head.len() > 2_000_000 {
        return Err("Workspace settings are too large".into());
    }
    let value: Value = serde_json::from_str(head).map_err(|_| "Invalid workspace header")?;
    let sessions = value["sessions"].as_array().ok_or("Invalid session list")?;
    let trash = value["trash"].as_array().ok_or("Invalid recycle bin")?;
    if value["version"] != 1 || sessions.is_empty() || sessions.len() > 2000 || trash.len() > 2000 {
        return Err("Invalid workspace header".into());
    }
    let mut ids = HashSet::new();
    for id in sessions.iter().chain(trash.iter().map(|e| &e["id"])) {
        let id = id
            .as_str()
            .filter(|id| !id.is_empty())
            .ok_or("Invalid session ID")?;
        if !ids.insert(id.to_string()) {
            return Err("Duplicate session ID".into());
        }
    }
    if !sessions.iter().any(|id| id == &value["activeId"]) {
        return Err("Invalid active conversation".into());
    }
    let mut seen = HashSet::new();
    for change in changes {
        if !ids.contains(&change.id)
            || !seen.insert(&change.id)
            || change.payload.len() > 64_000_000
        {
            return Err("Invalid conversation update".into());
        }
        let data: Value =
            serde_json::from_str(&change.payload).map_err(|_| "Invalid conversation JSON")?;
        if data["id"].as_str() != Some(change.id.as_str())
            || !data["messages"].is_array()
            || !data["branches"].is_array()
        {
            return Err("Invalid conversation update".into());
        }
        tx.execute("INSERT INTO session_recovery(session_id,payload) SELECT id,payload FROM session_records WHERE id=?1 AND payload<>?2",params![change.id,change.payload]).map_err(|e|e.to_string())?;
        tx.execute("DELETE FROM session_recovery WHERE session_id=?1 AND id NOT IN(SELECT id FROM session_recovery WHERE session_id=?1 ORDER BY id DESC LIMIT 3)",[&change.id]).map_err(|e|e.to_string())?;
        tx.execute("INSERT INTO session_records(id,payload) VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",params![change.id,change.payload]).map_err(|e|e.to_string())?;
    }
    for id in &ids {
        let present: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM session_records WHERE id=?1)",
                [id],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !present {
            return Err("Conversation update is incomplete".into());
        }
    }
    // Keep recovery for removed sessions until explicit permanent cleanup.
    tx.execute("INSERT INTO workspace_head(id,payload) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",[head]).map_err(|e|e.to_string())?;
    tx.pragma_update(None, "user_version", 2)
        .map_err(|e| e.to_string())?;
    Ok(())
}
pub fn save(db: &mut Connection, head: &str, changes: &[SessionChange]) -> Result<(), String> {
    let version: i64 = db
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if version < 2 {
        // Before the first conversion, preserve an independent SQLite snapshot including attachments.
        if let Some(path) = db.path() {
            let path = std::path::Path::new(path);
            if path.is_file() {
                let backup = path.with_extension("pre-v015.sqlite");
                if !backup.exists() {
                    db.execute("VACUUM INTO ?1", [backup.to_string_lossy().as_ref()])
                        .map_err(|e| format!("Could not back up before storage upgrade: {e}"))?;
                }
                let saved = Connection::open_with_flags(
                    &backup,
                    rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
                )
                .map_err(|e| format!("Could not verify storage backup: {e}"))?;
                let healthy: String = saved
                    .query_row("PRAGMA quick_check", [], |r| r.get(0))
                    .map_err(|e| format!("Could not verify storage backup: {e}"))?;
                if healthy != "ok" {
                    return Err(
                        "Storage backup integrity check failed; conversion was stopped".into(),
                    );
                }
            }
        }
    }
    let tx = db.transaction().map_err(|e| e.to_string())?;
    write(&tx, head, changes)?;
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn save_workspace_delta(
    state: tauri::State<crate::Runtime>,
    head: String,
    changes: Vec<SessionChange>,
) -> Result<(), String> {
    let mut db = state.db.lock().map_err(|_| "Database lock failed")?;
    save(&mut db, &head, &changes)
}

pub fn replace(tx: &Transaction<'_>, value: &Value) -> Result<(), String> {
    let mut head = value.clone();
    let mut changes = Vec::new();
    let sessions = value["sessions"].as_array().ok_or("Invalid session list")?;
    for s in sessions.iter().chain(
        value["trash"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|e| &e["session"]),
    ) {
        changes.push(SessionChange {
            id: s["id"].as_str().ok_or("Invalid session ID")?.into(),
            payload: s.to_string(),
        });
    }
    head["sessions"] = sessions
        .iter()
        .map(|s| s["id"].clone())
        .collect::<Vec<_>>()
        .into();
    head["trash"] = value["trash"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|e| serde_json::json!({"id":e["session"]["id"],"deletedAt":e["deletedAt"]}))
        .collect::<Vec<_>>()
        .into();
    write(tx, &head.to_string(), &changes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::{open_database, write_workspace};
    fn record(id: &str, text: &str) -> SessionChange {
        SessionChange {
            id: id.into(),
            payload: serde_json::json!({"id":id,"messages":[{"text":text}],"branches":[]})
                .to_string(),
        }
    }
    fn header(ids: &[&str]) -> String {
        serde_json::json!({"version":1,"activeId":ids[0],"sessions":ids,"settings":{},"trash":[]})
            .to_string()
    }
    #[test]
    fn conversation_can_exceed_the_old_workspace_limit_without_losing_text() {
        let mut db = open_database(std::path::Path::new(":memory:")).unwrap();
        let text = "x".repeat(21_000_000);
        save(&mut db, &header(&["large"]), &[record("large", &text)]).unwrap();
        let value: Value = serde_json::from_str(&read(&db).unwrap().unwrap()).unwrap();
        assert_eq!(
            value["sessions"][0]["messages"][0]["text"]
                .as_str()
                .unwrap()
                .len(),
            21_000_000
        );
    }
    #[test]
    fn damaged_backup_prevents_conversion_and_preserves_legacy_data() {
        let path = std::env::temp_dir().join(format!(
            "chatnote-bad-backup-{}.sqlite",
            uuid::Uuid::new_v4()
        ));
        let mut db = open_database(&path).unwrap();
        write_workspace(&mut db, r#"{"version":1,"sessions":[{"id":"original"}]}"#).unwrap();
        std::fs::write(path.with_extension("pre-v015.sqlite"), b"damaged backup").unwrap();
        assert!(save(&mut db, &header(&["next"]), &[record("next", "new")]).is_err());
        assert!(read(&db).unwrap().unwrap().contains("original"));
        let version: i64 = db
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert!(version < 2);
        drop(db);
        std::fs::remove_file(&path).unwrap();
        std::fs::remove_file(path.with_extension("pre-v015.sqlite")).unwrap();
    }
    #[test]
    fn old_database_is_backed_up_and_converted_atomically_then_only_changed_sessions_are_written() {
        let path =
            std::env::temp_dir().join(format!("chatnote-segments-{}.sqlite", uuid::Uuid::new_v4()));
        let mut db = open_database(&path).unwrap();
        write_workspace(
            &mut db,
            r#"{"version":1,"sessions":[{"id":"legacy"}],"activeId":"legacy"}"#,
        )
        .unwrap();
        save(
            &mut db,
            &header(&["one", "two"]),
            &[record("one", "initial"), record("two", "unchanged")],
        )
        .unwrap();
        assert!(path.with_extension("pre-v015.sqlite").exists());
        save(
            &mut db,
            &header(&["one", "two"]),
            &[record("one", "updated")],
        )
        .unwrap();
        let value: Value = serde_json::from_str(&read(&db).unwrap().unwrap()).unwrap();
        assert_eq!(value["sessions"][0]["messages"][0]["text"], "updated");
        assert_eq!(value["sessions"][1]["messages"][0]["text"], "unchanged");
        let count: i64 = db
            .query_row(
                "SELECT count(*) FROM session_recovery WHERE session_id='two'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
        let before = read(&db).unwrap();
        assert!(save(
            &mut db,
            &header(&["one", "missing"]),
            &[record("one", "must roll back")]
        )
        .is_err());
        assert_eq!(read(&db).unwrap(), before);
        drop(db);
        assert!(open_database(&path).is_ok());
        std::fs::remove_file(&path).unwrap();
        std::fs::remove_file(path.with_extension("pre-v015.sqlite")).unwrap();
    }
    #[test]
    fn permanent_cleanup_removes_all_segmented_copies_and_preserves_other_conversations() {
        let path = std::env::temp_dir().join(format!(
            "chatnote-segment-purge-{}.sqlite",
            uuid::Uuid::new_v4()
        ));
        let mut db = open_database(&path).unwrap();
        save(
            &mut db,
            &header(&["kept", "gone"]),
            &[record("kept", "keep me"), record("gone", "PRIVATE OLD")],
        )
        .unwrap();
        save(
            &mut db,
            &header(&["kept", "gone"]),
            &[record("gone", "PRIVATE NEW")],
        )
        .unwrap();
        let next = serde_json::json!({"version":1,"activeId":"kept","sessions":[serde_json::from_str::<Value>(&record("kept","keep me").payload).unwrap()],"trash":[],"settings":{}});
        crate::recycle_bin::purge(&mut db, &next.to_string(), &["gone".into()]).unwrap();
        let current = read(&db).unwrap().unwrap();
        assert!(current.contains("keep me"));
        assert!(!current.contains("PRIVATE"));
        let count: i64 = db
            .query_row(
                "SELECT count(*) FROM session_recovery WHERE session_id='gone'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
        assert!(db
            .query_row(
                "SELECT payload FROM session_records WHERE id='gone'",
                [],
                |r| r.get::<_, String>(0)
            )
            .optional()
            .unwrap()
            .is_none());
        drop(db);
        std::fs::remove_file(&path).unwrap();
        std::fs::remove_file(path.with_extension("pre-v015.sqlite")).unwrap();
    }
}
