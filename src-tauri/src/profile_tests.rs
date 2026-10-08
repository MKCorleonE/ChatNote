#[cfg(test)]
mod tests {
    use crate::{auth, network};
    #[test]
    fn legacy_entries_preserved_and_profiles_isolated() {
        let a = uuid::Uuid::new_v4().to_string();
        let b = uuid::Uuid::new_v4().to_string();
        assert_ne!(
            auth::profile_entry("compatible", Some(&a)).unwrap(),
            auth::profile_entry("compatible", Some(&b)).unwrap()
        );
        assert_eq!(
            auth::profile_entry("openai", Some("legacy-openai")).unwrap(),
            "openai"
        );
        assert_eq!(
            auth::profile_entry("compatible", Some("legacy-compatible")).unwrap(),
            "compatible"
        );
        assert!(auth::profile_entry("compatible", Some("chatgpt")).is_err());
        assert!(auth::profile_entry("openai", Some("legacy-compatible")).is_err());
    }
    #[test]
    fn quota_and_admission_details_survive_without_exposing_keys() {
        let value = serde_json::json!({"error":{"code":"subscription_sharing_usage_limit_exceeded","message":"Quota reached TEST_SECRET"}});
        let text = network::provider_error(429, &value, "TEST_SECRET");
        assert!(text.contains("subscription_sharing_usage_limit_exceeded"));
        assert!(!text.contains("TEST_SECRET"));
        assert!(network::provider_error(
            403,
            &serde_json::json!({"detail":"Region is restricted"}),
            "TEST_SECRET"
        )
        .contains("Region is restricted"));
    }
    #[tokio::test]
    #[ignore = "Writes and deletes two disposable API profiles in the OS vault; run explicitly"]
    async fn native_profile_keys_do_not_overwrite_each_other() {
        let a = uuid::Uuid::new_v4().to_string();
        let b = uuid::Uuid::new_v4().to_string();
        let base = "https://test.example.invalid/v1";
        auth::set_api_key(
            "compatible".into(),
            "FAKE_KEY_A".into(),
            Some(base.into()),
            Some(a.clone()),
        )
        .unwrap();
        auth::set_api_key(
            "compatible".into(),
            "FAKE_KEY_B".into(),
            Some(base.into()),
            Some(b.clone()),
        )
        .unwrap();
        let first = auth::credential("compatible", base, Some(&a)).await;
        let second = auth::credential("compatible", base, Some(&b)).await;
        let mismatch =
            auth::credential("compatible", "https://other.example.invalid/v1", Some(&a)).await;
        auth::set_api_key("compatible".into(), "".into(), Some(base.into()), Some(a)).unwrap();
        auth::set_api_key("compatible".into(), "".into(), Some(base.into()), Some(b)).unwrap();
        assert_eq!(first.unwrap(), "FAKE_KEY_A");
        assert_eq!(second.unwrap(), "FAKE_KEY_B");
        assert!(mismatch.is_err());
    }
}
