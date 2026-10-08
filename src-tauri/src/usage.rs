use crate::{auth, network};
use serde::Serialize;
use serde_json::Value;
#[derive(Serialize)]
pub struct Balance {
    currency: String,
    total: String,
    granted: String,
    #[serde(rename = "toppedUp")]
    topped_up: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    kind: &'static str,
    available: Option<bool>,
    balances: Vec<Balance>,
    url: String,
    checked_at: Option<u64>,
}
pub fn parse_balance(value: &Value) -> Result<(bool, Vec<Balance>), String> {
    let available = value["is_available"]
        .as_bool()
        .ok_or("The provider did not return a valid balance")?;
    let rows = value["balance_infos"]
        .as_array()
        .ok_or("The provider did not return balance details")?;
    let mut balances = vec![];
    for row in rows {
        balances.push(Balance {
            currency: row["currency"]
                .as_str()
                .ok_or("Missing balance currency")?
                .into(),
            total: row["total_balance"]
                .as_str()
                .ok_or("Missing available balance")?
                .into(),
            granted: row["granted_balance"].as_str().unwrap_or("").into(),
            topped_up: row["topped_up_balance"].as_str().unwrap_or("").into(),
        });
    }
    Ok((available, balances))
}
#[tauri::command]
pub async fn connection_usage(
    profile_id: String,
    provider: String,
    endpoint: String,
    preset: String,
) -> Result<Usage, String> {
    let url = if provider == "chatgpt" {
        "https://chatgpt.com/#settings/Usage"
    } else if provider == "openai" {
        "https://platform.openai.com/usage"
    } else if preset == "deepseek" {
        "https://platform.deepseek.com/"
    } else if preset == "qwen" {
        "https://bailian.console.aliyun.com/"
    } else {
        ""
    };
    let base = network::endpoint(&provider, &endpoint)?;
    if preset != "deepseek"
        || !url::Url::parse(&base).is_ok_and(|u| u.host_str() == Some("api.deepseek.com"))
    {
        return Ok(Usage {
            kind: "external",
            available: None,
            balances: vec![],
            url: url.into(),
            checked_at: None,
        });
    }
    let secret = auth::credential(&provider, &base, Some(&profile_id)).await?;
    let response = network::checked(
        network::client()?
            .get(format!("{base}/user/balance"))
            .bearer_auth(&secret)
            .send()
            .await
            .map_err(|_| "Could not connect to the provider for a balance check")?,
        &secret,
    )
    .await?;
    let value: Value = response
        .json()
        .await
        .map_err(|_| "Invalid balance response")?;
    let (available, balances) = parse_balance(&value)?;
    Ok(Usage {
        kind: "balance",
        available: Some(available),
        balances,
        url: url.into(),
        checked_at: Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
                * 1000,
        ),
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn actual_balance_and_currency_not_estimated_tokens() {
        let value = serde_json::json!({"is_available":true,"balance_infos":[{"currency":"CNY","total_balance":"12.34","granted_balance":"2.00","topped_up_balance":"10.34"}]});
        let (ok, rows) = parse_balance(&value).unwrap();
        assert!(ok);
        assert_eq!(rows[0].total, "12.34");
        assert_eq!(rows[0].currency, "CNY");
        assert!(parse_balance(&serde_json::json!({"remaining_tokens":100})).is_err());
    }
}
