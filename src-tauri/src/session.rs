/**
 * Authenticate on BJColle.
 */
use reqwest::{self, header::HeaderValue, redirect::Policy};

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
) -> Result<String, Box<dyn std::error::Error>> {
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

    // Get session ID from cookies
    let session_id: Vec<String> = response
        .headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|value: &HeaderValue| value.to_str().ok())
        .filter_map(|s| {
            // Get the part before the first semicolon
            let first_part = s.split(';').next()?.trim();

            // Only keep "bjid" or "bjp"
            if first_part.starts_with("bjid=") || first_part.starts_with("bjp=") {
                Some(first_part.to_string())
            } else {
                None
            }
        })
        .collect();

    if session_id.is_empty() {
        return Err("Invalid credentials".into());
    }

    Ok(session_id.join("; "))
}

pub async fn authenticate(
    username: &str,
    password: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let session_id = request_session().await?;
    let session_cookies = login(username, password, &session_id).await?;
    Ok(session_cookies)
}
