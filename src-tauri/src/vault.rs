// Large OAuth records exceed a Windows generic credential's blob limit.
// Write chunks first, then atomically publish a manifest; the prior record remains valid on failure.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
const PREFIX: &str = "chatnote-vault-v1:";
#[cfg(any(target_os = "windows", target_os = "macos"))]
fn raw_read(name: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new("ChatNote", name)
        .map_err(|_| "Could not access the system credential vault")?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Could not read the system credential vault".into()),
    }
}
#[cfg(any(target_os = "windows", target_os = "macos"))]
fn raw_write(name: &str, value: Option<&str>) -> Result<(), String> {
    let entry = keyring::Entry::new("ChatNote", name)
        .map_err(|_| "Could not access the system credential vault")?;
    if let Some(v) = value {
        entry
            .set_password(v)
            .map_err(|_| "Could not securely save credentials".into())
    } else {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("Could not remove saved credentials".into()),
        }
    }
}
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn raw_read(_name: &str) -> Result<Option<String>, String> {
    Err("Secure credentials are not implemented for this platform yet".into())
}
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn raw_write(_name: &str, _value: Option<&str>) -> Result<(), String> {
    Err("Secure credentials are not implemented for this platform yet".into())
}
fn manifest(text: &str) -> Option<(String, usize)> {
    let rest = text.strip_prefix(PREFIX)?;
    let (id, n) = rest.split_once(':')?;
    uuid::Uuid::parse_str(id).ok()?;
    let n: usize = n.parse().ok()?;
    if n == 0 || n > 512 {
        return None;
    }
    Some((id.into(), n))
}
fn remove_chunks(name: &str, text: &str) {
    if let Some((id, n)) = manifest(text) {
        for i in 0..n {
            let _ = raw_write(&format!("{name}:{id}:{i}"), None);
        }
    }
}
pub fn read(name: &str) -> Result<Option<String>, String> {
    let Some(raw) = raw_read(name)? else {
        return Ok(None);
    };
    if !raw.starts_with(PREFIX) {
        return Ok(Some(raw));
    }
    let (id, n) = manifest(&raw).ok_or("Saved credential manifest is invalid")?;
    let mut encoded = String::new();
    for i in 0..n {
        encoded.push_str(
            &raw_read(&format!("{name}:{id}:{i}"))?
                .ok_or("Saved credential is incomplete; reconnect your account")?,
        );
    }
    let bytes = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| "Saved credential is invalid")?;
    Ok(Some(
        String::from_utf8(bytes).map_err(|_| "Saved credential text is invalid")?,
    ))
}
pub fn write(name: &str, value: Option<&str>) -> Result<(), String> {
    let previous = raw_read(name)?;
    let Some(value) = value else {
        raw_write(name, None)?;
        if let Some(old) = previous {
            remove_chunks(name, &old);
        }
        return Ok(());
    };
    if value.len() > 300000 {
        return Err("Credential record is too large".into());
    }
    if value.len() <= 900 {
        raw_write(name, Some(value))?;
    } else {
        let encoded = URL_SAFE_NO_PAD.encode(value);
        let id = uuid::Uuid::new_v4().to_string();
        let chunks = encoded.as_bytes().chunks(900).collect::<Vec<_>>();
        for (i, chunk) in chunks.iter().enumerate() {
            let text = std::str::from_utf8(chunk).unwrap();
            if let Err(e) = raw_write(&format!("{name}:{id}:{i}"), Some(text)) {
                remove_chunks(name, &format!("{PREFIX}{id}:{}", chunks.len()));
                return Err(e);
            }
        }
        let index = format!("{PREFIX}{id}:{}", chunks.len());
        if let Err(e) = raw_write(name, Some(&index)) {
            remove_chunks(name, &index);
            return Err(e);
        }
    }
    if let Some(old) = previous {
        remove_chunks(name, &old);
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    #[test]
    #[ignore = "Disposable credential subprocess used by persistence test"]
    fn credential_process_probe() {
        let Ok(name) = std::env::var("CHATNOTE_TEST_CREDENTIAL") else {
            return;
        };
        assert!(name.starts_with("test-persistence-"));
        uuid::Uuid::parse_str(name.strip_prefix("test-persistence-").unwrap()).unwrap();
        let text = "synthetic-session-data".repeat(250);
        match std::env::var("CHATNOTE_TEST_OPERATION").unwrap().as_str() {
            "write" => write(&name, Some(&text)).unwrap(),
            "read" => assert!(read(&name).unwrap().as_deref() == Some(text.as_str())),
            _ => panic!("Invalid test operation"),
        }
    }
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    #[test]
    #[ignore = "Verifies disposable credential across separate native processes"]
    fn credential_survives_separate_processes() {
        let name = format!("test-persistence-{}", uuid::Uuid::new_v4());
        let executable = std::env::current_exe().unwrap();
        let invoke = |operation: &str| {
            std::process::Command::new(&executable)
                .args([
                    "--exact",
                    "vault::tests::credential_process_probe",
                    "--ignored",
                ])
                .env("CHATNOTE_TEST_CREDENTIAL", &name)
                .env("CHATNOTE_TEST_OPERATION", operation)
                .output()
                .unwrap()
                .status
                .success()
        };
        let written = invoke("write");
        let read = written && invoke("read");
        write(&name, None).unwrap();
        assert!(
            written && read,
            "The platform vault did not preserve the synthetic credential between processes"
        );
    }
    #[test]
    fn invalid_manifests_rejected() {
        assert!(manifest("chatnote-vault-v1:bad:999").is_none());
        assert!(manifest(&format!("{PREFIX}{}:0", uuid::Uuid::new_v4())).is_none());
    }
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    #[test]
    #[ignore = "Writes a disposable entry to the OS credential vault; run explicitly"]
    fn long_credential_round_trip() {
        let name = format!("test-{}", uuid::Uuid::new_v4());
        let text = "密钥🧠".repeat(1200);
        write(&name, Some(&text)).unwrap();
        assert_eq!(read(&name).unwrap(), Some(text));
        write(&name, Some("replacement")).unwrap();
        assert_eq!(read(&name).unwrap(), Some("replacement".into()));
        write(&name, None).unwrap();
        assert_eq!(read(&name).unwrap(), None);
    }
}
