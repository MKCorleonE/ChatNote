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
}
#[derive(Clone, Serialize)]
pub struct StreamEvent {
    r#type: &'static str,
    text: Option<String>,
    error: Option<String>,
}
#[derive(Serialize)]
pub struct Model {
    id: String,
    name: String,
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
        client()?
            .get(format!("{base}/models"))
            .bearer_auth(&secret)
            .send()
            .await
            .map_err(|_| {
                "Could not connect to the model provider. Check your network and API URL."
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
            .filter_map(|m| {
                Some(Model {
                    id: m["slug"].as_str()?.into(),
                    name: m["display_name"].as_str()?.into(),
                })
            })
            .collect()
    } else {
        data["data"]
            .as_array()
            .ok_or("The provider did not return a model catalog")?
            .iter()
            .filter_map(|m| {
                Some(Model {
                    id: m["id"].as_str()?.into(),
                    name: m["id"].as_str()?.into(),
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
        let body=if compatible {let mut messages=vec![json!({"role":"system","content":request.instructions})];messages.extend(request.input.clone());json!({"model":request.model,"messages":messages,"stream":true})}else{json!({"model":request.model,"input":request.input,"instructions":request.instructions,"stream":true,"store":false})};
        let pending=client()?.post(format!("{base}/{}",if compatible{"chat/completions"}else{"responses"})).bearer_auth(&secret).json(&body).send();
        let response=tokio::select!{r=pending=>r.map_err(|_|"Could not connect to the model provider. Check your network.")?, _=cancel_rx.changed()=>return Ok(())};
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
