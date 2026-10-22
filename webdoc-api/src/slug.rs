use unicode_normalization::UnicodeNormalization;

/// Build a URL slug from a Vietnamese title.
///
/// Diacritics are decomposed (NFD) and removed, `đ/Đ` are mapped to `d/D`,
/// everything outside `[a-z0-9]` becomes a single dash, and leading/trailing
/// dashes are dropped.
pub fn slugify(input: &str) -> String {
    let mut slug = String::with_capacity(input.len());
    let mut pending_dash = false;

    for ch in input.nfd() {
        if ch.is_ascii_alphanumeric() {
            if pending_dash && !slug.is_empty() {
                slug.push('-');
            }
            pending_dash = false;
            slug.push(ch.to_ascii_lowercase());
            continue;
        }

        // Vietnamese precomposed letters decompose to ASCII base letters +
        // combining marks. Drop the marks instead of turning them into dashes.
        if ('\u{0300}'..='\u{036f}').contains(&ch) {
            continue;
        }

        match ch {
            'đ' | 'Đ' => {
                if pending_dash && !slug.is_empty() {
                    slug.push('-');
                }
                pending_dash = false;
                slug.push('d');
            }
            _ => pending_dash = true,
        }
    }

    slug
}

#[cfg(test)]
mod tests {
    use super::slugify;

    #[test]
    fn removes_vietnamese_diacritics() {
        assert_eq!(
            slugify("Xây dựng và nâng cấp tạp chí khoa học"),
            "xay-dung-va-nang-cap-tap-chi-khoa-hoc"
        );
        assert_eq!(slugify("Đổi mới sáng tạo"), "doi-moi-sang-tao");
        assert_eq!(slugify("  Nghiên cứu   Y học  "), "nghien-cuu-y-hoc");
        assert_eq!(slugify("Bài viết: 100% chuẩn!"), "bai-viet-100-chuan");
        assert_eq!(
            slugify("Tạp chí Y – Dược học Quân sự"),
            "tap-chi-y-duoc-hoc-quan-su"
        );
    }
}
