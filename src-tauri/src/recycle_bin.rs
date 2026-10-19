use crate::Runtime;
use rusqlite::{Connection, OptionalExtension};
use serde_json::Value;
use std::collections::HashSet;

fn attachments(value: &Value, out: &mut HashSet<String>) {
    match value {
        Value::Object(object) => {
            if object.contains_key("mime")
                && object.contains_key("kind")
                && object.contains_key("size")
            {
                if let Some(id) = object.get("id").and_then(Value::as_str) {
                    out.insert(id.into());
                }
            }
            for child in object.values() {
                attachments(child, out);
            }
        }
        Value::Array(array) => {
            for child in array {
                attachments(child, out);
            }
        }
        _ => {}
    }
}
fn strip(value: &mut Value, ids: &HashSet<String>, removed: &mut HashSet<String>) {
    if let Some(sessions) = value["sessions"].as_array_mut() {
        sessions.retain(|session| {
            let keep = !ids.contains(session["id"].as_str().unwrap_or(""));
            if !keep {
                attachments(session, removed);
            }
            keep
        });
    }
    if let Some(trash) = value["trash"].as_array_mut() {
        trash.retain(|entry| {
            let keep = !ids.contains(entry["session"]["id"].as_str().unwrap_or(""));
            if !keep {
                attachments(&entry["session"], removed);
            }
            keep
        });
    }
    let active = value["activeId"].as_str().unwrap_or("");
    if !value["sessions"]
        .as_array()
        .is_some_and(|list| list.iter().any(|s| s["id"] == active))
    {
        value["activeId"] = value["sessions"][0]["id"].clone();
    }
}
pub fn purge(db: &mut Connection, payload: &str, session_ids: &[String]) -> Result<(), String> {
    if payload.len() > 300_000_000 || session_ids.is_empty() || session_ids.len() > 2000 {
        return Err("Invalid recycle bin deletion".into());
    }
    let next: Value = serde_json::from_str(payload).map_err(|_| "Invalid workspace JSON")?;
    let ids: HashSet<_> = session_ids.iter().cloned().collect();
    if next["version"] != 1
        || !next["sessions"].as_array().is_some_and(|s| !s.is_empty())
        || next["sessions"]
            .as_array()
            .unwrap()
            .iter()
            .any(|s| ids.contains(s["id"].as_str().unwrap_or("")))
        || next["trash"].as_array().is_some_and(|t| {
            t.iter()
                .any(|e| ids.contains(e["session"]["id"].as_str().unwrap_or("")))
        })
    {
        return Err("Deleted conversations must not remain in the workspace".into());
    }
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let current = crate::segmented_storage::read(&tx)?;
    let mut removed = HashSet::new();
    if let Some(raw) = current {
        let mut old: Value = serde_json::from_str(&raw).map_err(|_| "Invalid saved workspace")?;
        strip(&mut old, &ids, &mut removed);
    }
    // The v1 row is retained across conversion for recovery; include its attachments too.
    let legacy: Option<String> = tx
        .query_row("SELECT payload FROM workspace WHERE id=1", [], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    if let Some(raw) = legacy {
        let mut value: Value =
            serde_json::from_str(&raw).map_err(|_| "Invalid legacy workspace")?;
        strip(&mut value, &ids, &mut removed);
    }
    let recovery = {
        let mut statement = tx
            .prepare("SELECT id,payload FROM recovery")
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    for id in &ids {
        let mut statement=tx.prepare("SELECT payload FROM session_recovery WHERE session_id=?1 UNION ALL SELECT payload FROM session_records WHERE id=?1").map_err(|e|e.to_string())?;
        let rows = statement
            .query_map([id], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let value: Value = serde_json::from_str(&row.map_err(|e| e.to_string())?)
                .map_err(|_| "Invalid saved conversation")?;
            attachments(&value, &mut removed);
        }
    }
    let mut retained = HashSet::new();
    attachments(&next, &mut retained);
    for (id, raw) in recovery {
        let mut value: Value = serde_json::from_str(&raw).map_err(|_| "Invalid recovery record")?;
        strip(&mut value, &ids, &mut removed);
        if value["sessions"].as_array().is_some_and(|s| s.is_empty()) {
            tx.execute("DELETE FROM recovery WHERE id=?1", [id])
                .map_err(|e| e.to_string())?;
        } else {
            attachments(&value, &mut retained);
            tx.execute(
                "UPDATE recovery SET payload=?1 WHERE id=?2",
                rusqlite::params![value.to_string(), id],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    tx.execute("INSERT INTO workspace(id,payload,updated_at) VALUES(1,?1,datetime('now')) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",[payload]).map_err(|e|e.to_string())?;
    // Scrub every segmented copy of permanently removed conversations in the same transaction.
    for id in &ids {
        tx.execute("DELETE FROM session_recovery WHERE session_id=?1", [id])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM session_records WHERE id=?1", [id])
            .map_err(|e| e.to_string())?;
    }
    let segmented: bool = tx
        .query_row("SELECT EXISTS(SELECT 1 FROM workspace_head)", [], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;
    if segmented {
        crate::segmented_storage::replace(&tx, &next)?;
    }
    // Shared attachments referenced by retained segmented recovery must survive.
    {
        let mut statement = tx
            .prepare("SELECT payload FROM session_recovery")
            .map_err(|e| e.to_string())?;
        for row in statement
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| e.to_string())?
        {
            let value: Value = serde_json::from_str(&row.map_err(|e| e.to_string())?)
                .map_err(|_| "Invalid recovery")?;
            attachments(&value, &mut retained);
        }
    }
    for id in removed.difference(&retained) {
        tx.execute("DELETE FROM attachments WHERE id=?1", [id])
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn purge_conversations(
    state: tauri::State<Runtime>,
    payload: String,
    session_ids: Vec<String>,
) -> Result<(), String> {
    let mut db = state.db.lock().map_err(|_| "Database lock failed")?;
    purge(&mut db, &payload, &session_ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::{open_database, write_workspace};
    #[test]
    fn permanent_deletion_removes_recovery_and_unshared_files_atomically() {
        let path =
            std::env::temp_dir().join(format!("chatnote-trash-{}.sqlite", uuid::Uuid::new_v4()));
        {
            let mut db = open_database(&path).unwrap();
            // Conversation IDs in existing/imported workspaces are opaque strings,
            // never paths. Cleanup must support the same IDs as workspace loading.
            let gone = "imported-conversation".to_string();
            let kept = uuid::Uuid::new_v4().to_string();
            let private =
                serde_json::json!({"id":"private-file","kind":"image","mime":"image/png","size":1});
            let shared =
                serde_json::json!({"id":"shared-file","kind":"image","mime":"image/png","size":1});
            let before = serde_json::json!({"version":1,"activeId":kept,"sessions":[{"id":kept,"attachments":[shared.clone()]}],"trash":[{"deletedAt":1,"session":{"id":gone,"text":"private removed text","attachments":[private,shared]}}]});
            write_workspace(&mut db, &before.to_string()).unwrap();
            write_workspace(&mut db, &before.to_string()).unwrap();
            for id in ["private-file", "shared-file"] {
                db.execute("INSERT INTO attachments VALUES(?1,'{}','data')", [id])
                    .unwrap();
            }
            let mut next = before.clone();
            next["trash"] = serde_json::json!([]);
            assert!(purge(&mut db, &before.to_string(), std::slice::from_ref(&gone)).is_err());
            assert_eq!(
                db.query_row("SELECT count(*) FROM attachments", [], |r| r
                    .get::<_, i64>(0))
                    .unwrap(),
                2
            );
            purge(&mut db, &next.to_string(), &[gone]).unwrap();
            let recovery: String = db
                .query_row("SELECT payload FROM recovery", [], |r| r.get(0))
                .unwrap();
            assert!(!recovery.contains("private removed text"));
            assert_eq!(
                db.query_row("SELECT id FROM attachments", [], |r| r.get::<_, String>(0))
                    .unwrap(),
                "shared-file"
            );
        }
        std::fs::remove_file(path).unwrap();
    }
}
