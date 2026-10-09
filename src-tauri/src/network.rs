use crate::{auth, Runtime};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{ipc::Channel, State};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    request_id: String,
    provider: String,
    endpoint: String,
    model: String,
    input: Vec<Value>,
    instructions: String,
    #[serde(default)]
    profile_id: Option<String>,
    #[serde(default)]
    reasoning_effort: Option<String>,
}
#[derive(Clone, Serialize)]
pub struct StreamEvent {
    r#type: &'static str,
    text: Option<String>,
    error: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    id: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    reasoning_efforts: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    default_reasoning_effort: Option<String>,
}
fn valid_effort(value: &str) -> bool {
    matches!(
        value,
        "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "ultra"
    )
}
fn reasoning_levels(model: &Value) -> Option<Vec<String>> {
    model["supported_reasoning_levels"]
        .as_array()
        .map(|levels| {
            levels
                .iter()
                .filter_map(|level| level["effort"].as_str().or(level.as_str()))
                .filter(|effort| valid_effort(effort))
                .map(str::to_owned)
                .collect()
        })
}
fn request_body(request: &Request) -> Result<Value, String> {
    let compatible = request.provider == "compatible";
    let mut body = if compatible {
        let mut messages = vec![json!({"role":"system","content":request.instructions})];
        messages.extend(request.input.clone());
        json!({"model":request.model,"messages":messages,"stream":true})
    } else {
        json!({"model":request.model,"input":request.input,"instructions":request.instructions,"stream":true,"store":false})
    };
    if let Some(effort) = &request.reasoning_effort {
        if compatible || !valid_effort(effort) {
            return Err("This connection does not support the selected reasoning effort".into());
        }
        body["reasoning"] = json!({"effort":effort});
    }
    Ok(body)
}
pub fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(20))
        .timeout(std::time::Duration::from_secs(240))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(concat!("ChatNote/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| "Could not initialize network client".into())
}
fn connection_cause(error: &reqwest::Error) -> String {
    use std::error::Error;
    let mut parts = Vec::new();
    let mut source = error.source();
    while let Some(cause) = source {
        parts.push(cause.to_string().to_lowercase());
        source = cause.source();
    }
    parts.join(" ")
}
pub(crate) fn transport_error(error: &reqwest::Error, message: &str) -> String {
    let cause = connection_cause(error);
    let code = if cause.contains("certificate") || cause.contains("unknownissuer") {
        "TLS_CERTIFICATE_ERROR"
    } else if error.is_timeout() {
        "CONNECTION_TIMEOUT"
    } else if cause.contains("dns error") {
        "DNS_LOOKUP_FAILED"
    } else if cause.contains("tls handshake eof") || cause.contains("unexpected eof") {
        "TLS_CONNECTION_CLOSED"
    } else {
        "TRANSPORT_ERROR"
    };
    // Only fixed diagnostic codes leave the backend, never URLs, headers or raw causes.
    format!("{message} [{code}]")
}
pub(crate) async fn send_request(
    mut request: reqwest::RequestBuilder,
) -> Result<reqwest::Response, reqwest::Error> {
    for delay in [Some(350), Some(1000), None] {
        let next = request.try_clone();
        match request.send().await {
            Err(error)
                if error.is_connect()
                    && !connection_cause(&error).contains("certificate")
                    && !connection_cause(&error).contains("unknownissuer")
                    && next.is_some()
                    && delay.is_some() =>
            {
                // Connect errors occur before an HTTP request is sent. Never replay an
                // HTTP response, a body/stream error or an ambiguous post-send timeout.
                tokio::time::sleep(std::time::Duration::from_millis(delay.unwrap())).await;
                request = next.unwrap();
            }
            result => return result,
        }
    }
    unreachable!("the final attempt always returns")
}
pub fn endpoint(provider: &str, input: &str) -> Result<String, String> {
    if provider == "openai" || provider == "chatgpt" {
        return Ok("https://api.openai.com/v1".into());
    }
    if provider != "compatible" {
        return Err("Unknown model provider".into());
    }
    let raw = input.trim().trim_end_matches('/');
    let url = url::Url::parse(raw).map_err(|_| "Enter a valid API base URL")?;
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("The API URL must not contain credentials, a query or a fragment".into());
    }
    if url.scheme() != "https"
        && !(url.scheme() == "http"
            && matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "[::1]")))
    {
        return Err("Use HTTPS for your provider, or HTTP only for a local model server".into());
    }
    Ok(raw.into())
}
pub fn redact(text: &str, credential: &str) -> String {
    if credential.is_empty() {
        return text.chars().take(700).collect();
    }
    text.replace(credential, "[redacted]")
        .chars()
        .take(700)
        .collect()
}
pub(crate) fn provider_error(status: u16, data: &Value, secret: &str) -> String {
    let code = data["error"]["code"]
        .as_str()
        .or(data["code"].as_str())
        .unwrap_or("");
    let message = data["error"]["message"]
        .as_str()
        .or(data["detail"].as_str())
        .or(data["message"].as_str())
        .unwrap_or(
            "The provider rejected this request. Check your connection, model and usage limits.",
        );
    format!(
        "HTTP {status} [{}] · {}",
        redact(code, secret),
        redact(message, secret)
    )
}
pub(crate) async fn checked(
    response: reqwest::Response,
    secret: &str,
) -> Result<reqwest::Response, String> {
    if response.status().is_success() {
        return Ok(response);
    }
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    let data: Value = serde_json::from_str(&body).unwrap_or_default();
    Err(provider_error(status.as_u16(), &data, secret))
}
#[tauri::command]
pub async fn list_models(
    provider: String,
    endpoint: String,
    profile_id: Option<String>,
) -> Result<Vec<Model>, String> {
    let base = self::endpoint(&provider, &endpoint)?;
    let secret = auth::credential(&provider, &base, profile_id.as_deref()).await?;
    let response = checked(
        send_request(
            client()?
                .get(format!("{base}/models"))
                .bearer_auth(&secret)
                .timeout(std::time::Duration::from_secs(20)),
        )
        .await
        .map_err(|error| {
            transport_error(
                &error,
                "Could not connect to the model provider. Check your network and API URL.",
            )
        })?,
        &secret,
    )
    .await?;
    let data: Value = response.json().await.map_err(|_| "Invalid model catalog")?;
    let result = if provider == "chatgpt" {
        data["models"]
            .as_array()
            .ok_or("The ChatGPT account did not return a model catalog")?
            .iter()
            .filter(|m| m["visibility"] == "list")
            .take(1000)
            .filter_map(|m| {
                Some(Model {
                    id: m["slug"].as_str()?.into(),
                    name: m["display_name"].as_str()?.into(),
                    reasoning_efforts: reasoning_levels(m),
                    default_reasoning_effort: m["default_reasoning_level"]
                        .as_str()
                        .filter(|e| valid_effort(e))
                        .map(str::to_owned),
                })
            })
            .collect()
    } else {
        data["data"]
            .as_array()
            .ok_or("The provider did not return a model catalog")?
            .iter()
            .take(1000)
            .filter_map(|m| {
                Some(Model {
                    id: m["id"].as_str()?.into(),
                    name: m["id"].as_str()?.into(),
                    reasoning_efforts: None,
                    default_reasoning_effort: None,
                })
            })
            .collect()
    };
    Ok(result)
}
// Parse UTF-8 only after complete SSE frames; a network chunk may split a multibyte character.
pub struct Sse {
    buffer: Vec<u8>,
}
impl Sse {
    pub fn new() -> Self {
        Self { buffer: Vec::new() }
    }
    pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<String>, String> {
        self.buffer.extend_from_slice(bytes);
        if self.buffer.len() > 4_000_000 {
            return Err("The provider sent an oversized stream event".into());
        }
        let mut frames = Vec::new();
        loop {
            let lf = self.buffer.windows(2).position(|p| p == b"\n\n");
            let crlf = self.buffer.windows(4).position(|p| p == b"\r\n\r\n");
            let boundary = match (lf, crlf) {
                (Some(a), Some(b)) => {
                    if a < b {
                        Some((a, 2))
                    } else {
                        Some((b, 4))
                    }
                }
                (Some(a), None) => Some((a, 2)),
                (None, Some(b)) => Some((b, 4)),
                _ => None,
            };
            let Some((end, len)) = boundary else { break };
            let block = String::from_utf8(self.buffer.drain(..end + len).collect())
                .map_err(|_| "The stream contained invalid text")?;
            let data = block
                .lines()
                .filter_map(|line| {
                    line.strip_prefix("data:")
                        .map(|s| s.strip_prefix(' ').unwrap_or(s))
                })
                .collect::<Vec<_>>()
                .join("\n");
            if !data.is_empty() {
                frames.push(data);
            }
        }
        Ok(frames)
    }
}
pub enum Parsed {
    Delta(String),
    Done,
    Error(String),
    Ignore,
}
pub fn parse(data: &str, compatible: bool) -> Result<Parsed, String> {
    if data == "[DONE]" {
        return Ok(if compatible {
            Parsed::Done
        } else {
            Parsed::Ignore
        });
    }
    let v: Value = serde_json::from_str(data).map_err(|_| "Invalid stream event from provider")?;
    if compatible {
        if v.get("error").is_some() {
            return Ok(Parsed::Error(
                v["error"]["message"]
                    .as_str()
                    .unwrap_or("Provider request failed")
                    .into(),
            ));
        }
        if let Some(reason) = v["choices"][0]["finish_reason"].as_str() {
            if reason != "stop" {
                return Ok(Parsed::Error(format!(
                    "The provider ended this answer with {reason}. Partial text was preserved."
                )));
            }
        }
        if let Some(text) = v["choices"][0]["delta"]["content"].as_str() {
            return Ok(Parsed::Delta(text.into()));
        }
        return Ok(Parsed::Ignore);
    }
    Ok(match v["type"].as_str().unwrap_or("") {
        "response.output_text.delta" | "response.refusal.delta" => {
            Parsed::Delta(v["delta"].as_str().unwrap_or("").into())
        }
        "response.completed" => Parsed::Done,
        "response.failed" | "response.incomplete" => Parsed::Error(format!(
            "Provider [{}] · {}",
            v["response"]["error"]["code"].as_str().unwrap_or(""),
            v["response"]["error"]["message"]
                .as_str()
                .or(v["response"]["incomplete_details"]["reason"].as_str())
                .unwrap_or("The provider did not complete the response")
        )),
        "error" => Parsed::Error(format!(
            "Provider [{}] · {}",
            v["code"].as_str().unwrap_or(""),
            v["message"].as_str().unwrap_or("Provider stream error")
        )),
        _ => Parsed::Ignore,
    })
}
#[tauri::command]
pub fn cancel_generation(state: State<Runtime>, request_id: String) -> Result<(), String> {
    if let Some(tx) = state
        .jobs
        .lock()
        .map_err(|_| "Request lock failed")?
        .get(&request_id)
    {
        let _ = tx.send(true);
    }
    Ok(())
}
#[tauri::command]
pub async fn generate(
    state: State<'_, Runtime>,
    request: Request,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    if request.model.trim().is_empty()
        || request.input.is_empty()
        || request.input.len() > 10000
        || request.input.iter().any(|v| {
            !matches!(v["role"].as_str(), Some("user" | "assistant")) || !v["content"].is_string()
        })
    {
        return Err("Invalid model request".into());
    }
    let base = endpoint(&request.provider, &request.endpoint)?;
    let body = request_body(&request)?;
    let (cancel_tx, mut cancel_rx) = tokio::sync::watch::channel(false);
    {
        let mut jobs = state.jobs.lock().map_err(|_| "Request lock failed")?;
        if !jobs.is_empty() {
            return Err("Another answer is still generating".into());
        }
        jobs.insert(request.request_id.clone(), cancel_tx);
    }
    let result=async {
        let secret=auth::credential(&request.provider,&base,request.profile_id.as_deref()).await?;let compatible=request.provider=="compatible";
        let pending=send_request(client()?.post(format!("{base}/{}",if compatible{"chat/completions"}else{"responses"})).bearer_auth(&secret).json(&body));
        let response=tokio::select!{r=pending=>r.map_err(|error|transport_error(&error,"Could not connect to the model provider. Check your network."))?, _=cancel_rx.changed()=>return Ok(())};
        let response=checked(response,&secret).await?;let mut stream=response.bytes_stream();let mut parser=Sse::new();let mut complete=false;
        loop{let chunk=tokio::select!{chunk=stream.next()=>chunk,_=cancel_rx.changed()=>return Ok(())};let Some(chunk)=chunk else{break};for frame in parser.push(&chunk.map_err(|_|"The network connection was interrupted. Your partial answer was preserved.")?)?{match parse(&frame,compatible)?{Parsed::Delta(text)=>on_event.send(StreamEvent{r#type:"delta",text:Some(text),error:None}).map_err(|_|"The app window closed")?,Parsed::Done=>{complete=true;on_event.send(StreamEvent{r#type:"done",text:None,error:None}).map_err(|_|"The app window closed")?;},Parsed::Error(e)=>return Err(redact(&e,&secret)),Parsed::Ignore=>{}}}if complete{break;}}
        if !complete{return Err("The stream ended before a completed response. Your partial answer was preserved.".into());}Ok(())
    }.await;
    state
        .jobs
        .lock()
        .map_err(|_| "Request lock failed")?
        .remove(&request.request_id);
    if let Err(ref error) = result {
        let _ = on_event.send(StreamEvent {
            r#type: "error",
            text: None,
            error: Some(error.clone()),
        });
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    fn local_client() -> reqwest::Client {
        reqwest::Client::builder().no_proxy().build().unwrap()
    }
    #[tokio::test]
    #[ignore = "Explicit public connectivity diagnostic; sends no credentials or inference"]
    async fn public_connection_probe() {
        let mut failures = 0;
        for (url, expected) in [
            ("https://auth.openai.com/.well-known/jwks.json", 200),
            ("https://api.openai.com/v1/models", 401),
        ] {
            let start = std::time::Instant::now();
            match send_request(client().unwrap().get(url)).await {
                Ok(response) => {
                    println!(
                        "{url}: HTTP {} ({:.2}s)",
                        response.status(),
                        start.elapsed().as_secs_f64()
                    );
                    if response.status().as_u16() != expected {
                        failures += 1;
                    }
                }
                Err(error) => {
                    println!(
                        "{url}: {} ({:.2}s)",
                        transport_error(&error, "Connection failed"),
                        start.elapsed().as_secs_f64()
                    );
                    failures += 1;
                }
            }
        }
        assert_eq!(failures, 0, "public connectivity has not recovered");
    }
    async fn reply_once(listener: tokio::net::TcpListener, status: &str) {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut bytes = Vec::new();
        let mut chunk = [0; 1024];
        loop {
            let size = socket.read(&mut chunk).await.unwrap();
            assert!(size > 0);
            bytes.extend_from_slice(&chunk[..size]);
            if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                let headers = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
                let length = headers
                    .lines()
                    .find_map(|line| line.strip_prefix("content-length: "))
                    .map(|v| v.parse::<usize>().unwrap())
                    .unwrap_or(0);
                if bytes.len() >= end + 4 + length {
                    break;
                }
            }
        }
        assert!(bytes.starts_with(b"POST "));
        socket
            .write_all(
                format!("HTTP/1.1 {status}\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
                    .as_bytes(),
            )
            .await
            .unwrap();
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(250), listener.accept())
                .await
                .is_err(),
            "an HTTP response must never cause a POST replay"
        );
    }
    #[tokio::test]
    async fn connection_retry_can_recover_before_post_is_sent() {
        let reserved = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = reserved.local_addr().unwrap();
        drop(reserved);
        let server = tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            reply_once(tokio::net::TcpListener::bind(addr).await.unwrap(), "200 OK").await;
        });
        let response = send_request(
            local_client()
                .post(format!("http://{addr}/responses"))
                .body("synthetic prompt"),
        )
        .await
        .unwrap();
        assert_eq!(response.status().as_u16(), 200);
        server.await.unwrap();
    }
    #[tokio::test]
    async fn http_failure_never_replays_post() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(reply_once(listener, "503 Service Unavailable"));
        let response = send_request(
            local_client()
                .post(format!("http://{addr}/responses"))
                .body("synthetic prompt"),
        )
        .await
        .unwrap();
        assert_eq!(response.status().as_u16(), 503);
        server.await.unwrap();
    }
    #[tokio::test]
    async fn tls_connect_retries_are_bounded_and_diagnostics_omit_secrets() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            for _ in 0..3 {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut hello = [0; 1024];
                let n = socket.read(&mut hello).await.unwrap();
                assert!(
                    n > 0 && hello[0] == 22,
                    "only the TLS handshake may precede a retry"
                );
            }
            assert!(
                tokio::time::timeout(std::time::Duration::from_millis(250), listener.accept())
                    .await
                    .is_err()
            );
        });
        let error = send_request(
            local_client()
                .post(format!("https://{addr}/responses?secret=synthetic-secret"))
                .bearer_auth("synthetic-key")
                .body("synthetic prompt"),
        )
        .await
        .unwrap_err();
        assert!(error.is_connect());
        assert_eq!(
            transport_error(&error, "Connection failed"),
            "Connection failed [TLS_CONNECTION_CLOSED]"
        );
        server.await.unwrap();
    }
    #[tokio::test]
    async fn connection_closed_after_post_never_replays_it() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            let mut chunk = [0; 1024];
            while !bytes.ends_with(b"synthetic prompt") {
                let n = socket.read(&mut chunk).await.unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&chunk[..n]);
            }
            assert!(bytes.starts_with(b"POST "));
            drop(socket);
            assert!(
                tokio::time::timeout(std::time::Duration::from_millis(250), listener.accept())
                    .await
                    .is_err()
            );
        });
        let error = send_request(
            local_client()
                .post(format!("http://{addr}/responses"))
                .body("synthetic prompt"),
        )
        .await
        .unwrap_err();
        assert!(
            !error.is_connect(),
            "a post-send error cannot qualify for automatic retry"
        );
        server.await.unwrap();
    }
    #[tokio::test]
    async fn cancellation_during_backoff_stops_new_connections() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut hello = [0; 1024];
            socket.read(&mut hello).await.unwrap();
            drop(socket);
            assert!(tokio::time::timeout(
                std::time::Duration::from_millis(1100),
                listener.accept()
            )
            .await
            .is_err());
        });
        assert!(tokio::time::timeout(
            std::time::Duration::from_millis(100),
            send_request(
                local_client()
                    .post(format!("https://{addr}/responses"))
                    .body("synthetic prompt")
            )
        )
        .await
        .is_err());
        server.await.unwrap();
    }
    fn example_request(provider: &str, effort: Option<&str>) -> Request {
        Request {
            request_id: "test".into(),
            provider: provider.into(),
            endpoint: "https://api.openai.com/v1".into(),
            model: "gpt-5.6-sol".into(),
            input: vec![json!({"role":"user","content":"Explain this"})],
            instructions: "Be clear".into(),
            profile_id: None,
            reasoning_effort: effort.map(str::to_owned),
        }
    }
    #[test]
    fn effort_is_forwarded_to_responses_and_default_is_omitted() {
        let body = request_body(&example_request("chatgpt", Some("high"))).unwrap();
        assert_eq!(body["reasoning"]["effort"], "high");
        assert_eq!(body["store"], false);
        assert_eq!(body["stream"], true);
        assert!(request_body(&example_request("openai", None))
            .unwrap()
            .get("reasoning")
            .is_none());
        assert!(request_body(&example_request("compatible", None))
            .unwrap()
            .get("reasoning")
            .is_none());
        assert!(request_body(&example_request("compatible", Some("high"))).is_err());
        assert!(request_body(&example_request("chatgpt", Some("injected"))).is_err());
    }
    #[test]
    fn catalog_metadata_only_retains_supported_effort_values() {
        let model = json!({"supported_reasoning_levels":[{"effort":"low","description":"Fast"},{"effort":"high"},{"effort":"unknown"}]});
        assert_eq!(
            reasoning_levels(&model),
            Some(vec!["low".into(), "high".into()])
        );
        assert_eq!(reasoning_levels(&json!({})), None);
    }
    #[test]
    fn split_unicode_and_crlf() {
        let mut p = Sse::new();
        let bytes = "data: {\"type\":\"response.output_text.delta\",\"delta\":\"学习🧠\"}\r\n\r\n"
            .as_bytes();
        let mut frames = vec![];
        for b in bytes {
            frames.extend(p.push(&[*b]).unwrap());
        }
        assert_eq!(frames.len(), 1);
        assert!(matches!(parse(&frames[0],false).unwrap(),Parsed::Delta(t) if t=="学习🧠"));
    }
    #[test]
    fn only_terminal_event_is_success() {
        assert!(matches!(parse("[DONE]", false).unwrap(), Parsed::Ignore));
        assert!(matches!(
            parse(r#"{"type":"response.incomplete"}"#, false).unwrap(),
            Parsed::Error(_)
        ));
        assert!(matches!(
            parse(r#"{"type":"response.completed"}"#, false).unwrap(),
            Parsed::Done
        ));
    }
    #[test]
    fn unsafe_endpoints_rejected() {
        assert!(endpoint("compatible", "http://example.com/v1").is_err());
        assert!(endpoint("compatible", "https://key@example.com/v1").is_err());
        assert!(endpoint("compatible", "http://127.0.0.1:9876/v1").is_ok());
        assert_eq!(
            endpoint("openai", "https://attacker.invalid").unwrap(),
            "https://api.openai.com/v1"
        );
    }
}
