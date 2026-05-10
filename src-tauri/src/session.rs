/**
 * Authenticate on BJColle.
 */
use reqwest::{self, redirect::Policy};

pub async fn request_session() -> Result<String, Box<dyn std::error::Error>> {
    let url = "https://bjcolle.fr/acces.php";

    let response = reqwest::get(url).await?;
    // Get response headers
    let session_id = response.headers().get("set-cookie");
    if !session_id.is_some() {
        return Err("Failed to get session ID".into());
    }
    Ok(session_id.unwrap().to_str()?.to_string())
}

pub async fn login(
    username: &str,
    password: &str,
    session_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let url = "https://bjcolle.fr/acces.php";

    let client = reqwest::Client::builder()
        .redirect(Policy::none())
        .build()?;
    let response = client
        .post(url)
        .header("Cookie", session_id)
        .form(&[
            ("USERNAME_ACCES", username),
            ("PASSWORD_ACCES", password),
            ("SOUVENIR", "on"),
            ("valider_ident", "Valider"),
        ])
        .send()
        .await?;

    // Check if login failed (non-2xx response)
    if !(response.status() == reqwest::StatusCode::FOUND) {
        return Err(format!("Login failed: HTTP {}", response.status()).into());
    }

    Ok(())
}
