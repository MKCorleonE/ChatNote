use crate::{auth, network, Runtime};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;

#[derive(Clone, Deserialize, Serialize)]
pub struct Attachment {
    pub id: String,
    pub name: String,
    pub mime: String,
    pub size: usize,
    pub kind: String,
}
#[derive(Deserialize, Serialize)]
pub struct StoredAttachment {
    pub attachment: Attachment,
    pub data: String,
}
pub fn validate(a: &Attachment, data: &str) -> Result<Vec<u8>, String> {
    uuid::Uuid::parse_str(&a.id).map_err(|_| "Invalid attachment ID")?;
    let ext = a.name.rsplit('.').next().unwrap_or("").to_lowercase();
    let expected = match ext.as_str() {
        "png" => ("image", "image/png"),
        "jpg" | "jpeg" => ("image", "image/jpeg"),
        "webp" => ("image", "image/webp"),
        "gif" => ("image", "image/gif"),
        "pdf" => ("document", "application/pdf"),
        "docx" => (
            "document",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        "pptx" => (
            "document",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ),
        "xlsx" => (
            "document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        "txt" | "md" | "csv" | "tsv" | "json" | "xml" | "html" | "css" | "js" | "ts" | "tsx"
        | "jsx" | "py" | "rs" | "sql" | "yaml" | "yml" | "log" | "tex" => ("text", "text/plain"),
        _ => return Err("Unsupported attachment type".into()),
    };
    if a.name.len() > 720
        || a.name.chars().any(char::is_control)
        || a.kind != expected.0
        || a.mime != expected.1
        || a.size == 0
        || a.size > 10 * 1024 * 1024
        || data.len() > 14 * 1024 * 1024
    {
        return Err("Invalid attachment. Choose a supported file under 10 MB.".into());
    }
    let bytes = STANDARD
        .decode(data)
        .map_err(|_| "Invalid attachment encoding")?;
    if bytes.len() != a.size {
        return Err("Attachment size mismatch".into());
    }
    if a.kind == "text" {
        std::str::from_utf8(&bytes).map_err(|_| "Choose a UTF-8 text file")?;
    }
    Ok(bytes)
}
#[tauri::command]
pub fn store_attachment(
    state: State<Runtime>,
    attachment: Attachment,
    data: String,
) -> Result<(), String> {
    validate(&attachment, &data)?;
    let db = state.db.lock().map_err(|_| "Database lock failed")?;
    let metadata = serde_json::to_string(&attachment).map_err(|_| "Invalid attachment")?;
    // IDs are immutable: imported backups cannot replace a different local file.
    db.execute(
        "INSERT OR IGNORE INTO attachments(id,metadata,data) VALUES(?1,?2,?3)",
        [&attachment.id, &metadata, &data],
    )
    .map_err(|_| "Could not save attachment")?;
    let existing: (String, String) = db
        .query_row(
            "SELECT metadata,data FROM attachments WHERE id=?1",
            [&attachment.id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| "Could not read attachment")?;
    if existing != (metadata, data) {
        return Err("Attachment ID conflict. The local file was preserved.".into());
    }
    Ok(())
}
pub fn load(state: &Runtime, id: &str) -> Result<StoredAttachment, String> {
    let db = state.db.lock().map_err(|_| "Database lock failed")?;
    let (metadata, data): (String, String) = db
        .query_row(
            "SELECT metadata,data FROM attachments WHERE id=?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| "A local attachment is missing. Attach the original file again.")?;
    Ok(StoredAttachment {
        attachment: serde_json::from_str(&metadata).map_err(|_| "Invalid saved attachment")?,
        data,
    })
}
#[tauri::command]
pub fn read_attachment(state: State<Runtime>, id: String) -> Result<StoredAttachment, String> {
    load(&state, &id)
}

pub fn materialize(
    input: &[Value],
    provider: &str,
    image_input: bool,
    state: &Runtime,
) -> Result<Vec<Value>, String> {
    let mut total = 0;
    let mut count = 0;
    let compatible = provider == "compatible" || provider == "qwen-document";
    input.iter().map(|item| {
        let role = item["role"].as_str().ok_or("Invalid message role")?;
        if !matches!(role,"user"|"assistant") { return Err("Invalid message role".into()); }
        let text = item["content"].as_str().ok_or("Invalid message text")?;
        let refs = item.get("attachments").and_then(Value::as_array);
        if refs.is_none_or(|a| a.is_empty()) { return Ok(json!({"role":role,"content":text})); }
        if role != "user" { return Err("Attachments belong to user messages".into()); }
        let mut parts = vec![if compatible {json!({"type":"text","text":text})}else{json!({"type":"input_text","text":text})}];
        for reference in refs.unwrap() {
            let a: Attachment = serde_json::from_value(reference.clone()).map_err(|_| "Invalid attachment metadata")?;
            let stored = load(state,&a.id)?;
            if serde_json::to_value(&stored.attachment).unwrap() != *reference { return Err("Attachment metadata mismatch".into()); }
            let bytes = validate(&a,&stored.data)?;
            count += 1; total += a.size;
            if total > 20 * 1024 * 1024 || count > 8 { return Err("Use up to 8 attachments and 20 MB per request.".into()); }
            match a.kind.as_str() {
                "text" => {
                    let content = format!("Attached file: {}\n<attachment-content>\n{}\n</attachment-content>",a.name,std::str::from_utf8(&bytes).map_err(|_| "Choose a UTF-8 text file")?);
                    parts.push(if compatible {json!({"type":"text","text":content})}else{json!({"type":"input_text","text":content})});
                }
                "image" if image_input => { let data = format!("data:{};base64,{}",a.mime,stored.data); parts.push(if compatible {json!({"type":"image_url","image_url":{"url":data}})}else{json!({"type":"input_image","image_url":data})}); }
                "image" => return Err("Choose a vision model or enable image input for this connection.".into()),
                "document" if provider == "openai" => parts.push(json!({"type":"input_file","filename":a.name,"file_data":format!("data:{};base64,{}",a.mime,stored.data)})),
                "document" if provider == "qwen-document" => parts.push(json!({"type":"chatnote_document","id":a.id})),
                _ => return Err("This connection does not support PDF or Office documents. Choose OpenAI API or Qwen-Long / Qwen-Doc, or attach UTF-8 text.".into()),
            }
        }
        if compatible && parts.iter().all(|part|part["type"]=="text") {
            return Ok(json!({"role":role,"content":parts.iter().filter_map(|part|part["text"].as_str()).collect::<Vec<_>>().join("\n\n")}));
        }
        Ok(json!({"role":role,"content":parts}))
    }).collect()
}
pub fn qwen_documents(base: &str, model: &str) -> bool {
    qwen_endpoint(base)
        && (model == "qwen-long"
            || model.starts_with("qwen-long-")
            || model == "qwen-doc-turbo"
            || model.starts_with("qwen-doc-turbo-"))
}
pub async fn upload_documents(
    input: &mut [Value],
    state: &Runtime,
    base: &str,
    model: &str,
    secret: &str,
    uploaded: &mut Vec<String>,
    cancel: &tokio::sync::watch::Receiver<bool>,
) -> Result<(), String> {
    let mut cache = std::collections::HashMap::<String, String>::new();
    for item in input.iter_mut() {
        let Some(parts) = item["content"].as_array_mut() else {
            continue;
        };
        let mut file_ids = Vec::new();
        for part in parts.iter_mut() {
            if part["type"] != "chatnote_document" {
                continue;
            }
            if *cancel.borrow() {
                return Err("Stopped".into());
            }
            let id = part["id"]
                .as_str()
                .ok_or("Invalid document reference")?
                .to_owned();
            let stored = load(state, &id)?;
            if stored.attachment.name.to_lowercase().ends_with(".pptx")
                && model.starts_with("qwen-long")
            {
                return Err(
                    "Qwen-Long does not accept PPTX. Choose Qwen-Doc or convert it to PDF.".into(),
                );
            }
            let file_id = if let Some(existing) = cache.get(&id) {
                existing.clone()
            } else {
                let bytes = validate(&stored.attachment, &stored.data)?;
                let (boundary, body) = document_multipart(&stored.attachment, &bytes);
                let response = network::send_request(
                    network::client()?
                        .post(format!("{base}/files"))
                        .bearer_auth(secret)
                        .header(
                            "Content-Type",
                            format!("multipart/form-data; boundary={boundary}"),
                        )
                        .body(body),
                )
                .await
                .map_err(|e| network::transport_error(&e, "Document upload failed"))?;
                let result: Value = network::checked(response, secret)
                    .await?
                    .json()
                    .await
                    .map_err(|_| "Invalid document upload response")?;
                let file_id = result["id"]
                    .as_str()
                    .filter(|id| {
                        id.starts_with("file-")
                            && id.len() < 200
                            && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
                    })
                    .ok_or("Invalid uploaded file ID")?
                    .to_owned();
                uploaded.push(file_id.clone());
                cache.insert(id, file_id.clone());
                file_id
            };
            file_ids.push(file_id);
            *part = json!({"type":"text","text":format!("Attached document: {}",stored.attachment.name)});
        }
        if !file_ids.is_empty() {
            item["chatnote_file_ids"] = json!(file_ids);
        }
    }
    Ok(())
}
pub fn prepare_qwen_input(input: Vec<Value>) -> Vec<Value> {
    let mut references = Vec::new();
    let mut output = Vec::new();
    for mut item in input {
        if let Some(ids) = item
            .as_object_mut()
            .and_then(|o| o.remove("chatnote_file_ids"))
        {
            for id in ids.as_array().into_iter().flatten() {
                let reference = json!({"role":"system","content":format!("fileid://{}",id.as_str().unwrap_or(""))});
                if !references.contains(&reference) {
                    references.push(reference);
                }
            }
        }
        if let Some(parts) = item["content"].as_array() {
            if parts.iter().all(|part| part["type"] == "text") {
                item["content"] = json!(parts
                    .iter()
                    .filter_map(|part| part["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("\n\n"));
            }
        }
        output.push(item);
    }
    references.extend(output);
    references
}

pub async fn clean_documents(base: &str, secret: &str, uploaded: &[String]) -> bool {
    if uploaded.is_empty() {
        return true;
    }
    let Ok(client) = network::client() else {
        return false;
    };
    let outcomes=futures_util::future::join_all(uploaded.iter().map(|id|{
        let pending=client.delete(format!("{base}/files/{id}")).bearer_auth(secret).timeout(std::time::Duration::from_secs(10)).send();
        async move {matches!(pending.await,Ok(response) if response.status().is_success()||response.status()==404)}
    })).await;
    outcomes.into_iter().all(|success| success)
}

fn document_multipart(a: &Attachment, bytes: &[u8]) -> (String, Vec<u8>) {
    let boundary = format!("ChatNote{}", uuid::Uuid::new_v4().simple());
    let extension = a.name.rsplit('.').next().unwrap_or("pdf").to_lowercase();
    let mut body=format!("--{boundary}\r\nContent-Disposition: form-data; name=\"purpose\"\r\n\r\nfile-extract\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"attachment.{extension}\"\r\nContent-Type: {}\r\n\r\n",a.mime).into_bytes();
    body.extend_from_slice(bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    (boundary, body)
}

#[tauri::command]
pub async fn transcribe(
    provider: String,
    endpoint: String,
    profile_id: String,
    model: String,
    data: String,
    mime: String,
) -> Result<String, String> {
    if !matches!(provider.as_str(), "openai" | "compatible") {
        return Err("Speech transcription needs an API-key connection; ChatGPT sign-in does not provide this endpoint.".into());
    }
    if model.trim().is_empty() || model.len() > 150 || data.len() > 34 * 1024 * 1024 {
        return Err("Invalid speech transcription request".into());
    }
    let extension = match mime.split(';').next().unwrap_or("") {
        "audio/webm" => "webm",
        "audio/mp4" => "mp4",
        "audio/ogg" => return Err("Choose a WebM or MP4 recording".into()),
        "audio/wav" => "wav",
        _ => return Err("Unsupported recording format".into()),
    };
    let bytes = STANDARD.decode(&data).map_err(|_| "Invalid recording")?;
    if bytes.is_empty() || bytes.len() > 25 * 1024 * 1024 {
        return Err("Recording must be under 25 MB".into());
    }
    let base = network::endpoint(&provider, &endpoint)?;
    let secret = auth::credential(&provider, &base, Some(&profile_id)).await?;
    if model.chars().any(char::is_control) {
        return Err("Invalid transcription model".into());
    }
    let qwen = qwen_endpoint(&base)
        && model.starts_with("qwen3-asr-flash")
        && !model.contains("filetrans")
        && !model.contains("realtime");
    if qwen && bytes.len() > 10 * 1024 * 1024 {
        return Err("Qwen recordings must be under 10 MB and 5 minutes.".into());
    }
    let (boundary, body) =
        audio_multipart(&model, &bytes, extension, mime.split(';').next().unwrap());
    let request = if qwen {
        network::client()?
            .post(format!("{base}/chat/completions"))
            .bearer_auth(&secret)
            .json(&qwen_audio_body(
                &model,
                &data,
                mime.split(';').next().unwrap(),
            ))
    } else {
        network::client()?
            .post(format!("{base}/audio/transcriptions"))
            .bearer_auth(&secret)
            .header(
                "Content-Type",
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(body)
    };
    let response = network::send_request(request)
        .await
        .map_err(|e| network::transport_error(&e, "Speech transcription failed"))?;
    let result: Value = network::checked(response, &secret)
        .await?
        .json()
        .await
        .map_err(|_| "Invalid transcription response")?;
    let text = (if qwen {
        &result["choices"][0]["message"]["content"]
    } else {
        &result["text"]
    })
    .as_str()
    .ok_or("The provider did not return a transcript")?
    .trim();
    if text.is_empty() || text.len() > 200_000 {
        return Err("No speech was recognized. Try recording again.".into());
    }
    Ok(text.to_owned())
}
pub fn qwen_endpoint(base: &str) -> bool {
    url::Url::parse(base)
        .ok()
        .and_then(|u| u.host_str().map(str::to_owned))
        .is_some_and(|host| {
            host == "dashscope.aliyuncs.com"
                || host == "dashscope-intl.aliyuncs.com"
                || host.ends_with(".maas.aliyuncs.com")
        })
}
fn qwen_audio_body(model: &str, data: &str, mime: &str) -> Value {
    json!({"model":model,"messages":[{"role":"user","content":[{"type":"input_audio","input_audio":{"data":format!("data:{mime};base64,{data}")}}]}],"stream":false,"asr_options":{"enable_itn":false}})
}
fn audio_multipart(model: &str, bytes: &[u8], extension: &str, mime: &str) -> (String, Vec<u8>) {
    let boundary = format!("ChatNote{}", uuid::Uuid::new_v4().simple());
    let mut body=format!("--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n{model}\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"response_format\"\r\n\r\njson\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"recording.{extension}\"\r\nContent-Type: {mime}\r\n\r\n").into_bytes();
    body.extend_from_slice(bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    (boundary, body)
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, sync::Mutex};
    #[tokio::test]
    async fn document_upload_reference_and_cleanup_preserve_the_local_file() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}/v1", listener.local_addr().unwrap());
        let server = tokio::spawn(async move {
            for method in ["POST /v1/files ", "DELETE /v1/files/file-fe-test "] {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut data = Vec::new();
                let mut chunk = [0u8; 4096];
                loop {
                    let count = socket.read(&mut chunk).await.unwrap();
                    assert!(count > 0);
                    data.extend_from_slice(&chunk[..count]);
                    if let Some(end) = data.windows(4).position(|w| w == b"\r\n\r\n") {
                        let header = String::from_utf8_lossy(&data[..end]);
                        let length = header
                            .lines()
                            .find_map(|line| {
                                line.to_lowercase()
                                    .strip_prefix("content-length:")
                                    .and_then(|n| n.trim().parse::<usize>().ok())
                            })
                            .unwrap_or(0);
                        if data.len() >= end + 4 + length {
                            break;
                        }
                    }
                }
                let request = String::from_utf8_lossy(&data);
                assert!(request.starts_with(method));
                if method.starts_with("POST") {
                    assert!(request.contains("file-extract"));
                    assert!(request.contains("attachment.pdf"));
                    assert!(request.contains("%PDF"));
                }
                let body = if method.starts_with("POST") {
                    r#"{"id":"file-fe-test"}"#
                } else {
                    r#"{"deleted":true}"#
                };
                socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).as_bytes()).await.unwrap();
            }
        });
        let state = runtime();
        let a = save(&state, "lesson.pdf", "application/pdf", "document", b"%PDF");
        let original = vec![json!({"role":"user","content":"Explain this file","attachments":[a]})];
        let mut input = materialize(&original, "qwen-document", false, &state).unwrap();
        let (_cancel_tx, cancel) = tokio::sync::watch::channel(false);
        let mut uploaded = Vec::new();
        tokio::time::timeout(
            std::time::Duration::from_secs(10),
            upload_documents(
                &mut input,
                &state,
                &base,
                "qwen-long",
                "synthetic-test-secret",
                &mut uploaded,
                &cancel,
            ),
        )
        .await
        .unwrap()
        .unwrap();
        let request = prepare_qwen_input(input);
        assert_eq!(request[0]["content"], "fileid://file-fe-test");
        assert!(request[1]["content"]
            .as_str()
            .unwrap()
            .contains("Explain this file"));
        assert!(request[1].get("attachments").is_none());
        assert!(clean_documents(&base, "synthetic-test-secret", &uploaded).await);
        server.await.unwrap();
        assert_eq!(load(&state, &a.id).unwrap().data, STANDARD.encode(b"%PDF"));
    }
    #[test]
    fn qwen_media_routes_and_payloads_are_provider_specific() {
        assert!(qwen_documents(
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "qwen-long"
        ));
        assert!(qwen_documents(
            "https://space.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
            "qwen-doc-turbo"
        ));
        assert!(!qwen_documents("https://api.deepseek.com", "qwen-long"));
        assert!(!qwen_documents(
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "qwen-plus"
        ));
        let body = qwen_audio_body("qwen3-asr-flash", "YWJj", "audio/webm");
        assert_eq!(
            body["messages"][0]["content"][0]["input_audio"]["data"],
            "data:audio/webm;base64,YWJj"
        );
        assert_eq!(body["stream"], false);
        let input = prepare_qwen_input(vec![
            json!({"role":"user","content":"question","chatnote_file_ids":["file-fe-123"]}),
            json!({"role":"assistant","content":"answer"}),
        ]);
        assert_eq!(
            input[0],
            json!({"role":"system","content":"fileid://file-fe-123"})
        );
        assert!(input[1].get("chatnote_file_ids").is_none());
        assert_eq!(input[2]["content"], "answer");
    }
    #[test]
    fn document_upload_multipart_uses_a_safe_filename_and_exact_bytes() {
        let a = Attachment {
            id: uuid::Uuid::new_v4().to_string(),
            name: "unsafe\".pdf".into(),
            mime: "application/pdf".into(),
            size: 4,
            kind: "document".into(),
        };
        let (boundary, body) = document_multipart(&a, b"%PDF");
        let text = String::from_utf8_lossy(&body);
        assert!(text.contains("file-extract"));
        assert!(text.contains("filename=\"attachment.pdf\""));
        assert!(!text.contains("unsafe"));
        assert!(text.ends_with(&format!("--{boundary}--\r\n")));
    }
    fn runtime() -> Runtime {
        Runtime {
            db: Mutex::new(
                crate::storage::open_database(std::path::Path::new(":memory:")).unwrap(),
            ),
            jobs: Mutex::new(HashMap::new()),
            login: tokio::sync::Mutex::new(()),
            login_cancel: Mutex::new(None),
        }
    }
    fn save(state: &Runtime, name: &str, mime: &str, kind: &str, bytes: &[u8]) -> Attachment {
        let a = Attachment {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.into(),
            mime: mime.into(),
            kind: kind.into(),
            size: bytes.len(),
        };
        let data = STANDARD.encode(bytes);
        validate(&a, &data).unwrap();
        state
            .db
            .lock()
            .unwrap()
            .execute(
                "INSERT INTO attachments(id,metadata,data) VALUES(?1,?2,?3)",
                [&a.id, &serde_json::to_string(&a).unwrap(), &data],
            )
            .unwrap();
        a
    }
    #[test]
    fn provider_parts_preserve_files_and_text_without_local_paths() {
        let state = runtime();
        let image = save(&state, "diagram.png", "image/png", "image", b"synthetic");
        let text = save(
            &state,
            "notes.txt",
            "text/plain",
            "text",
            "中文学习笔记".as_bytes(),
        );
        let pdf = save(
            &state,
            "lesson.pdf",
            "application/pdf",
            "document",
            b"%PDF-synthetic",
        );
        let input = vec![json!({"role":"user","content":"Explain","attachments":[image,text,pdf]})];
        let result = materialize(&input, "openai", true, &state).unwrap();
        assert_eq!(result[0]["content"][1]["type"], "input_image");
        assert!(result[0]["content"][2]["text"]
            .as_str()
            .unwrap()
            .contains("中文学习笔记"));
        assert_eq!(result[0]["content"][3]["type"], "input_file");
        assert!(materialize(&input, "compatible", true, &state).is_err());
        assert!(materialize(&input, "chatgpt", true, &state).is_err());
        let compatible = materialize(
            &[json!({"role":"user","content":"Explain","attachments":[image]})],
            "compatible",
            true,
            &state,
        )
        .unwrap();
        assert_eq!(compatible[0]["content"][1]["type"], "image_url");
        assert!(materialize(
            &[json!({"role":"user","content":"Explain","attachments":[image]})],
            "compatible",
            false,
            &state
        )
        .is_err());
        assert!(materialize(
            &[json!({"role":"assistant","content":"Explain","attachments":[image]})],
            "openai",
            true,
            &state
        )
        .is_err());
    }
    #[test]
    fn missing_or_altered_attachments_are_rejected_before_any_network_request() {
        let state = runtime();
        let mut a = save(&state, "notes.txt", "text/plain", "text", b"learning");
        a.name = "different.txt".into();
        assert!(materialize(
            &[json!({"role":"user","content":"Explain","attachments":[a]})],
            "openai",
            true,
            &state
        )
        .is_err());
        a.id = uuid::Uuid::new_v4().to_string();
        assert!(load(&state, &a.id).is_err());
        a.size = 11 * 1024 * 1024;
        assert!(validate(&a, "eA==").is_err());
    }
    #[test]
    fn transcription_multipart_keeps_binary_recording_intact() {
        let bytes = [0, 255, 10, 13, 42];
        let (boundary, body) = audio_multipart("gpt-transcribe", &bytes, "webm", "audio/webm");
        assert!(body.windows(bytes.len()).any(|part| part == bytes));
        let text = String::from_utf8_lossy(&body);
        assert!(text.contains("name=\"model\"\r\n\r\ngpt-transcribe"));
        assert!(text.contains("filename=\"recording.webm\""));
        assert!(text.ends_with(&format!("--{boundary}--\r\n")));
    }
}
