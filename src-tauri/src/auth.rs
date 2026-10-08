use crate::{network, storage, Runtime};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const AUTH: &str = "https://auth.openai.com";
const RESOURCE: &str = "https://api.openai.com/v1";
static AUTH_SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    api_key: bool,
    compatible_key: bool,
    chatgpt: bool,
    email: Option<String>,
    plan_usage: bool,
    legacy_compatible_endpoint: Option<String>,
    registered: bool,
    refreshable: bool,
}
#[derive(Serialize, Deserialize, Clone)]
pub struct Tokens {
    access_token: String,
    refresh_token: Option<String>,
    id_token: String,
    client_id: String,
    subject: String,
    email: Option<String>,
    expires_at: u64,
    scopes: Vec<String>,
}
#[derive(Serialize, Deserialize)]
struct ApiKey {
    key: String,
    endpoint: String,
}
#[derive(Serialize, Deserialize)]
struct Registration {
    client_id: String,
    subject: String,
    email: Option<String>,
}
#[derive(Deserialize)]
struct Claims {
    sub: String,
    email: Option<String>,
    nonce: Option<String>,
}
fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn random() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
pub fn read_secret(name: &str) -> Result<Option<String>, String> {
    crate::vault::read(name)
}
fn write_secret(name: &str, value: Option<&str>) -> Result<(), String> {
    crate::vault::write(name, value)
}
#[tauri::command]
pub fn connection_status() -> Result<Connection, String> {
    let token = read_secret("chatgpt")?
        .map(|s| {
            serde_json::from_str::<Tokens>(&s)
                .map_err(|_| "Saved ChatGPT connection is unreadable; disconnect and sign in again")
        })
        .transpose()?;
    Ok(Connection {
        api_key: read_secret("openai")?.is_some(),
        compatible_key: read_secret("compatible")?.is_some(),
        chatgpt: token.is_some(),
        email: token.as_ref().and_then(|t| t.email.clone()),
        plan_usage: token
            .as_ref()
            .is_some_and(|t| t.scopes.iter().any(|s| s == "chatgpt.tokens.use.direct")),
        legacy_compatible_endpoint: read_secret("compatible")?
            .and_then(|s| serde_json::from_str::<ApiKey>(&s).ok())
            .map(|r| r.endpoint),
        registered: read_secret("chatgpt-registration")?.is_some(),
        refreshable: token.as_ref().is_some_and(|t| t.refresh_token.is_some()),
    })
}
#[tauri::command]
pub fn set_api_key(
    provider: String,
    key: String,
    endpoint: Option<String>,
    profile_id: Option<String>,
) -> Result<(), String> {
    if !matches!(provider.as_str(), "openai" | "compatible") {
        return Err("Choose an API-key provider".into());
    }
    let entry = profile_entry(&provider, profile_id.as_deref())?;
    if key.is_empty() {
        return write_secret(&entry, None);
    }
    if key.len() > 4000 || key.contains(['\r', '\n']) {
        return Err("Invalid API key".into());
    }
    let base = network::endpoint(&provider, endpoint.as_deref().unwrap_or(RESOURCE))?;
    let serialized = serde_json::to_string(&ApiKey {
        key,
        endpoint: base,
    })
    .map_err(|_| "Could not save connection")?;
    write_secret(&entry, Some(&serialized))
}
pub fn profile_entry(provider: &str, id: Option<&str>) -> Result<String, String> {
    if !matches!(provider, "openai" | "compatible") {
        return Err("Choose an API-key provider".into());
    }
    match id {
        None => Ok(provider.into()),
        Some("legacy-openai") if provider == "openai" => Ok("openai".into()),
        Some("legacy-compatible") if provider == "compatible" => Ok("compatible".into()),
        Some(id) => {
            let parsed = uuid::Uuid::parse_str(id).map_err(|_| "Invalid connection identifier")?;
            Ok(format!("api-profile:{parsed}"))
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileStatus {
    has_key: bool,
    endpoint_matches: bool,
    connected: bool,
    plan_usage: bool,
    email: Option<String>,
    registered: bool,
    refreshable: bool,
}
#[tauri::command]
pub fn profile_status(
    profile_id: String,
    provider: String,
    endpoint: String,
) -> Result<ProfileStatus, String> {
    if provider == "chatgpt" {
        let info = connection_status()?;
        return Ok(ProfileStatus {
            has_key: false,
            endpoint_matches: true,
            connected: info.chatgpt,
            plan_usage: info.plan_usage,
            email: info.email,
            registered: info.registered,
            refreshable: info.refreshable,
        });
    }
    let name = profile_entry(&provider, Some(&profile_id))?;
    let record = read_secret(&name)?
        .map(|s| serde_json::from_str::<ApiKey>(&s).map_err(|_| "Saved connection is unreadable"))
        .transpose()?;
    let matches = record.as_ref().is_none_or(|r| {
        network::endpoint(&provider, &endpoint).is_ok_and(|base| r.endpoint == base)
    });
    Ok(ProfileStatus {
        has_key: record.is_some(),
        endpoint_matches: matches,
        connected: record.is_some() && matches,
        plan_usage: false,
        email: None,
        registered: false,
        refreshable: false,
    })
}
#[tauri::command]
pub async fn sign_out_chatgpt(state: State<'_, Runtime>) -> Result<String, String> {
    for tx in state
        .jobs
        .lock()
        .map_err(|_| "Request lock failed")?
        .values()
    {
        let _ = tx.send(true);
    }
    let _guard = AUTH_SERIAL.lock().await;
    let record = read_secret("chatgpt")?
        .map(|raw| {
            serde_json::from_str::<Tokens>(&raw).map_err(|_| "Saved connection is unreadable")
        })
        .transpose()?;
    let mut confirmed = false;
    if let Some(ref token) = record {
        write_secret(
            "chatgpt-registration",
            Some(
                &serde_json::to_string(&Registration {
                    client_id: token.client_id.clone(),
                    subject: token.subject.clone(),
                    email: token.email.clone(),
                })
                .map_err(|_| "Could not retain account registration")?,
            ),
        )?;
        if let Some(refresh) = &token.refresh_token {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .map_err(|_| "Could not initialize sign-out")?;
            if let Ok(discovery) = client
                .get(format!("{AUTH}/.well-known/openid-configuration"))
                .send()
                .await
            {
                if let Ok(data) = discovery.json::<Value>().await {
                    if let Some(endpoint) = data["revocation_endpoint"].as_str() {
                        if url::Url::parse(endpoint).is_ok_and(|u| {
                            u.scheme() == "https" && u.host_str() == Some("auth.openai.com")
                        }) {
                            for attempt in 0..2 {
                                match client
                                    .post(endpoint)
                                    .form(&[
                                        ("token", refresh.as_str()),
                                        ("token_type_hint", "refresh_token"),
                                        ("client_id", &token.client_id),
                                    ])
                                    .send()
                                    .await
                                {
                                    Ok(response)
                                        if response.status() == reqwest::StatusCode::OK =>
                                    {
                                        confirmed = true;
                                        break;
                                    }
                                    Ok(response) if !response.status().is_server_error() => break,
                                    _ => {
                                        if attempt == 0 {
                                            tokio::time::sleep(std::time::Duration::from_secs(1))
                                                .await;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    write_secret("chatgpt", None)?;
    Ok(if confirmed||record.is_none(){"Disconnected from ChatGPT."}else{"Disconnected locally. Remote revocation could not be confirmed. You can remove ChatNote in ChatGPT Settings → Security and login → Sign in with ChatGPT."}.into())
}
async fn validate_id(
    token: &str,
    client_id: &str,
    expected_nonce: Option<&str>,
) -> Result<Claims, String> {
    let header = decode_header(token).map_err(|_| "Invalid identity token")?;
    if header.alg != Algorithm::RS256 {
        return Err("Unsupported identity signature algorithm".into());
    }
    let kid = header
        .kid
        .ok_or("The identity token has no signing key identifier")?;
    let response = network::client()?
        .get(format!("{AUTH}/.well-known/jwks.json"))
        .send()
        .await
        .map_err(|_| "Could not verify the identity signing keys")?
        .error_for_status()
        .map_err(|_| "Identity signing keys are unavailable")?;
    let jwks: Value = response
        .json()
        .await
        .map_err(|_| "Invalid identity signing keys")?;
    let key = jwks["keys"]
        .as_array()
        .and_then(|keys| {
            keys.iter()
                .find(|k| k["kid"].as_str() == Some(&kid) && k["kty"] == "RSA")
        })
        .ok_or("Identity signing key was not found")?;
    let decoding = DecodingKey::from_rsa_components(
        key["n"].as_str().ok_or("Invalid identity key")?,
        key["e"].as_str().ok_or("Invalid identity key")?,
    )
    .map_err(|_| "Invalid identity key")?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[AUTH]);
    validation.set_audience(&[client_id]);
    validation.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
    let claims = decode::<Claims>(token, &decoding, &validation)
        .map_err(|_| "Identity token signature or claims could not be verified")?
        .claims;
    if expected_nonce.is_some() && claims.nonce.as_deref() != expected_nonce {
        return Err("Sign-in nonce did not match".into());
    }
    Ok(claims)
}
fn refresh_failure(status: u16, code: &str) -> String {
    if status == 401 || code == "invalid_grant" {
        "Your ChatGPT session expired or was revoked. Sign in again; your registration and conversations are kept.".into()
    } else {
        "ChatGPT session renewal is temporarily unavailable. Your saved session was kept. Retry later without disconnecting.".into()
    }
}
pub async fn credential(
    provider: &str,
    base: &str,
    profile_id: Option<&str>,
) -> Result<String, String> {
    let _guard = AUTH_SERIAL.lock().await;
    if provider != "chatgpt" {
        let entry = profile_entry(provider, profile_id)?;
        let raw = read_secret(&entry)?.ok_or("Save your API key in Settings first")?;
        let record: ApiKey =
            serde_json::from_str(&raw).map_err(|_| "Saved provider connection is unreadable")?;
        if record.endpoint != base {
            return Err("This key belongs to a different API URL. Save a key for the selected provider URL first.".into());
        }
        return Ok(record.key);
    }
    let raw = read_secret("chatgpt")?.ok_or("Connect your ChatGPT account in Settings first")?;
    let mut record: Tokens =
        serde_json::from_str(&raw).map_err(|_| "Saved ChatGPT connection is unreadable")?;
    if !record
        .scopes
        .iter()
        .any(|s| s == "chatgpt.tokens.use.direct")
    {
        return Err("This connection has not been authorized to use your ChatGPT plan. Reconnect and grant plan permission.".into());
    }
    if record.expires_at <= now() + 90 {
        let refresh = record
            .refresh_token
            .as_deref()
            .ok_or("Your ChatGPT connection expired. Sign in again.")?;
        let response = network::client()?
            .post(format!("{AUTH}/api/accounts/oauth/token"))
            .form(&[
                ("grant_type", "refresh_token"),
                ("client_id", &record.client_id),
                ("refresh_token", refresh),
                ("resource", RESOURCE),
            ])
            .send()
            .await
            .map_err(|_| "ChatGPT session renewal is temporarily unavailable. Your saved session was kept. Retry later without disconnecting.")?;
        if !response.status().is_success() {
            let status = response.status().as_u16();
            let error = response.json::<Value>().await.unwrap_or_default();
            return Err(refresh_failure(
                status,
                error["error"].as_str().unwrap_or(""),
            ));
        }
        let data: Value = response
            .json()
            .await
            .map_err(|_| "Invalid token refresh response")?;
        record.access_token = data["access_token"]
            .as_str()
            .ok_or("No refreshed access token was returned")?
            .into();
        if let Some(scope) = data["scope"].as_str() {
            record.scopes = scope.split_whitespace().map(String::from).collect();
        }
        if !record
            .scopes
            .iter()
            .any(|s| s == "chatgpt.tokens.use.direct")
        {
            return Err("ChatGPT plan permission is no longer enabled".into());
        }
        if let Some(id) = data["id_token"].as_str() {
            let claims = validate_id(id, &record.client_id, None).await?;
            if claims.sub != record.subject {
                return Err("Refreshed ChatGPT identity changed; sign in again".into());
            }
            record.id_token = id.into();
        }
        if let Some(refresh) = data["refresh_token"].as_str() {
            record.refresh_token = Some(refresh.into());
        }
        record.expires_at = now() + data["expires_in"].as_u64().unwrap_or(3600).min(86400);
        write_secret(
            "chatgpt",
            Some(
                &serde_json::to_string(&record)
                    .map_err(|_| "Could not save refreshed connection")?,
            ),
        )?;
    }
    Ok(record.access_token)
}
fn callback_values(
    path: &str,
    state: &str,
    existing: Option<&str>,
) -> Result<(String, String), String> {
    let callback = url::Url::parse(&format!("http://127.0.0.1{path}"))
        .map_err(|_| "Invalid sign-in callback")?;
    if callback.path() != "/auth/callback" {
        return Err("Wrong callback path".into());
    }
    let values = callback
        .query_pairs()
        .collect::<std::collections::HashMap<_, _>>();
    if values.get("state").map(|s| s.as_ref()) != Some(state) {
        return Err("The sign-in state did not match. Start sign-in again.".into());
    }
    if values.contains_key("error") {
        return Err("Authorization was declined. Your previous connection was kept.".into());
    }
    let client = values
        .get("client_id")
        .map(|s| s.to_string())
        .or(existing.map(String::from))
        .ok_or("Registration did not return a client identifier")?;
    if client == "dynamic_agent_client" || existing.is_some_and(|old| old != client) {
        return Err("The client registration did not match".into());
    }
    let code = values
        .get("code")
        .ok_or("No authorization code was returned")?
        .to_string();
    Ok((code, client))
}
fn callback_page(ok: bool, language: Option<&str>) -> String {
    let (lang, title, detail) = match (language, ok) {
        (Some("zh-Hans"), true) => (
            "zh-Hans",
            "已收到授权",
            "请返回 ChatNote 完成连接。你可以关闭此标签页。",
        ),
        (Some("zh-Hans"), false) => ("zh-Hans", "无法验证授权", "请返回 ChatNote 后重试。"),
        (Some("zh-Hant"), true) => (
            "zh-Hant",
            "已收到授權",
            "請返回 ChatNote 完成連線。你可以關閉此分頁。",
        ),
        (Some("zh-Hant"), false) => ("zh-Hant", "無法驗證授權", "請返回 ChatNote 後重試。"),
        (_, true) => (
            "en",
            "Authorization received",
            "Return to ChatNote to finish connecting. You can close this tab.",
        ),
        (_, false) => (
            "en",
            "Authorization could not be verified",
            "Return to ChatNote and try again.",
        ),
    };
    format!("<!doctype html><html lang=\"{lang}\"><meta charset=utf-8><title>ChatNote</title><h2>{title}</h2><p>{detail}</p></html>")
}

#[tauri::command]
pub async fn sign_in_chatgpt(
    app: AppHandle,
    state: State<'_, Runtime>,
    new_account: Option<bool>,
    language: Option<String>,
) -> Result<Connection, String> {
    let _guard = state
        .login
        .try_lock()
        .map_err(|_| "Another sign-in is already in progress")?;
    let (tx, mut cancelled) = tokio::sync::watch::channel(false);
    *state
        .login_cancel
        .lock()
        .map_err(|_| "Sign-in lock failed")? = Some(tx);
    let _reset = LoginAttempt(&state.login_cancel);
    tokio::select! {
        biased;
        _ = cancelled.changed() => Err("Sign-in was cancelled. Your previous connection was kept.".into()),
        result = sign_in_inner(app, &state, new_account, language) => result,
    }
}

struct LoginAttempt<'a>(&'a std::sync::Mutex<Option<tokio::sync::watch::Sender<bool>>>);
impl Drop for LoginAttempt<'_> {
    fn drop(&mut self) {
        if let Ok(mut active) = self.0.lock() {
            active.take();
        }
    }
}

#[tauri::command]
pub fn cancel_sign_in(state: State<'_, Runtime>) -> Result<(), String> {
    if let Some(active) = state
        .login_cancel
        .lock()
        .map_err(|_| "Sign-in lock failed")?
        .as_ref()
    {
        let _ = active.send(true);
    }
    Ok(())
}

#[tauri::command]
pub async fn check_sign_in_service() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(concat!("ChatNote/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| "Could not initialize network client")?;
    let response = client
        .get(format!("{AUTH}/.well-known/openid-configuration"))
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "Sign-in service connection timed out. Check your network and retry."
            } else {
                "Sign-in service connection failed. Check your network and retry."
            }
        })?;
    if !response.status().is_success() {
        return Err(format!(
            "Sign-in service returned HTTP {}. Check your network or try again later.",
            response.status().as_u16()
        ));
    }
    Ok("Sign-in service is reachable. Browser authorization can still fail independently.".into())
}

async fn sign_in_inner(
    app: AppHandle,
    state: &Runtime,
    new_account: Option<bool>,
    language: Option<String>,
) -> Result<Connection, String> {
    let _auth_guard = AUTH_SERIAL.lock().await;
    let host = storage::host_id(state)?;
    let existing = if new_account == Some(true) {
        None
    } else {
        read_secret("chatgpt")?
            .map(|s| {
                serde_json::from_str::<Tokens>(&s)
                    .map_err(|_| "Saved connection is unreadable; disconnect first")
            })
            .transpose()?
    };
    let registration = if new_account == Some(true) {
        None
    } else {
        read_secret("chatgpt-registration")?
            .map(|s| {
                serde_json::from_str::<Registration>(&s)
                    .map_err(|_| "Saved account registration is unreadable")
            })
            .transpose()?
    };
    let selected_client = existing
        .as_ref()
        .map(|t| t.client_id.as_str())
        .or(registration.as_ref().map(|r| r.client_id.as_str()));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|_| "Could not open the local sign-in callback")?;
    let redirect = format!(
        "http://127.0.0.1:{}/auth/callback",
        listener
            .local_addr()
            .map_err(|_| "No callback address")?
            .port()
    );
    let verifier = random();
    let nonce = random();
    let random_state = random();
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let mut url = url::Url::parse(&format!("{AUTH}/api/accounts/authorize")).unwrap();
    {
        let mut q = url.query_pairs_mut();
        q.append_pair(
            "client_id",
            selected_client.unwrap_or("dynamic_agent_client"),
        )
        .append_pair("ext_agent_host_id", &host)
        .append_pair("response_type", "code")
        .append_pair("redirect_uri", &redirect)
        .append_pair(
            "scope",
            "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
        )
        .append_pair("resource", RESOURCE)
        .append_pair("state", &random_state)
        .append_pair("nonce", &nonce)
        .append_pair("code_challenge_method", "S256")
        .append_pair("code_challenge", &challenge);
        if let Some(t) = &existing {
            q.append_pair("id_token_hint", &t.id_token);
        } else if let Some(r) = &registration {
            if let Some(email) = &r.email {
                q.append_pair("login_hint", email);
            }
        } else {
            q.append_pair("agent_name_hint", "ChatNote");
        }
    }
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| "Could not open the system browser")?;
    let waiting = async {
        loop {
            let (mut socket, _) = listener
                .accept()
                .await
                .map_err(|_| "Sign-in callback failed")?;
            let mut bytes = vec![];
            let mut buffer = [0u8; 2048];
            loop {
                let len = tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    socket.read(&mut buffer),
                )
                .await
                .map_err(|_| "Callback timed out")?
                .map_err(|_| "Callback read failed")?;
                if len == 0 {
                    break;
                }
                bytes.extend_from_slice(&buffer[..len]);
                if bytes.windows(4).any(|x| x == b"\r\n\r\n") || bytes.len() > 16000 {
                    break;
                }
            }
            let request = String::from_utf8_lossy(&bytes);
            let path = request
                .lines()
                .next()
                .and_then(|l| l.strip_prefix("GET "))
                .and_then(|l| l.split_whitespace().next())
                .unwrap_or("");
            if !path.starts_with("/auth/callback?") {
                let _ = socket
                    .write_all(
                        b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                    )
                    .await;
                continue;
            }
            let result = callback_values(path, &random_state, selected_client);
            let body = callback_page(result.is_ok(), language.as_deref());
            let response=format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'none'\r\n\r\n{body}",body.len());
            let _ = socket.write_all(response.as_bytes()).await;
            return result;
        }
    };
    let (code, client) = tokio::time::timeout(std::time::Duration::from_secs(180), waiting)
        .await
        .map_err(|_| "Sign-in timed out. Your previous connection was kept; try again.")??;
    let response = network::client()?
        .post(format!("{AUTH}/api/accounts/oauth/token"))
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", &client),
            ("code", &code),
            ("code_verifier", &verifier),
            ("redirect_uri", &redirect),
            ("resource", RESOURCE),
        ])
        .send()
        .await
        .map_err(|_| "Could not exchange the sign-in authorization")?;
    if !response.status().is_success() {
        return Err("The authorization could not be exchanged. Start sign-in again.".into());
    }
    let data: Value = response
        .json()
        .await
        .map_err(|_| "Invalid authorization response")?;
    let id_token = data["id_token"]
        .as_str()
        .ok_or("No identity token was returned")?;
    let claims = validate_id(id_token, &client, Some(&nonce)).await?;
    if existing
        .as_ref()
        .is_some_and(|old| old.subject != claims.sub)
    {
        return Err("The returned account differs from the selected registration".into());
    }
    if registration
        .as_ref()
        .is_some_and(|old| old.subject != claims.sub)
    {
        return Err("The returned account differs from the selected registration. Use Connect a different account.".into());
    }
    let tokens = Tokens {
        access_token: data["access_token"]
            .as_str()
            .ok_or("No access token was returned")?
            .into(),
        refresh_token: data["refresh_token"].as_str().map(String::from),
        id_token: id_token.into(),
        client_id: client,
        subject: claims.sub,
        email: claims.email,
        expires_at: now() + data["expires_in"].as_u64().unwrap_or(3600).min(86400),
        scopes: data["scope"]
            .as_str()
            .unwrap_or("")
            .split_whitespace()
            .map(String::from)
            .collect(),
    };
    write_secret(
        "chatgpt",
        Some(&serde_json::to_string(&tokens).map_err(|_| "Could not save account connection")?),
    )?;
    write_secret(
        "chatgpt-registration",
        Some(
            &serde_json::to_string(&Registration {
                client_id: tokens.client_id.clone(),
                subject: tokens.subject.clone(),
                email: tokens.email.clone(),
            })
            .map_err(|_| "Could not retain account registration")?,
        ),
    )?;
    connection_status()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn renewal_outage_is_not_reported_as_revocation() {
        for code in [429, 500, 502, 503] {
            assert!(refresh_failure(code, "").contains("temporarily"));
        }
        assert!(refresh_failure(400, "invalid_grant").contains("Sign in again"));
        assert!(!refresh_failure(503, "").contains("Disconnect"));
    }
    #[test]
    fn cancelled_attempt_cleans_up_and_does_not_cancel_a_later_attempt() {
        let (first, mut old) = tokio::sync::watch::channel(false);
        let active = std::sync::Mutex::new(Some(first));
        {
            let _attempt = LoginAttempt(&active);
            active.lock().unwrap().as_ref().unwrap().send(true).unwrap();
            assert!(old.has_changed().unwrap());
            assert!(*old.borrow_and_update());
        }
        assert!(active.lock().unwrap().is_none());
        let (next, fresh) = tokio::sync::watch::channel(false);
        *active.lock().unwrap() = Some(next);
        assert!(!fresh.has_changed().unwrap());
        assert!(!*fresh.borrow());
    }
    #[test]
    fn callback_languages_and_fallback() {
        for (lang, success, failure) in [
            ("en", "Authorization received", "could not be verified"),
            ("zh-Hans", "已收到授权", "无法验证授权"),
            ("zh-Hant", "已收到授權", "無法驗證授權"),
        ] {
            assert!(callback_page(true, Some(lang)).contains(success));
            assert!(callback_page(false, Some(lang)).contains(failure));
        }
        assert_eq!(
            callback_page(true, None),
            callback_page(true, Some("unsupported"))
        );
        assert!(!callback_page(true, Some("<script>")).contains("<script>"));
    }
    #[test]
    fn callback_requires_state_issued_client_and_matching_path() {
        assert!(callback_values(
            "/auth/callback?state=s&code=c&client_id=oaiapp_test",
            "s",
            None
        )
        .is_ok());
        assert!(callback_values(
            "/auth/callback?state=wrong&code=c&client_id=oaiapp_test",
            "s",
            None
        )
        .is_err());
        assert!(callback_values("/auth/callback?state=s&code=c", "s", None).is_err());
        assert!(
            callback_values("/callback?state=s&code=c&client_id=oaiapp_test", "s", None).is_err()
        );
        assert!(callback_values(
            "/auth/callback?state=s&code=c&client_id=other",
            "s",
            Some("oaiapp_test")
        )
        .is_err());
        assert!(callback_values("/auth/callback?state=s&error=access_denied", "s", None).is_err());
    }
    #[test]
    fn pkce_values_are_random_and_url_safe() {
        let a = random();
        let b = random();
        assert_ne!(a, b);
        assert_eq!(a.len(), 43);
        assert!(!a.contains('='));
    }
}
